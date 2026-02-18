"""BOOKFORGE book generation pipeline.

Features:
- Outline + chapter generation (Claude/GPT-5)
- Full chapters for Pro/Enterprise
- Gemini cover generation for Pro/Enterprise
- EPUB/PDF export + upload to Supabase Storage
- Resend "book ready" notifications
- ElevenLabs audiobook generation for Enterprise
- Optional async job orchestration for long-running generation
"""

from __future__ import annotations

import asyncio
import base64
import io
import json
import os
import re
import uuid
from typing import Any, Awaitable, Callable, Literal, Optional

import httpx
from anthropic import AsyncAnthropic
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from pydantic import BaseModel

from routers.export import ExportRequest, build_epub, build_pdf
from services.supabase import (
    SupabaseConfigError,
    fetch_book_job,
    fetch_profile,
    insert_book,
    insert_book_job,
    update_book,
    update_book_job,
    update_profile,
    upload_file,
    verify_user_access_token,
)

router = APIRouter()
anthropic_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

GEMINI_IMAGE_MODEL = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "BOOKFORGE <onboarding@resend.dev>")
ELEVENLABS_DEFAULT_VOICE_ID = os.getenv("ELEVENLABS_DEFAULT_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")

PlanType = Literal["starter", "pro", "enterprise"]
ProgressCallback = Optional[Callable[[int, str], Awaitable[None]]]


# ─── Models ───────────────────────────────────────────────────────────────────

class BookRequest(BaseModel):
    genre: str
    subgenre: Optional[str] = None
    title_idea: Optional[str] = None
    target_audience: str = "adults"
    page_count: int = 200
    tone: str = "engaging"
    keywords: list[str] = []
    language: str = "en"
    ai_model: Literal["claude", "gpt-5"] = "claude"

    plan: PlanType = "starter"
    generate_full_book: bool = False
    generate_cover_image: bool = False
    generate_audiobook: bool = False

    recipient_email: Optional[str] = None
    author_name: str = "BOOKFORGE AI"
    voice_id: Optional[str] = None

    demand_score: Optional[int] = None
    estimated_revenue: Optional[str] = None


class BookOutline(BaseModel):
    title: str
    subtitle: Optional[str]
    tagline: str
    back_cover_description: str
    chapters: list[dict]
    protagonist: Optional[dict]
    themes: list[str]
    amazon_categories: list[str]
    amazon_keywords: list[str]


class BookGenerationResult(BaseModel):
    outline: BookOutline
    chapter_1_preview: str
    amazon_listing: dict
    cover_prompt: str
    model_used: str

    full_chapters: Optional[list[dict]] = None
    cover_image_base64: Optional[str] = None
    cover_image_mime_type: Optional[str] = None
    audiobook_base64: Optional[str] = None
    audiobook_mime_type: Optional[str] = None

    book_id: Optional[str] = None
    persisted: bool = False
    plan_used: Optional[PlanType] = None
    credits_remaining: Optional[int] = None

    pdf_url: Optional[str] = None
    epub_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    audiobook_url: Optional[str] = None

    notification_sent: bool = False
    generation_notes: list[str] = []


class CoverGenerationRequest(BaseModel):
    prompt: str


class CoverGenerationResult(BaseModel):
    image_base64: str
    mime_type: str


class AudiobookRequest(BaseModel):
    title: str
    text: str
    voice_id: Optional[str] = None


class JobCreateResponse(BaseModel):
    job_id: str
    status: str


# ─── Utility ──────────────────────────────────────────────────────────────────


def safe_slug(value: str, default: str = "bookforge") -> str:
    cleaned = re.sub(r"[^\w\s-]", "", value).strip().replace(" ", "_")
    return cleaned[:80] if cleaned else default


def parse_bearer_token(request: Request) -> str:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid bearer token")
    return token


def normalize_plan(raw_plan: Optional[str]) -> PlanType:
    if raw_plan == "pro":
        return "pro"
    if raw_plan == "enterprise":
        return "enterprise"
    return "starter"


def validate_requested_features(plan: PlanType, request: BookRequest) -> tuple[bool, bool, bool]:
    if request.generate_full_book and plan == "starter":
        raise HTTPException(status_code=403, detail="Full chapter generation requires Pro or Enterprise")
    if request.generate_cover_image and plan == "starter":
        raise HTTPException(status_code=403, detail="Cover generation requires Pro or Enterprise")
    if request.generate_audiobook and plan != "enterprise":
        raise HTTPException(status_code=403, detail="Audiobook generation requires Enterprise")

    return request.generate_full_book, request.generate_cover_image, request.generate_audiobook


def chunk_text_for_audio(text: str, max_chars: int = 4200) -> list[str]:
    blocks = [block.strip() for block in text.split("\n\n") if block.strip()]
    if not blocks:
        return [text[:max_chars]]

    chunks: list[str] = []
    current = ""
    for block in blocks:
        candidate = f"{current}\n\n{block}" if current else block
        if len(candidate) <= max_chars:
            current = candidate
            continue

        if current:
            chunks.append(current)
            current = ""

        while len(block) > max_chars:
            chunks.append(block[:max_chars])
            block = block[max_chars:]
        current = block

    if current:
        chunks.append(current)

    return chunks or [text[:max_chars]]


# ─── AI Helpers ───────────────────────────────────────────────────────────────

async def call_ai(prompt: str, ai_model: str, max_tokens: int = 3000) -> str:
    if ai_model == "gpt-5":
        response = await openai_client.chat.completions.create(
            model="gpt-5",
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""

    model = "claude-opus-4-6" if max_tokens > 1500 else "claude-haiku-4-5-20251001"
    message = await anthropic_client.messages.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


def extract_json_object(raw_text: str, fallback_error: str) -> dict[str, Any]:
    json_match = re.search(r"\{[\s\S]*\}", raw_text)
    if not json_match:
        raise HTTPException(status_code=500, detail=fallback_error)
    return json.loads(json_match.group())


async def render_cover_image_with_gemini(prompt: str) -> tuple[str, str]:
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_IMAGE_MODEL}:generateContent"
    payloads = [
        {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
        },
        {"contents": [{"parts": [{"text": prompt}]}]},
    ]

    async with httpx.AsyncClient(timeout=90.0) as client:
        last_error = ""
        for payload in payloads:
            response = await client.post(
                endpoint,
                headers={
                    "x-goog-api-key": gemini_api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
            )

            if response.status_code >= 400:
                last_error = response.text
                continue

            data = response.json()
            for candidate in data.get("candidates", []):
                for part in candidate.get("content", {}).get("parts", []):
                    inline_data = part.get("inlineData") or part.get("inline_data")
                    if inline_data and inline_data.get("data"):
                        return inline_data["data"], inline_data.get("mimeType", "image/png")

            last_error = "No inline image data returned by Gemini"

    raise RuntimeError(f"Gemini image generation failed: {last_error}")


async def synthesize_audio_chunk(text: str, voice_id: Optional[str] = None) -> tuple[bytes, str]:
    elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
    if not elevenlabs_api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured")

    resolved_voice_id = voice_id or ELEVENLABS_DEFAULT_VOICE_ID
    endpoint = f"https://api.elevenlabs.io/v1/text-to-speech/{resolved_voice_id}"

    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            endpoint,
            headers={
                "xi-api-key": elevenlabs_api_key,
                "accept": "audio/mpeg",
                "Content-Type": "application/json",
            },
            json={
                "text": text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {
                    "stability": 0.45,
                    "similarity_boost": 0.75,
                },
            },
        )

    if response.status_code >= 400:
        raise RuntimeError(f"ElevenLabs failed: {response.text}")

    return response.content, "audio/mpeg"


async def synthesize_full_audiobook(text: str, voice_id: Optional[str] = None) -> tuple[bytes, str, int]:
    chunks = chunk_text_for_audio(text)
    segments: list[bytes] = []
    mime_type = "audio/mpeg"

    for chunk in chunks:
        audio_bytes, mime_type = await synthesize_audio_chunk(chunk, voice_id)
        segments.append(audio_bytes)

    merged = b"".join(segments)
    return merged, mime_type, len(chunks)


async def send_book_ready_email(
    *,
    to_email: str,
    title: str,
    plan: PlanType,
    model_label: str,
    includes_full_book: bool,
    includes_cover: bool,
    includes_audiobook: bool,
    pdf_url: Optional[str],
    epub_url: Optional[str],
    cover_image_url: Optional[str],
    audiobook_url: Optional[str],
) -> bool:
    resend_api_key = os.getenv("RESEND_API_KEY")
    if not resend_api_key:
        return False

    premium_features: list[str] = []
    if includes_full_book:
        premium_features.append("full chapter draft")
    if includes_cover:
        premium_features.append("cover image")
    if includes_audiobook:
        premium_features.append("audiobook")

    extras = ", ".join(premium_features) if premium_features else "standard generation package"

    links = []
    if pdf_url:
        links.append(f'<li><a href="{pdf_url}">Download PDF</a></li>')
    if epub_url:
        links.append(f'<li><a href="{epub_url}">Download EPUB</a></li>')
    if cover_image_url:
        links.append(f'<li><a href="{cover_image_url}">View Cover</a></li>')
    if audiobook_url:
        links.append(f'<li><a href="{audiobook_url}">Download Audiobook</a></li>')

    links_html = "".join(links) or "<li>Open BOOKFORGE dashboard to access your files.</li>"

    html_body = f"""
    <div style=\"font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;\">
      <h2 style=\"margin:0 0 12px;color:#111827;\">Your BOOKFORGE book is ready</h2>
      <p style=\"color:#374151;line-height:1.6;\">Great news — <strong>{title}</strong> has finished generating.</p>
      <ul style=\"color:#374151;line-height:1.7;\">
        <li>Plan: <strong>{plan.capitalize()}</strong></li>
        <li>Model: <strong>{model_label}</strong></li>
        <li>Output: <strong>{extras}</strong></li>
      </ul>
      <p style=\"color:#111827;line-height:1.6;margin-top:20px;\"><strong>Your files:</strong></p>
      <ul style=\"line-height:1.7;\">{links_html}</ul>
    </div>
    """

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": RESEND_FROM_EMAIL,
                "to": [to_email],
                "subject": f"Your BOOKFORGE book \"{title}\" is ready",
                "html": html_body,
            },
        )

    return response.status_code < 400


# ─── Generation steps ─────────────────────────────────────────────────────────

async def generate_outline(request: BookRequest) -> BookOutline:
    keywords_str = ", ".join(request.keywords) if request.keywords else "none specified"

    prompt = f"""You are a bestselling author and Amazon KDP expert.

Create a complete, commercially optimized book outline for:
- Genre: {request.genre} / {request.subgenre or 'general'}
- Target audience: {request.target_audience}
- Length: ~{request.page_count} pages
- Tone: {request.tone}
- Target keywords: {keywords_str}
- Language: {request.language}

The "chapters" array must include enough entries for the target length:
- Fiction: usually 20-25 chapters
- Non-fiction: usually 10-15 chapters

Return JSON with this exact structure:
{{
  "title": "Compelling, SEO-optimized title",
  "subtitle": "Optional subtitle that adds value and keywords",
  "tagline": "One powerful sentence that makes people want to read",
  "back_cover_description": "150-word compelling description that sells the book.",
  "chapters": [
    {{"number": 1, "title": "Chapter title", "summary": "2-3 sentence summary"}}
  ],
  "protagonist": {{"name": "Character name", "age": "30s", "core_conflict": "What they want vs what they fear"}},
  "themes": ["Theme 1", "Theme 2"],
  "amazon_categories": ["Kindle Store > Kindle eBooks > Romance > Paranormal"],
  "amazon_keywords": ["7 specific keywords for Amazon search"]
}}"""

    raw = await call_ai(prompt, request.ai_model, max_tokens=3200)
    data = extract_json_object(raw, "Failed to generate outline")
    return BookOutline(**data)


async def write_first_chapter(outline: BookOutline, request: BookRequest) -> str:
    ch1 = outline.chapters[0] if outline.chapters else {"title": "Chapter 1", "summary": ""}

    prompt = f"""You are a bestselling {request.genre} author. Write Chapter 1 of this book.

Book: \"{outline.title}\"
Tagline: {outline.tagline}
Chapter 1: \"{ch1['title']}\"
What should happen: {ch1['summary']}
Tone: {request.tone}
Target reader: {request.target_audience}

Rules:
1. Hook in the first sentence.
2. Introduce conflict/tension quickly.
3. Show voice through action and dialogue.
4. End with a hook into Chapter 2.
5. Avoid generic AI phrasing.
6. 2,500-3,500 words.

Write the full chapter now:"""

    return await call_ai(prompt, request.ai_model, max_tokens=4200)


async def write_full_book_chapters(outline: BookOutline, request: BookRequest, chapter_1_text: str) -> list[dict]:
    if not outline.chapters:
        return [{"number": 1, "title": "Chapter 1", "summary": "", "content": chapter_1_text}]

    generated = []
    generated.append(
        {
            "number": outline.chapters[0].get("number", 1),
            "title": outline.chapters[0].get("title", "Chapter 1"),
            "summary": outline.chapters[0].get("summary", ""),
            "content": chapter_1_text,
        }
    )

    for chapter in outline.chapters[1:]:
        chapter_number = chapter.get("number")
        chapter_title = chapter.get("title", f"Chapter {chapter_number}")
        chapter_summary = chapter.get("summary", "")
        previous_excerpt = generated[-1]["content"][-1200:]

        prompt = f"""Write a complete chapter for this book.

Book title: {outline.title}
Genre: {request.genre} / {request.subgenre or 'general'}
Tone: {request.tone}
Target audience: {request.target_audience}

Current chapter number: {chapter_number}
Current chapter title: {chapter_title}
Current chapter objective: {chapter_summary}

Previous chapter excerpt:
{previous_excerpt}

Rules:
1. Keep continuity.
2. Advance plot/knowledge.
3. End with momentum.
4. 900-1,400 words.

Write the full chapter now:"""

        chapter_content = await call_ai(prompt, request.ai_model, max_tokens=3000)
        generated.append(
            {
                "number": chapter_number,
                "title": chapter_title,
                "summary": chapter_summary,
                "content": chapter_content,
            }
        )

    return generated


async def generate_amazon_listing(outline: BookOutline, request: BookRequest) -> dict:
    prompt = f"""Create a complete Amazon KDP listing for:
Title: {outline.title}
Genre: {request.genre}
Description: {outline.back_cover_description}
Keywords: {', '.join(outline.amazon_keywords)}

Return JSON:
{{
  "title": "Exact title for KDP",
  "subtitle": "Subtitle if applicable",
  "description_html": "Amazon-ready HTML description",
  "keywords": ["keyword1", "keyword7"],
  "categories": ["Primary category", "Secondary category"],
  "price_ebook": 3.99,
  "price_paperback": 14.99,
  "age_range": "18+",
  "series_info": null
}}"""

    raw = await call_ai(prompt, request.ai_model, max_tokens=1600)
    try:
        return extract_json_object(raw, "Failed to generate listing")
    except HTTPException:
        return {}


def generate_cover_prompt(outline: BookOutline, request: BookRequest) -> str:
    styles = {
        "romance": "romantic couple, soft lighting, warm colors",
        "thriller": "dark atmosphere, silhouette, urban suspense",
        "fantasy": "magical landscape, vibrant colors",
        "self-help": "clean minimalist design, bold typography",
        "children": "bright colors, playful illustration",
        "mystery": "dark moody atmosphere, vintage aesthetic",
    }
    style = styles.get(request.genre.lower(), "professional book cover")

    return f"""Create a professional 6:9 book cover for \"{outline.title}\".
Style: {style}
Mood hook: {outline.tagline}
Audience: {request.target_audience}
Quality: high detail, print-ready, bestseller aesthetic."""


# ─── Auth + pipeline orchestration ───────────────────────────────────────────

async def get_authenticated_context(request: Request) -> tuple[dict[str, Any], dict[str, Any], PlanType]:
    token = parse_bearer_token(request)

    try:
        user = await verify_user_access_token(token)
        profile = await fetch_profile(user["id"])
    except SupabaseConfigError as exc:
        msg = str(exc)
        if "Unauthorized" in msg:
            raise HTTPException(status_code=401, detail="Unauthorized")
        raise HTTPException(status_code=500, detail=msg)

    if not profile:
        raise HTTPException(status_code=403, detail="Profile not found")

    plan = normalize_plan(profile.get("plan"))
    return user, profile, plan


async def run_generation_pipeline(
    request_data: BookRequest,
    user: dict[str, Any],
    profile: dict[str, Any],
    plan: PlanType,
    progress_callback: ProgressCallback = None,
) -> BookGenerationResult:
    credits = int(profile.get("credits_remaining") or 0)
    if credits <= 0:
        raise HTTPException(status_code=403, detail="No credits remaining. Upgrade plan in Settings.")

    generate_full_book, generate_cover_image, generate_audiobook = validate_requested_features(plan, request_data)

    generation_notes: list[str] = []

    if progress_callback:
        await progress_callback(5, "Creating generation job")

    draft_title = request_data.title_idea or "Generating book..."
    book_row = await insert_book(
        {
            "user_id": user["id"],
            "title": draft_title,
            "genre": request_data.genre,
            "subgenre": request_data.subgenre,
            "target_audience": request_data.target_audience,
            "status": "generating",
            "demand_score": request_data.demand_score,
            "estimated_revenue": request_data.estimated_revenue,
        }
    )
    book_id = book_row["id"]

    try:
        if progress_callback:
            await progress_callback(15, "Generating outline")
        outline = await generate_outline(request_data)

        if progress_callback:
            await progress_callback(30, "Writing chapter 1")
        chapter_1 = await write_first_chapter(outline, request_data)

        if progress_callback:
            await progress_callback(45, "Preparing Amazon listing")
        amazon_listing = await generate_amazon_listing(outline, request_data)
        cover_prompt = generate_cover_prompt(outline, request_data)

        full_chapters: Optional[list[dict]] = None
        if generate_full_book:
            if progress_callback:
                await progress_callback(60, "Generating full chapters")
            full_chapters = await write_full_book_chapters(outline, request_data, chapter_1)

        cover_image_base64: Optional[str] = None
        cover_image_mime_type: Optional[str] = None
        cover_image_url: Optional[str] = None

        if generate_cover_image:
            if progress_callback:
                await progress_callback(70, "Generating Gemini cover")
            try:
                cover_image_base64, cover_image_mime_type = await render_cover_image_with_gemini(cover_prompt)
            except Exception as exc:
                generation_notes.append(f"Cover generation skipped: {str(exc)}")

        audiobook_base64: Optional[str] = None
        audiobook_mime_type: Optional[str] = None
        audiobook_url: Optional[str] = None
        merged_audio: Optional[bytes] = None
        merged_mime: Optional[str] = None

        if generate_audiobook:
            if progress_callback:
                await progress_callback(78, "Generating audiobook")
            try:
                source_text = (
                    "\n\n".join(ch.get("content", "") for ch in (full_chapters or []) if ch.get("content"))
                    or chapter_1
                )
                merged_audio, merged_mime, segment_count = await synthesize_full_audiobook(source_text, request_data.voice_id)
                audiobook_base64 = None
                audiobook_mime_type = merged_mime
                generation_notes.append(f"Audiobook rendered from {segment_count} segment(s).")
            except Exception as exc:
                generation_notes.append(f"Audiobook generation skipped: {str(exc)}")
                merged_audio = None
                merged_mime = None

        if progress_callback:
            await progress_callback(85, "Building PDF/EPUB")

        export_chapters = full_chapters if full_chapters else outline.chapters
        export_request = ExportRequest(
            title=outline.title,
            subtitle=outline.subtitle,
            author=request_data.author_name,
            genre=request_data.genre,
            back_cover_description=outline.back_cover_description,
            chapters=export_chapters,
            chapter_1_content=chapter_1,
            amazon_listing=amazon_listing,
        )

        pdf_bytes = build_pdf(export_request)
        epub_bytes = build_epub(export_request)

        if progress_callback:
            await progress_callback(92, "Uploading files to storage")

        pdf_url = await upload_file(
            user_id=user["id"],
            book_id=book_id,
            filename=f"{safe_slug(outline.title)}.pdf",
            content=pdf_bytes,
            content_type="application/pdf",
        )

        epub_url = await upload_file(
            user_id=user["id"],
            book_id=book_id,
            filename=f"{safe_slug(outline.title)}.epub",
            content=epub_bytes,
            content_type="application/epub+zip",
        )

        if cover_image_base64:
            try:
                cover_binary = io.BytesIO(base64.b64decode(cover_image_base64)).getvalue()
                cover_ext = "png" if (cover_image_mime_type or "image/png").endswith("png") else "jpg"
                cover_image_url = await upload_file(
                    user_id=user["id"],
                    book_id=book_id,
                    filename=f"cover.{cover_ext}",
                    content=cover_binary,
                    content_type=cover_image_mime_type or "image/png",
                )
            except Exception as exc:
                generation_notes.append(f"Cover upload skipped: {str(exc)}")

        if generate_audiobook and merged_audio:
            try:
                audiobook_url = await upload_file(
                    user_id=user["id"],
                    book_id=book_id,
                    filename="audiobook_preview.mp3",
                    content=merged_audio,
                    content_type=merged_mime or "audio/mpeg",
                )
            except Exception as exc:
                generation_notes.append(f"Audiobook upload skipped: {str(exc)}")

        await update_book(
            book_id,
            {
                "title": outline.title,
                "status": "ready",
                "outline_json": outline.model_dump(),
                "chapter_1": chapter_1,
                "amazon_listing": amazon_listing,
                "cover_prompt": cover_prompt,
                "pdf_url": pdf_url,
                "epub_url": epub_url,
                "cover_image_url": cover_image_url,
                "audiobook_url": audiobook_url,
            },
        )

        remaining_credits = max(credits - 1, 0)
        await update_profile(user["id"], {"credits_remaining": remaining_credits})

        model_label = "GPT-5" if request_data.ai_model == "gpt-5" else "Claude Opus 4.6"

        notification_sent = False
        destination_email = request_data.recipient_email or user.get("email")
        if destination_email:
            try:
                notification_sent = await send_book_ready_email(
                    to_email=destination_email,
                    title=outline.title,
                    plan=plan,
                    model_label=model_label,
                    includes_full_book=bool(full_chapters),
                    includes_cover=bool(cover_image_url),
                    includes_audiobook=bool(audiobook_url),
                    pdf_url=pdf_url,
                    epub_url=epub_url,
                    cover_image_url=cover_image_url,
                    audiobook_url=audiobook_url,
                )
            except Exception as exc:
                generation_notes.append(f"Notification skipped: {str(exc)}")

        if progress_callback:
            await progress_callback(100, "Generation complete")

        return BookGenerationResult(
            outline=outline,
            chapter_1_preview=chapter_1,
            amazon_listing=amazon_listing,
            cover_prompt=cover_prompt,
            model_used=model_label,
            full_chapters=full_chapters,
            cover_image_base64=cover_image_base64,
            cover_image_mime_type=cover_image_mime_type,
            audiobook_base64=None,
            audiobook_mime_type=audiobook_mime_type,
            book_id=book_id,
            persisted=True,
            plan_used=plan,
            credits_remaining=remaining_credits,
            pdf_url=pdf_url,
            epub_url=epub_url,
            cover_image_url=cover_image_url,
            audiobook_url=audiobook_url,
            notification_sent=notification_sent,
            generation_notes=generation_notes,
        )

    except HTTPException:
        await update_book(book_id, {"status": "failed"})
        raise
    except Exception as exc:
        await update_book(book_id, {"status": "failed"})
        raise HTTPException(status_code=500, detail=f"Book generation failed: {str(exc)}")


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=BookGenerationResult)
async def generate_book(request_data: BookRequest, request: Request):
    user, profile, plan = await get_authenticated_context(request)
    return await run_generation_pipeline(request_data, user, profile, plan)


@router.post("/generate-async", response_model=JobCreateResponse)
async def generate_book_async(request_data: BookRequest, request: Request):
    user, profile, plan = await get_authenticated_context(request)

    job_id = str(uuid.uuid4())
    try:
        await insert_book_job(
            {
                "id": job_id,
                "user_id": user["id"],
                "status": "queued",
                "progress": 0,
                "step": "Queued",
                "request_json": request_data.model_dump(),
                "result_json": None,
                "error": None,
            }
        )
    except SupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    async def safe_patch(payload: dict[str, Any]) -> None:
        try:
            await update_book_job(job_id, payload)
        except SupabaseConfigError:
            pass

    async def progress(progress: int, step: str) -> None:
        await safe_patch({"status": "running", "progress": progress, "step": step})

    async def worker() -> None:
        try:
            result = await run_generation_pipeline(request_data, user, profile, plan, progress)
            await safe_patch(
                {
                    "status": "completed",
                    "progress": 100,
                    "step": "Done",
                    "result_json": result.model_dump(),
                    "error": None,
                },
            )
        except HTTPException as exc:
            await safe_patch(
                {
                    "status": "failed",
                    "error": str(exc.detail),
                },
            )
        except Exception as exc:
            await safe_patch(
                {
                    "status": "failed",
                    "error": str(exc),
                },
            )

    asyncio.create_task(worker())
    return JobCreateResponse(job_id=job_id, status="queued")


@router.get("/jobs/{job_id}")
async def get_book_job(job_id: str, request: Request):
    user, _, _ = await get_authenticated_context(request)

    try:
        job = await fetch_book_job(job_id, user["id"])
    except SupabaseConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "id": job["id"],
        "status": job["status"],
        "progress": job["progress"],
        "step": job.get("step"),
        "created_at": job.get("created_at"),
        "updated_at": job.get("updated_at"),
        "result": job.get("result_json"),
        "error": job.get("error"),
    }


@router.post("/outline-only", response_model=BookOutline)
async def generate_outline_only(request_data: BookRequest):
    return await generate_outline(request_data)


@router.post("/cover", response_model=CoverGenerationResult)
async def generate_cover_image(req: CoverGenerationRequest, request: Request):
    # Require auth so this endpoint can't be abused anonymously.
    await get_authenticated_context(request)

    try:
        image_base64, mime_type = await render_cover_image_with_gemini(req.prompt)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Cover generation failed: {str(exc)}")

    return CoverGenerationResult(image_base64=image_base64, mime_type=mime_type)


@router.post("/audiobook")
async def generate_audiobook(req: AudiobookRequest, request: Request):
    _, _, plan = await get_authenticated_context(request)
    if plan != "enterprise":
        raise HTTPException(status_code=403, detail="Audiobook generation requires Enterprise")

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        audio_bytes, mime_type, _ = await synthesize_full_audiobook(req.text, req.voice_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Audiobook generation failed: {str(exc)}")

    safe_title = safe_slug(req.title)
    filename = f"{safe_title}_audiobook_preview.mp3"

    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type=mime_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

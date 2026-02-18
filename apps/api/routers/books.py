"""
Book Generation Pipeline — orchestration for commercial book generation.
Supports outline, chapter drafting, cover image generation, email notifications,
and audiobook previews.
"""

import base64
import io
import json
import os
import re
from typing import Literal, Optional

import httpx
from anthropic import AsyncAnthropic
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from pydantic import BaseModel

router = APIRouter()
anthropic_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

GEMINI_IMAGE_MODEL = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "BOOKFORGE <onboarding@resend.dev>")
ELEVENLABS_DEFAULT_VOICE_ID = os.getenv("ELEVENLABS_DEFAULT_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")


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

    # plan-aware premium options
    plan: Literal["starter", "pro", "enterprise"] = "starter"
    generate_full_book: bool = False
    generate_cover_image: bool = False
    generate_audiobook: bool = False

    # optional communication/output settings
    recipient_email: Optional[str] = None
    author_name: str = "BOOKFORGE AI"
    voice_id: Optional[str] = None


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
    plan: Literal["starter", "pro", "enterprise"] = "starter"
    voice_id: Optional[str] = None


# ─── AI Helpers ───────────────────────────────────────────────────────────────

async def call_ai(prompt: str, ai_model: str, max_tokens: int = 3000) -> str:
    """Routes text generation to Claude or GPT-5."""
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


def extract_json_object(raw_text: str, fallback_error: str) -> dict:
    """Extract first JSON object from an LLM response."""
    json_match = re.search(r"\{[\s\S]*\}", raw_text)
    if not json_match:
        raise HTTPException(status_code=500, detail=fallback_error)
    return json.loads(json_match.group())


async def render_cover_image_with_gemini(prompt: str) -> tuple[str, str]:
    """Generate a cover image using Gemini image generation and return base64 + mime."""
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_IMAGE_MODEL}:generateContent"
    candidate_payloads = [
        {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
        },
        {"contents": [{"parts": [{"text": prompt}]}]},
    ]

    async with httpx.AsyncClient(timeout=90.0) as client:
        last_error = ""

        for payload in candidate_payloads:
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
                        return (
                            inline_data["data"],
                            inline_data.get("mimeType", "image/png"),
                        )

            last_error = "No inline image data returned by Gemini"

    raise RuntimeError(f"Gemini image generation failed: {last_error}")


async def synthesize_audiobook_with_elevenlabs(text: str, voice_id: Optional[str] = None) -> tuple[bytes, str]:
    """Generate audiobook audio bytes from text using ElevenLabs."""
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


async def send_book_ready_email(
    to_email: str,
    title: str,
    plan: str,
    model_label: str,
    includes_full_book: bool,
    includes_cover: bool,
    includes_audiobook: bool,
) -> bool:
    """Send a "book ready" notification email via Resend."""
    resend_api_key = os.getenv("RESEND_API_KEY")
    if not resend_api_key:
        return False

    premium_features = []
    if includes_full_book:
        premium_features.append("full chapter draft")
    if includes_cover:
        premium_features.append("cover image")
    if includes_audiobook:
        premium_features.append("audiobook preview")

    extras = ", ".join(premium_features) if premium_features else "standard generation package"

    html_body = f"""
    <div style=\"font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;\">
      <h2 style=\"margin:0 0 12px;color:#111827;\">Your BOOKFORGE book is ready</h2>
      <p style=\"color:#374151;line-height:1.6;\">Great news — <strong>{title}</strong> has finished generating.</p>
      <ul style=\"color:#374151;line-height:1.7;\">
        <li>Plan: <strong>{plan.capitalize()}</strong></li>
        <li>Model: <strong>{model_label}</strong></li>
        <li>Output: <strong>{extras}</strong></li>
      </ul>
      <p style=\"color:#6b7280;line-height:1.6;\">Open BOOKFORGE to download your files and continue publishing to Amazon KDP.</p>
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


# ─── Generation ───────────────────────────────────────────────────────────────

async def generate_outline(request: BookRequest) -> BookOutline:
    """Generate a complete commercially optimized outline."""
    keywords_str = ", ".join(request.keywords) if request.keywords else "none specified"

    prompt = f"""You are a bestselling author and Amazon KDP expert.

Create a complete, commercially optimized book outline for:
- Genre: {request.genre} / {request.subgenre or 'general'}
- Target audience: {request.target_audience}
- Length: ~{request.page_count} pages
- Tone: {request.tone}
- Target keywords: {keywords_str}
- Language: {request.language}

The outline must be designed to SELL on Amazon. Study what makes bestsellers work.
The "chapters" array must include enough entries for the target length:
- Fiction: usually 20-25 chapters
- Non-fiction: usually 10-15 chapters

Return JSON with this exact structure:
{{
  "title": "Compelling, SEO-optimized title",
  "subtitle": "Optional subtitle that adds value and keywords",
  "tagline": "One powerful sentence that makes people want to read",
  "back_cover_description": "150-word compelling description that sells the book. Use emotional hooks, raise questions, end with a call-to-read.",
  "chapters": [
    {{"number": 1, "title": "Chapter title", "summary": "What happens/is taught in 2-3 sentences"}}
  ],
  "protagonist": {{"name": "Character name", "age": "30s", "core_conflict": "What they want vs what they fear"}},
  "themes": ["Theme 1", "Theme 2"],
  "amazon_categories": ["Kindle Store > Kindle eBooks > Romance > Paranormal"],
  "amazon_keywords": ["7 specific keywords for Amazon search"]
}}"""

    raw = await call_ai(prompt, request.ai_model, max_tokens=3000)
    data = extract_json_object(raw, "Failed to generate outline")
    return BookOutline(**data)


async def write_first_chapter(outline: BookOutline, request: BookRequest) -> str:
    """Write full first chapter with a strong opening hook."""
    ch1 = outline.chapters[0] if outline.chapters else {"title": "Chapter 1", "summary": ""}

    prompt = f"""You are a bestselling {request.genre} author. Write Chapter 1 of this book.

Book: \"{outline.title}\"
Tagline: {outline.tagline}
Chapter 1: \"{ch1['title']}\"
What should happen: {ch1['summary']}
Tone: {request.tone}
Target reader: {request.target_audience}

CRITICAL RULES:
1. Hook the reader in the FIRST SENTENCE
2. Introduce conflict/tension quickly
3. Show character voice through action and dialogue
4. End with a hook into Chapter 2
5. Avoid generic AI phrasing
6. Target length: 2,500-3,500 words

Write the full chapter now:"""

    return await call_ai(prompt, request.ai_model, max_tokens=4000)


async def write_full_book_chapters(
    outline: BookOutline,
    request: BookRequest,
    chapter_1_text: str,
) -> list[dict]:
    """Generate full chapter drafts for all chapters (premium plans)."""
    if not outline.chapters:
        return [{"number": 1, "title": "Chapter 1", "summary": "", "content": chapter_1_text}]

    generated_chapters = []
    first_chapter_meta = outline.chapters[0]
    generated_chapters.append(
        {
            "number": first_chapter_meta.get("number", 1),
            "title": first_chapter_meta.get("title", "Chapter 1"),
            "summary": first_chapter_meta.get("summary", ""),
            "content": chapter_1_text,
        }
    )

    for chapter in outline.chapters[1:]:
        chapter_number = chapter.get("number")
        chapter_title = chapter.get("title", f"Chapter {chapter_number}")
        chapter_summary = chapter.get("summary", "")
        previous_excerpt = generated_chapters[-1]["content"][-1200:]

        prompt = f"""Write a complete chapter for this book.

Book title: {outline.title}
Genre: {request.genre} / {request.subgenre or 'general'}
Tone: {request.tone}
Target audience: {request.target_audience}

Current chapter number: {chapter_number}
Current chapter title: {chapter_title}
Current chapter objective: {chapter_summary}

Previous chapter excerpt (for continuity):
{previous_excerpt}

Rules:
1. Keep continuity with prior chapter events and tone.
2. Advance plot or knowledge clearly.
3. End with forward momentum.
4. Write 900-1,400 words.
5. Natural prose only, no meta comments.

Write the full chapter content now:"""

        chapter_content = await call_ai(prompt, request.ai_model, max_tokens=2800)
        generated_chapters.append(
            {
                "number": chapter_number,
                "title": chapter_title,
                "summary": chapter_summary,
                "content": chapter_content,
            }
        )

    return generated_chapters


async def generate_amazon_listing(outline: BookOutline, request: BookRequest) -> dict:
    """Generate Amazon KDP-ready listing metadata."""
    prompt = f"""Create a complete Amazon KDP listing for:
Title: {outline.title}
Genre: {request.genre}
Description: {outline.back_cover_description}
Keywords: {', '.join(outline.amazon_keywords)}

Return JSON:
{{
  "title": "Exact title for KDP",
  "subtitle": "Subtitle if applicable",
  "description_html": "Full description with <b>bold</b> and <br> tags for Amazon formatting, 400-600 words",
  "keywords": ["keyword1", "keyword7"],
  "categories": ["Primary category path", "Secondary category path"],
  "price_ebook": 3.99,
  "price_paperback": 14.99,
  "age_range": "18+",
  "series_info": null
}}"""

    raw = await call_ai(prompt, request.ai_model, max_tokens=1500)
    try:
        return extract_json_object(raw, "Failed to generate listing")
    except HTTPException:
        return {}


def generate_cover_prompt(outline: BookOutline, request: BookRequest) -> str:
    """Generate an image prompt optimized for Gemini cover rendering."""
    genre_styles = {
        "romance": "romantic couple, soft lighting, warm colors, elegant typography",
        "thriller": "dark atmosphere, silhouette, urban background, suspenseful mood",
        "fantasy": "magical landscape, vibrant colors, epic scale, mystical elements",
        "self-help": "clean minimalist design, bold typography, inspiring imagery",
        "children": "bright colors, cute illustration style, playful characters",
        "mystery": "dark moody atmosphere, shadows, vintage aesthetic",
    }

    style = genre_styles.get(request.genre.lower(), "professional book cover, high quality")

    return f"""Create a professional 6:9 book cover for \"{outline.title}\".
Style reference: {style}
Mood hook: {outline.tagline}
Audience: {request.target_audience}
Requirements: Bestseller-ready composition, title-safe spacing at top, author-safe spacing at bottom,
high contrast focal point, print-quality detail."""


def build_audiobook_script(outline: BookOutline, chapter_1: str, full_chapters: Optional[list[dict]]) -> str:
    """Build text input for audiobook synthesis."""
    if full_chapters:
        compiled = "\n\n".join(ch.get("content", "") for ch in full_chapters if ch.get("content"))
    else:
        compiled = chapter_1

    intro = f"{outline.title}. {outline.tagline}\n\n"
    return intro + compiled


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=BookGenerationResult)
async def generate_book(request: BookRequest):
    """End-to-end generation pipeline with optional premium outputs by plan."""
    if request.generate_full_book and request.plan == "starter":
        raise HTTPException(status_code=403, detail="Full chapter generation requires Pro or Enterprise")

    if request.generate_cover_image and request.plan == "starter":
        raise HTTPException(status_code=403, detail="Cover image generation requires Pro or Enterprise")

    if request.generate_audiobook and request.plan != "enterprise":
        raise HTTPException(status_code=403, detail="Audiobook generation requires Enterprise")

    generation_notes: list[str] = []

    outline = await generate_outline(request)
    chapter_1 = await write_first_chapter(outline, request)
    amazon_listing = await generate_amazon_listing(outline, request)
    cover_prompt = generate_cover_prompt(outline, request)

    full_chapters: Optional[list[dict]] = None
    if request.generate_full_book:
        full_chapters = await write_full_book_chapters(outline, request, chapter_1)

    cover_image_base64: Optional[str] = None
    cover_image_mime_type: Optional[str] = None
    if request.generate_cover_image:
        try:
            cover_image_base64, cover_image_mime_type = await render_cover_image_with_gemini(cover_prompt)
        except Exception as exc:
            generation_notes.append(f"Cover generation skipped: {str(exc)}")

    audiobook_base64: Optional[str] = None
    audiobook_mime_type: Optional[str] = None
    if request.generate_audiobook:
        try:
            script = build_audiobook_script(outline, chapter_1, full_chapters)
            max_chars = 4500
            if len(script) > max_chars:
                script = script[:max_chars]
                generation_notes.append("Audiobook preview text was truncated to provider limit.")
            audio_bytes, audio_mime = await synthesize_audiobook_with_elevenlabs(script, request.voice_id)
            audiobook_base64 = base64.b64encode(audio_bytes).decode("utf-8")
            audiobook_mime_type = audio_mime
        except Exception as exc:
            generation_notes.append(f"Audiobook generation skipped: {str(exc)}")

    model_label = "GPT-5" if request.ai_model == "gpt-5" else "Claude Opus 4.6"

    notification_sent = False
    if request.recipient_email:
        try:
            notification_sent = await send_book_ready_email(
                to_email=request.recipient_email,
                title=outline.title,
                plan=request.plan,
                model_label=model_label,
                includes_full_book=bool(full_chapters),
                includes_cover=bool(cover_image_base64),
                includes_audiobook=bool(audiobook_base64),
            )
        except Exception as exc:
            generation_notes.append(f"Notification skipped: {str(exc)}")

    return BookGenerationResult(
        outline=outline,
        chapter_1_preview=chapter_1,
        amazon_listing=amazon_listing,
        cover_prompt=cover_prompt,
        model_used=model_label,
        full_chapters=full_chapters,
        cover_image_base64=cover_image_base64,
        cover_image_mime_type=cover_image_mime_type,
        audiobook_base64=audiobook_base64,
        audiobook_mime_type=audiobook_mime_type,
        notification_sent=notification_sent,
        generation_notes=generation_notes,
    )


@router.post("/outline-only", response_model=BookOutline)
async def generate_outline_only(request: BookRequest):
    """Generate only the book outline (fast preview mode)."""
    return await generate_outline(request)


@router.post("/cover", response_model=CoverGenerationResult)
async def generate_cover_image(req: CoverGenerationRequest):
    """Generate a cover image from a prompt using Gemini image generation."""
    try:
        image_base64, mime_type = await render_cover_image_with_gemini(req.prompt)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Cover generation failed: {str(exc)}")

    return CoverGenerationResult(image_base64=image_base64, mime_type=mime_type)


@router.post("/audiobook")
async def generate_audiobook(req: AudiobookRequest):
    """Generate an audiobook preview MP3 (Enterprise plan only)."""
    if req.plan != "enterprise":
        raise HTTPException(status_code=403, detail="Audiobook generation requires Enterprise")

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    text = req.text
    max_chars = 4500
    if len(text) > max_chars:
        text = text[:max_chars]

    try:
        audio_bytes, mime_type = await synthesize_audiobook_with_elevenlabs(text, req.voice_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Audiobook generation failed: {str(exc)}")

    safe_title = re.sub(r"[^\w\s-]", "", req.title).strip().replace(" ", "_")[:60] or "bookforge"
    filename = f"{safe_title}_audiobook_preview.mp3"

    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type=mime_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

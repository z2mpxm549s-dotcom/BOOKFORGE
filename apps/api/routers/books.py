"""
Book Generation Pipeline — orquesta múltiples AIs para generar
libros completos, optimizados para vender.
"""

import os
import json
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from anthropic import AsyncAnthropic

router = APIRouter()
client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


# ─── Models ───────────────────────────────────────────────────────────────────

class BookRequest(BaseModel):
    genre: str
    subgenre: Optional[str] = None
    title_idea: Optional[str] = None
    target_audience: str = "adults"
    page_count: int = 200
    tone: str = "engaging"               # "engaging", "literary", "commercial", "educational"
    keywords: list[str] = []
    language: str = "en"


class BookOutline(BaseModel):
    title: str
    subtitle: Optional[str]
    tagline: str                         # 1-sentence hook
    back_cover_description: str          # 150-word sales description
    chapters: list[dict]                 # [{"number": 1, "title": "...", "summary": "..."}]
    protagonist: Optional[dict]          # For fiction
    themes: list[str]
    amazon_categories: list[str]
    amazon_keywords: list[str]


class BookGenerationResult(BaseModel):
    outline: BookOutline
    chapter_1_preview: str               # Full first chapter as preview
    amazon_listing: dict                 # Ready-to-publish Amazon KDP data
    cover_prompt: str                    # Prompt to send to Recraft for cover image


# ─── Generation ───────────────────────────────────────────────────────────────

async def generate_outline(request: BookRequest) -> BookOutline:
    """Genera estructura completa del libro optimizada para Amazon."""

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

Return JSON with this exact structure:
{{
  "title": "Compelling, SEO-optimized title",
  "subtitle": "Optional subtitle that adds value and keywords",
  "tagline": "One powerful sentence that makes people want to read",
  "back_cover_description": "150-word compelling description that sells the book. Use emotional hooks, raise questions, end with a call-to-read.",
  "chapters": [
    {{"number": 1, "title": "Chapter title", "summary": "What happens/is taught in 2-3 sentences"}},
    ...include all chapters for {request.page_count} pages (~20-25 chapters for fiction, 10-15 for non-fiction
  ],
  "protagonist": {{"name": "Character name", "age": "30s", "core_conflict": "What they want vs what they fear"}},
  "themes": ["Theme 1", "Theme 2"],
  "amazon_categories": ["Kindle Store > Kindle eBooks > Romance > Paranormal"],
  "amazon_keywords": ["7 specific keywords for Amazon search"]
}}"""

    message = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text
    json_match = re.search(r'\{[\s\S]*\}', raw)
    if not json_match:
        raise HTTPException(status_code=500, detail="Failed to generate outline")

    data = json.loads(json_match.group())
    return BookOutline(**data)


async def write_first_chapter(outline: BookOutline, request: BookRequest) -> str:
    """Escribe el primer capítulo completo — el más importante para enganchar."""

    ch1 = outline.chapters[0] if outline.chapters else {"title": "Chapter 1", "summary": ""}

    prompt = f"""You are a bestselling {request.genre} author. Write Chapter 1 of this book.

Book: "{outline.title}"
Tagline: {outline.tagline}
Chapter 1: "{ch1['title']}"
What should happen: {ch1['summary']}
Tone: {request.tone}
Target reader: {request.target_audience}

CRITICAL RULES:
1. Hook the reader in the FIRST SENTENCE — no slow starts
2. Introduce conflict or tension within the first page
3. Show character personality through action, not description
4. End the chapter with a hook that FORCES them to read Chapter 2
5. Write like a human author — varied sentence lengths, authentic voice, emotional depth
6. Target length: 2,500-3,500 words
7. NO AI-sounding phrases like "In this chapter we will explore..."

Write the full chapter now:"""

    message = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )

    return message.content[0].text


async def generate_amazon_listing(outline: BookOutline, request: BookRequest) -> dict:
    """Genera el listing completo listo para publicar en Amazon KDP."""

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
  "keywords": ["keyword1", ..., "keyword7"],
  "categories": ["Primary category path", "Secondary category path"],
  "price_ebook": 3.99,
  "price_paperback": 14.99,
  "age_range": "18+",
  "series_info": null
}}"""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text
    json_match = re.search(r'\{[\s\S]*\}', raw)
    if json_match:
        return json.loads(json_match.group())
    return {}


def generate_cover_prompt(outline: BookOutline, request: BookRequest) -> str:
    """Genera el prompt óptimo para Recraft/Midjourney para la portada."""

    genre_styles = {
        "romance": "romantic couple, soft lighting, warm colors, elegant typography",
        "thriller": "dark atmosphere, silhouette, urban background, suspenseful mood",
        "fantasy": "magical landscape, vibrant colors, epic scale, mystical elements",
        "self-help": "clean minimalist design, bold typography, inspiring imagery",
        "children": "bright colors, cute illustration style, playful characters",
        "mystery": "dark moody atmosphere, shadows, vintage aesthetic",
    }

    style = genre_styles.get(request.genre.lower(), "professional book cover, high quality")

    return f"""Professional book cover design for "{outline.title}".
Style: {style}.
Mood: {outline.tagline}.
Design: Modern, commercially appealing, Amazon bestseller aesthetic.
Text overlay space: Leave top 20% for title, bottom 15% for author name.
Aspect ratio: 6:9 (standard book cover).
Quality: Ultra high resolution, print-ready."""


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=BookGenerationResult)
async def generate_book(request: BookRequest):
    """
    Pipeline completo: genera outline + capítulo 1 + Amazon listing + cover prompt.
    Todo listo para publicar.
    """
    # Step 1: Generate outline
    outline = await generate_outline(request)

    # Step 2: Write first chapter (the hook)
    chapter_1 = await write_first_chapter(outline, request)

    # Step 3: Amazon listing
    amazon_listing = await generate_amazon_listing(outline, request)

    # Step 4: Cover prompt for Recraft
    cover_prompt = generate_cover_prompt(outline, request)

    return BookGenerationResult(
        outline=outline,
        chapter_1_preview=chapter_1,
        amazon_listing=amazon_listing,
        cover_prompt=cover_prompt,
    )


@router.post("/outline-only", response_model=BookOutline)
async def generate_outline_only(request: BookRequest):
    """Solo genera el outline — más rápido, para previsualizar antes de generar todo."""
    return await generate_outline(request)

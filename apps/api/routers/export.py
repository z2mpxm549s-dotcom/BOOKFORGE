"""
Export Pipeline — generates PDF and EPUB from book data.
Serves downloadable files as streaming responses.
"""

import io
import os
import re
import tempfile
import html
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from ebooklib import epub

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, HRFlowable
)
from reportlab.platypus import KeepTogether

router = APIRouter()

# ─── Request Models ───────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    title: str
    subtitle: Optional[str] = None
    author: str = "BOOKFORGE AI"
    genre: Optional[str] = None
    back_cover_description: Optional[str] = None
    chapters: list[dict] = []          # [{"number": 1, "title": "...", "content": "..."}]
    chapter_1_content: Optional[str] = None   # Full text of chapter 1
    amazon_listing: Optional[dict] = None


# ─── PDF Styles ───────────────────────────────────────────────────────────────

def build_styles():
    base = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "BookTitle",
        parent=base["Title"],
        fontSize=28,
        spaceAfter=12,
        textColor=colors.HexColor("#1a1a2e"),
        alignment=TA_CENTER,
        leading=34,
        fontName="Helvetica-Bold",
    )

    subtitle_style = ParagraphStyle(
        "BookSubtitle",
        parent=base["Normal"],
        fontSize=14,
        spaceAfter=6,
        textColor=colors.HexColor("#444466"),
        alignment=TA_CENTER,
        leading=18,
        fontName="Helvetica",
    )

    author_style = ParagraphStyle(
        "BookAuthor",
        parent=base["Normal"],
        fontSize=12,
        spaceAfter=4,
        textColor=colors.HexColor("#666688"),
        alignment=TA_CENTER,
        fontName="Helvetica-Oblique",
    )

    chapter_title_style = ParagraphStyle(
        "ChapterTitle",
        parent=base["Heading1"],
        fontSize=20,
        spaceBefore=20,
        spaceAfter=16,
        textColor=colors.HexColor("#1a1a2e"),
        alignment=TA_LEFT,
        fontName="Helvetica-Bold",
        leading=26,
    )

    chapter_num_style = ParagraphStyle(
        "ChapterNumber",
        parent=base["Normal"],
        fontSize=10,
        spaceBefore=0,
        spaceAfter=4,
        textColor=colors.HexColor("#9999bb"),
        alignment=TA_LEFT,
        fontName="Helvetica",
        leading=14,
    )

    body_style = ParagraphStyle(
        "BookBody",
        parent=base["Normal"],
        fontSize=11,
        leading=18,
        spaceAfter=10,
        textColor=colors.HexColor("#1c1c1c"),
        alignment=TA_JUSTIFY,
        fontName="Helvetica",
        firstLineIndent=20,
    )

    description_style = ParagraphStyle(
        "Description",
        parent=base["Normal"],
        fontSize=10,
        leading=16,
        spaceAfter=8,
        textColor=colors.HexColor("#333355"),
        alignment=TA_JUSTIFY,
        fontName="Helvetica-Oblique",
    )

    section_label_style = ParagraphStyle(
        "SectionLabel",
        parent=base["Normal"],
        fontSize=8,
        spaceAfter=6,
        textColor=colors.HexColor("#aaaacc"),
        alignment=TA_CENTER,
        fontName="Helvetica",
    )

    return {
        "title": title_style,
        "subtitle": subtitle_style,
        "author": author_style,
        "chapter_title": chapter_title_style,
        "chapter_num": chapter_num_style,
        "body": body_style,
        "description": description_style,
        "section_label": section_label_style,
    }


def paragraphs_from_text(text: str, style) -> list:
    """Split raw text into Paragraph objects, one per paragraph."""
    result = []
    for para in text.strip().split("\n\n"):
        para = para.strip()
        if not para:
            continue
        # Escape HTML chars that ReportLab would misparse
        para = para.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        result.append(Paragraph(para, style))
    return result


def html_paragraphs_from_text(text: str) -> str:
    """Convert raw text blocks into HTML paragraphs for EPUB."""
    blocks = []
    for para in text.strip().split("\n\n"):
        para = para.strip()
        if not para:
            continue
        blocks.append(f"<p>{html.escape(para)}</p>")
    return "".join(blocks)


# ─── PDF Builder ──────────────────────────────────────────────────────────────

def build_pdf(req: ExportRequest) -> bytes:
    buffer = io.BytesIO()
    styles = build_styles()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=3 * cm,
        leftMargin=3 * cm,
        topMargin=3 * cm,
        bottomMargin=3 * cm,
        title=req.title,
        author=req.author,
        subject=req.genre or "Book",
    )

    story = []

    # ── Cover Page ──
    story.append(Spacer(1, 3 * cm))
    story.append(Paragraph(req.title, styles["title"]))

    if req.subtitle:
        story.append(Paragraph(req.subtitle, styles["subtitle"]))

    story.append(Spacer(1, 1 * cm))
    story.append(HRFlowable(width="60%", thickness=1, color=colors.HexColor("#ccccee"), hAlign="CENTER"))
    story.append(Spacer(1, 0.6 * cm))

    if req.genre:
        story.append(Paragraph(req.genre.upper(), styles["section_label"]))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(req.author, styles["author"]))

    story.append(Spacer(1, 3 * cm))

    if req.back_cover_description:
        story.append(HRFlowable(width="80%", thickness=0.5, color=colors.HexColor("#ddddee"), hAlign="CENTER"))
        story.append(Spacer(1, 0.8 * cm))
        story.append(Paragraph("ABOUT THIS BOOK", styles["section_label"]))
        story.append(Spacer(1, 0.3 * cm))
        for p in paragraphs_from_text(req.back_cover_description, styles["description"]):
            story.append(p)

    story.append(PageBreak())

    # ── Chapter 1 (full content) ──
    if req.chapter_1_content:
        ch_title = req.chapters[0].get("title", "Chapter 1") if req.chapters else "Chapter 1"
        story.append(Paragraph("CHAPTER 1", styles["chapter_num"]))
        story.append(Paragraph(ch_title, styles["chapter_title"]))
        story.append(Spacer(1, 0.5 * cm))
        story.append(HRFlowable(width="30%", thickness=1, color=colors.HexColor("#ccccee"), hAlign="LEFT"))
        story.append(Spacer(1, 0.8 * cm))

        for p in paragraphs_from_text(req.chapter_1_content, styles["body"]):
            story.append(p)

        story.append(PageBreak())

    # ── Remaining chapters (summaries as placeholders) ──
    for ch in req.chapters[1:]:
        num = ch.get("number", "")
        title = ch.get("title", "")
        summary = ch.get("summary", "")
        content = ch.get("content", "")

        story.append(Paragraph(f"CHAPTER {num}", styles["chapter_num"]))
        story.append(Paragraph(title, styles["chapter_title"]))
        story.append(Spacer(1, 0.5 * cm))
        story.append(HRFlowable(width="30%", thickness=1, color=colors.HexColor("#ccccee"), hAlign="LEFT"))
        story.append(Spacer(1, 0.8 * cm))

        if content:
            for p in paragraphs_from_text(content, styles["body"]):
                story.append(p)
        elif summary:
            story.append(Paragraph(f"[Summary] {summary}", styles["description"]))

        story.append(PageBreak())

    doc.build(story)
    return buffer.getvalue()


def build_epub(req: ExportRequest) -> bytes:
    """Build a valid EPUB 3.0 file from book data."""
    safe_id = re.sub(r"[^\w-]", "-", req.title.lower())[:80] or "bookforge-book"

    book = epub.EpubBook()
    book.set_identifier(f"bookforge-{safe_id}")
    book.set_title(req.title)
    book.set_language("en")
    book.add_author(req.author)

    if req.genre:
        book.add_metadata("DC", "subject", req.genre)

    intro = epub.EpubHtml(title="About This Book", file_name="about.xhtml", lang="en")
    intro_body = req.back_cover_description or "Generated with BOOKFORGE."
    intro.content = f"""
    <html>
      <head><title>About This Book</title></head>
      <body>
        <h1>{html.escape(req.title)}</h1>
        {"<h2>" + html.escape(req.subtitle) + "</h2>" if req.subtitle else ""}
        <p><em>{html.escape(req.author)}</em></p>
        <hr />
        {html_paragraphs_from_text(intro_body)}
      </body>
    </html>
    """

    chapter_items = [intro]
    book.add_item(intro)

    raw_chapters = list(req.chapters) if req.chapters else []
    if req.chapter_1_content:
        chapter_1_title = (
            raw_chapters[0].get("title", "Chapter 1") if raw_chapters else "Chapter 1"
        )
        chapter_1_number = raw_chapters[0].get("number", 1) if raw_chapters else 1
        raw_chapters = [
            {
                "number": chapter_1_number,
                "title": chapter_1_title,
                "content": req.chapter_1_content,
            },
            *raw_chapters[1:],
        ]
    elif not raw_chapters:
        raw_chapters = [{"number": 1, "title": "Chapter 1", "content": "Chapter content goes here."}]

    for idx, chapter in enumerate(raw_chapters, start=1):
        chapter_number = chapter.get("number", idx)
        chapter_title = chapter.get("title", f"Chapter {chapter_number}")
        chapter_content = chapter.get("content")
        if not chapter_content:
            chapter_summary = chapter.get("summary", "No content available.")
            chapter_content = f"[Summary] {chapter_summary}"

        chapter_item = epub.EpubHtml(
            title=str(chapter_title),
            file_name=f"chapter-{idx:02d}.xhtml",
            lang="en",
        )
        chapter_item.content = f"""
        <html>
          <head><title>{html.escape(str(chapter_title))}</title></head>
          <body>
            <h1>Chapter {html.escape(str(chapter_number))}</h1>
            <h2>{html.escape(str(chapter_title))}</h2>
            {html_paragraphs_from_text(str(chapter_content))}
          </body>
        </html>
        """
        book.add_item(chapter_item)
        chapter_items.append(chapter_item)

    nav_css = epub.EpubItem(
        uid="style_nav",
        file_name="style/nav.css",
        media_type="text/css",
        content="""
          body { font-family: Georgia, serif; line-height: 1.55; margin: 5%; }
          h1 { font-size: 1.8em; margin-bottom: 0.4em; }
          h2 { font-size: 1.2em; margin-bottom: 1.2em; color: #444; }
          p { margin: 0 0 1em; text-align: justify; }
          em { color: #666; }
        """,
    )
    book.add_item(nav_css)

    book.toc = tuple(chapter_items)
    book.spine = ["nav", *chapter_items]
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())

    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as tmp:
            temp_path = tmp.name
        epub.write_epub(temp_path, book, {})
        with open(temp_path, "rb") as generated:
            return generated.read()
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/pdf")
async def export_pdf(req: ExportRequest):
    """
    Generate a PDF from book data.
    Returns a downloadable PDF file.
    """
    try:
        pdf_bytes = build_pdf(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    safe_title = re.sub(r"[^\w\s-]", "", req.title).strip().replace(" ", "_")[:60]
    filename = f"{safe_title}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/epub")
async def export_epub(req: ExportRequest):
    """
    Generate an EPUB file from book data.
    Returns a downloadable EPUB file.
    """
    try:
        epub_bytes = build_epub(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"EPUB generation failed: {str(e)}")

    safe_title = re.sub(r"[^\w\s-]", "", req.title).strip().replace(" ", "_")[:60]
    filename = f"{safe_title}.epub"

    return StreamingResponse(
        io.BytesIO(epub_bytes),
        media_type="application/epub+zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

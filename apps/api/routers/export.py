"""
Export Pipeline — generates PDF and EPUB from book data.
Serves downloadable files as streaming responses.
"""

import io
import re
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

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

# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""One place to call Claude through the Anthropic link (Admin -> API keys): used by the donation texts and the fake-users tool."""

"""The AI use as a PDF (landscape A4, in the house style of Easy2edit): a summary, or with detail a complete list of every call with tokens in and out and the costs."""
import io
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

from django.conf import settings

ORANGE, GREY, DARK = "#f2823f", "#939497", "#2b2b2d"
SYMBOL = {"EUR": "€", "USD": "$", "GBP": "£"}


def money(v, cur):
    v = float(v or 0)
    s = f"{v:,.2f}" if abs(v) >= 1 or v == 0 else f"{v:,.4f}"
    return f"{SYMBOL.get(cur, cur + ' ')}{s.replace(',', 'X').replace('.', ',').replace('X', '.')}"


def num(v):
    return f"{int(v or 0):,}".replace(",", ".")


def build(title, subtitle, sections, site="", note=""):
    """sections = [{"heading", "head": [..], "rows": [[..]], "right": [column numbers that are numbers], "total": [..] or None, "widths": [relative widths] or None}]; returns the PDF (bytes)."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    size = landscape(A4)
    W = size[0] - 30 * mm
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=size, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm, bottomMargin=16 * mm, title=title, author="Easy2edit")
    st = lambda **k: ParagraphStyle("x", fontName=k.pop("font", "Helvetica"), **k)  # noqa: E731
    h1 = st(fontSize=22, leading=26, textColor=colors.HexColor(DARK), font="Helvetica-Bold")
    h2 = st(fontSize=12, leading=16, textColor=colors.HexColor(ORANGE), font="Helvetica-Bold", spaceBefore=12, spaceAfter=4)
    body = st(fontSize=9, leading=12, textColor=colors.HexColor(DARK))
    cell = st(fontSize=7.5, leading=9.5, textColor=colors.HexColor(DARK))
    cellr = st(fontSize=7.5, leading=9.5, textColor=colors.HexColor(DARK), alignment=2)
    headc = st(fontSize=7, leading=9, textColor=colors.white, font="Helvetica-Bold")
    headr = st(fontSize=7, leading=9, textColor=colors.white, font="Helvetica-Bold", alignment=2)
    small = st(fontSize=8, leading=11, textColor=colors.HexColor(GREY))
    story = []
    logo = Path(settings.BASE_DIR).parent / "frontend" / "public" / "logos" / "easy2edit" / "logo.png"
    head = [Image(str(logo), width=42 * mm, height=42 * mm * 162 / 461) if logo.is_file() else Paragraph("<b>easy2edit</b>", h1),
            Paragraph(f"<para align='right'><font color='{GREY}'>{date.today().strftime('%d-%m-%Y')}</font></para>", body)]
    tb = Table([head], colWidths=[W * 0.6, W * 0.4])
    tb.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LINEBELOW", (0, 0), (-1, 0), 2.5, colors.HexColor(ORANGE)), ("BOTTOMPADDING", (0, 0), (-1, 0), 8)]))
    story += [tb, Spacer(1, 6 * mm), Paragraph(escape(title), h1), Paragraph(escape(subtitle) + (f" · {escape(site)}" if site else ""), small)]
    for sec in sections:
        story.append(Paragraph(escape(sec["heading"]), h2))
        right = set(sec.get("right") or [])
        rows = [[Paragraph(escape(str(c)), headr if i in right else headc) for i, c in enumerate(sec["head"])]]
        for r in sec["rows"]:
            rows.append([Paragraph(escape(str(c)), cellr if i in right else cell) for i, c in enumerate(r)])
        if sec.get("total"):
            b = lambda c, i: Paragraph(f"<b>{escape(str(c))}</b>", cellr if i in right else cell)  # noqa: E731
            rows.append([b(c, i) for i, c in enumerate(sec["total"])])
        if len(rows) == 1:
            story.append(Paragraph("–", small))
            continue
        w = sec.get("widths") or [1] * len(sec["head"])
        t = Table(rows, colWidths=[W * x / sum(w) for x in w], repeatRows=1)
        style = [("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(DARK)), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f6f6f7")]),
                 ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#e3e3e5")), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3), ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4)]
        if sec.get("total"):
            style.append(("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor(DARK)))
        t.setStyle(TableStyle(style))
        story.append(t)
    if note:
        story += [Spacer(1, 4 * mm), Paragraph(escape(note), small)]

    def footer(canvas, d):
        canvas.saveState()
        canvas.setFillColor(colors.HexColor(ORANGE))
        canvas.rect(0, 0, size[0], 4 * mm, stroke=0, fill=1)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor(GREY))
        canvas.drawString(15 * mm, 9 * mm, "Easy2edit · AI-gebruik")
        canvas.drawRightString(size[0] - 15 * mm, 9 * mm, f"{d.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()

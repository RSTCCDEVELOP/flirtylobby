# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""De prijsofferte als PDF in de huisstijl van Easy2edit (oranje en grijs, met het logo), in de gekozen taal."""
import io
from datetime import date
from decimal import Decimal
from pathlib import Path

from django.conf import settings

ORANGE, GREY, DARK, LIGHT = "#f2823f", "#939497", "#2b2b2d", "#f6f6f7"

T = {
    "nl": {"title": "Offerte", "for": "Voor", "site": "Website", "date": "Datum", "valid": "Deze offerte is 30 dagen geldig.", "what": "Wat je krijgt", "modules": "modules", "plugins": "plugins", "monthly": "Per maand",
           "total": "Totaal per maand", "choose": "Kies je looptijd", "month": "Per maand", "quarter": "Per kwartaal", "year": "Per jaar", "discount": "korting", "per_month": "per maand", "vat": "incl. btw",
           "impl": "Ontwerp en implementatie (eenmalig, inschatting)", "hours": "uur", "note": "Alle prijzen zijn exclusief btw, tenzij anders vermeld, en inclusief domeinnaam. Hoe langer je afsluit, hoe lager de prijs. De implementatie is een inschatting.", "chosen": "Gekozen looptijd", "contact": "Vragen? Neem contact met ons op."},
    "en": {"title": "Quotation", "for": "For", "site": "Website", "date": "Date", "valid": "This quotation is valid for 30 days.", "what": "What you get", "modules": "modules", "plugins": "plugins", "monthly": "Per month",
           "total": "Total per month", "choose": "Choose your term", "month": "Monthly", "quarter": "Quarterly", "year": "Yearly", "discount": "discount", "per_month": "per month", "vat": "incl. VAT",
           "impl": "Design and implementation (one-off, estimate)", "hours": "hours", "note": "All prices exclude VAT unless stated otherwise and include the domain name. The longer you commit, the lower the price. The implementation is an estimate.", "chosen": "Chosen term", "contact": "Questions? Please contact us."},
    "de": {"title": "Angebot", "for": "Für", "site": "Website", "date": "Datum", "valid": "Dieses Angebot ist 30 Tage gültig.", "what": "Was Sie bekommen", "modules": "Module", "plugins": "Plugins", "monthly": "Pro Monat",
           "total": "Gesamt pro Monat", "choose": "Wählen Sie Ihre Laufzeit", "month": "Monatlich", "quarter": "Vierteljährlich", "year": "Jährlich", "discount": "Rabatt", "per_month": "pro Monat", "vat": "inkl. MwSt.",
           "impl": "Design und Umsetzung (einmalig, Schätzung)", "hours": "Std.", "note": "Alle Preise verstehen sich ohne MwSt., sofern nicht anders angegeben, und inklusive Domainname. Je länger die Laufzeit, desto niedriger der Preis. Die Umsetzung ist eine Schätzung.", "chosen": "Gewählte Laufzeit", "contact": "Fragen? Sprechen Sie uns an."},
    "fr": {"title": "Devis", "for": "Pour", "site": "Site web", "date": "Date", "valid": "Ce devis est valable 30 jours.", "what": "Ce que vous obtenez", "modules": "modules", "plugins": "extensions", "monthly": "Par mois",
           "total": "Total par mois", "choose": "Choisissez votre durée", "month": "Mensuel", "quarter": "Trimestriel", "year": "Annuel", "discount": "remise", "per_month": "par mois", "vat": "TVA incl.",
           "impl": "Conception et mise en place (unique, estimation)", "hours": "h", "note": "Tous les prix sont hors TVA sauf mention contraire et incluent le nom de domaine. Plus la durée est longue, plus le prix est bas. La mise en place est une estimation.", "chosen": "Durée choisie", "contact": "Des questions ? Contactez-nous."},
    "es": {"title": "Presupuesto", "for": "Para", "site": "Sitio web", "date": "Fecha", "valid": "Este presupuesto es válido durante 30 días.", "what": "Qué obtienes", "modules": "módulos", "plugins": "plugins", "monthly": "Al mes",
           "total": "Total al mes", "choose": "Elige tu plazo", "month": "Mensual", "quarter": "Trimestral", "year": "Anual", "discount": "descuento", "per_month": "al mes", "vat": "IVA incl.",
           "impl": "Diseño e implementación (única vez, estimación)", "hours": "h", "note": "Todos los precios no incluyen IVA salvo indicación contraria e incluyen el nombre de dominio. Cuanto más largo el plazo, menor el precio. La implementación es una estimación.", "chosen": "Plazo elegido", "contact": "¿Preguntas? Contáctanos."},
}
LANGS = {"nl": "Nederlands", "en": "English", "de": "Deutsch", "fr": "Français", "es": "Español"}


def eur(v):
    s = f"{Decimal(str(v)):,.2f}"
    return "€ " + s.replace(",", "X").replace(".", ",").replace("X", ".")


def build(plan, name, site, period, lang="nl", host=None, mail=None, reseller=None):
    """The PDF (bytes). plan = what pricing.plan() returns."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    t = T.get(lang, T["nl"])
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=20 * mm, title=f"{t['title']} {site}", author="Easy2edit")
    st = lambda **k: ParagraphStyle("x", fontName=k.pop("font", "Helvetica"), **k)  # noqa: E731
    h1, h2, body, small = st(fontSize=26, leading=30, textColor=colors.HexColor(DARK), font="Helvetica-Bold"), st(fontSize=13, leading=17, textColor=colors.HexColor(ORANGE), font="Helvetica-Bold", spaceBefore=14, spaceAfter=6), st(fontSize=10, leading=14, textColor=colors.HexColor(DARK)), st(fontSize=8.5, leading=12, textColor=colors.HexColor(GREY))
    story = []
    logo = Path(settings.BASE_DIR).parent / "frontend" / "public" / "logos" / "easy2edit" / "logo.png"
    head = []
    if logo.is_file():
        head.append(Image(str(logo), width=48 * mm, height=48 * mm * 162 / 461))
    else:
        head.append(Paragraph("<b>easy2edit</b>", h1))
    head.append(Paragraph(f"<para align='right'><font color='{GREY}'>{t['date']}: {date.today().strftime('%d-%m-%Y')}</font></para>", body))
    tb = Table([head], colWidths=[100 * mm, 70 * mm])
    tb.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LINEBELOW", (0, 0), (-1, 0), 2.5, colors.HexColor(ORANGE)), ("BOTTOMPADDING", (0, 0), (-1, 0), 8)]))
    story += [tb, Spacer(1, 10 * mm), Paragraph(t["title"], h1), Spacer(1, 3 * mm)]
    story.append(Paragraph(f"<font color='{GREY}'>{t['for']}:</font> <b>{name}</b><br/><font color='{GREY}'>{t['site']}:</font> <b>{site}</b>", body))
    story.append(Paragraph(t["what"], h2))
    story.append(Paragraph(f"{len(plan['modules'])} {t['modules']}" + (f" · {len(plan['plugins'])} {t['plugins']}: {', '.join(plan['plugins'])}" if plan["plugins"] else ""), small))
    story.append(Spacer(1, 3 * mm))
    rows = [[Paragraph(l["label"], body), Paragraph(f"<para align='right'>{eur(l['price'])}</para>", body)] for l in plan["lines"]]
    rows.append([Paragraph(f"<b>{t['total']}</b>", body), Paragraph(f"<para align='right'><b>{eur(plan['monthly'])}</b></para>", body)])
    lt = Table(rows, colWidths=[130 * mm, 40 * mm])
    lt.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#e3e3e5")), ("LINEABOVE", (0, -1), (-1, -1), 1.2, colors.HexColor(DARK)), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    story += [lt, Paragraph(t["choose"], h2)]
    cells = []
    for p in plan["periods"]:
        on = p["key"] == period
        c = [Paragraph(f"<font color='{GREY}' size=8><b>{t[p['key']].upper()}</b></font>", body), Paragraph(f"<font size=17><b>{eur(p['price'])}</b></font>", st(fontSize=17, leading=24, textColor=colors.HexColor(DARK))),
             Paragraph(f"{eur(p['per_month'])} {t['per_month']}" + (f"<br/><font color='{ORANGE}'><b>{float(p['discount']):g}% {t['discount']}</b></font>" if float(p["discount"]) else ""), small), Paragraph(f"{t['vat']} {eur(p['price_incl_vat'])}", small)]
        if on:
            c.append(Paragraph(f"<font color='{ORANGE}' size=8><b>{t['chosen'].upper()}</b></font>", body))
        cells.append(c)
    pt = Table([cells], colWidths=[56.6 * mm] * 3)
    ps = [("BOX", (i, 0), (i, 0), 2 if plan["periods"][i]["key"] == period else 0.6, colors.HexColor(ORANGE if plan["periods"][i]["key"] == period else "#d8d8da")) for i in range(3)]
    pt.setStyle(TableStyle(ps + [("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8), ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(LIGHT))]))
    story.append(pt)
    imp = plan.get("implementation")
    if imp:
        story.append(KeepTogether([Paragraph(t["impl"], h2), Paragraph(f"<font size=15><b>{eur(imp['price'])}</b></font> <font color='{GREY}'>({imp['hours']:g} {t['hours']} × {eur(imp['rate'])}) · {t['vat']} {eur(imp['price_incl_vat'])}</font>", body)]))
    rs = reseller or {}
    sell = " · ".join(x for x in (rs.get("company"), rs.get("contact"), " ".join(x for x in (rs.get("street"), rs.get("postal_code"), rs.get("city")) if x), rs.get("email"), rs.get("phone") or rs.get("mobile"), rs.get("website")) if x)
    story += [Spacer(1, 8 * mm), Paragraph(t["note"], small), Paragraph(t["valid"], small), Spacer(1, 4 * mm), Paragraph(f"<font color='{ORANGE}'><b>{t['contact']}</b></font>", body)]
    if sell:
        from xml.sax.saxutils import escape

        story.append(Paragraph(escape(sell), small))

    def footer(canvas, d):
        canvas.saveState()
        canvas.setFillColor(colors.HexColor(ORANGE))
        canvas.rect(0, 0, A4[0], 4 * mm, stroke=0, fill=1)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor(GREY))
        canvas.drawString(20 * mm, 9 * mm, ("Easy2edit · easy2edit.com" + (f" · {rs['company']}" if rs.get("company") else ""))[:110])
        canvas.drawRightString(A4[0] - 20 * mm, 9 * mm, f"{d.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()

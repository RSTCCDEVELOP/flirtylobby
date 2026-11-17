# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The licence overview as a PDF (the last step of the set-up wizard): the easy2edit logo, the licence number, who it is for, what is paid and how. Same house style as the quotation."""
import io
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from django.conf import settings

from . import license_price, system
from .pricing_pdf import DARK, GREY, LIGHT, ORANGE, eur

T = {
    "nl": {"title": "Licentie-overzicht", "sub": "Overzicht van je easy2edit-licentie", "number": "Licentienummer", "date": "Datum", "customer": "Gegevens", "client": "Opdrachtgever", "site": "Website", "url": "Hoofd-URL", "address": "Adres",
           "contact": "Contactpersoon", "email": "E-mail", "phone": "Telefoon", "mobile": "Mobiel", "sub_h": "Abonnement en prijs", "hosting": "Hosting", "term": "Abonnement", "renew": "Verlengdatum", "pay": "Betaling",
           "base": "Basisprijs (website, bewerkmodus, media, thema's, talen, beveiliging)", "month": "Per maand", "quarter": "Per kwartaal", "year": "Per jaar", "per_month": "Totaal per maand", "disc": "korting", "price": "Prijs per periode",
           "vat": "Alle prijzen zijn per maand en inclusief btw. Het abonnement start op de 1e van de maand; de dagen tot het einde van de eerste maand worden naar rato berekend.", "ai": "De kosten van AI zitten niet in de licentie: AI wordt per token berekend en vooraf gekocht.",
           "stripe": "Betaald met Stripe (abonnement)", "invoice": "Op rekening: de factuur wordt iedere 1e van de maand verstuurd", "none": "Niet betaald: de licentie loopt maar kort, daarna gaat de website in free mode", "open": "Nog te betalen", "agree": "Akkoord gegeven met een code per e-mail of SMS",
           "items": "Onderdeel", "monthly": "Per maand", "page": "Pagina"},
    "en": {"title": "Licence overview", "sub": "Overview of your easy2edit licence", "number": "Licence number", "date": "Date", "customer": "Details", "client": "Client", "site": "Website", "url": "Main URL", "address": "Address",
           "contact": "Contact person", "email": "E-mail", "phone": "Phone", "mobile": "Mobile", "sub_h": "Subscription and price", "hosting": "Hosting", "term": "Subscription", "renew": "Renew date", "pay": "Payment",
           "base": "Base price (website, edit mode, media, themes, languages, security)", "month": "Monthly", "quarter": "Quarterly", "year": "Yearly", "per_month": "Total per month", "disc": "discount", "price": "Price per period",
           "vat": "All prices are per month and include VAT. The subscription starts on the 1st of the month; the days until the end of the first month are charged in proportion.", "ai": "The costs of AI are not included in the licence: AI is charged per token and bought in advance.",
           "stripe": "Paid with Stripe (subscription)", "invoice": "On account: the invoice is sent on the 1st of every month", "none": "Not paid: the licence only runs for a short time, after that the website goes into free mode", "open": "Still to pay", "agree": "Agreement given with a code by e-mail or SMS",
           "items": "Component", "monthly": "Monthly", "page": "Page"},
    "de": {"title": "Lizenzübersicht", "sub": "Übersicht Ihrer easy2edit-Lizenz", "number": "Lizenznummer", "date": "Datum", "customer": "Angaben", "client": "Auftraggeber", "site": "Website", "url": "Haupt-URL", "address": "Adresse",
           "contact": "Ansprechpartner", "email": "E-Mail", "phone": "Telefon", "mobile": "Mobil", "sub_h": "Abonnement und Preis", "hosting": "Hosting", "term": "Abonnement", "renew": "Verlängerungsdatum", "pay": "Zahlung",
           "base": "Grundpreis (Website, Bearbeitungsmodus, Medien, Themes, Sprachen, Sicherheit)", "month": "Monatlich", "quarter": "Vierteljährlich", "year": "Jährlich", "per_month": "Gesamt pro Monat", "disc": "Rabatt", "price": "Preis pro Zeitraum",
           "vat": "Alle Preise gelten pro Monat und inklusive MwSt. Das Abonnement beginnt am 1. des Monats; die Tage bis zum Ende des ersten Monats werden anteilig berechnet.", "ai": "Die Kosten für KI sind in der Lizenz nicht enthalten: KI wird pro Token berechnet und im Voraus gekauft.",
           "stripe": "Mit Stripe bezahlt (Abonnement)", "invoice": "Auf Rechnung: die Rechnung wird jeden 1. des Monats versendet", "none": "Nicht bezahlt: die Lizenz läuft nur kurze Zeit, danach wechselt die Website in den Free-Modus", "open": "Noch zu zahlen", "agree": "Zustimmung mit einem Code per E-Mail oder SMS",
           "items": "Bestandteil", "monthly": "Monatlich", "page": "Seite"},
    "fr": {"title": "Récapitulatif de la licence", "sub": "Récapitulatif de votre licence easy2edit", "number": "Numéro de licence", "date": "Date", "customer": "Informations", "client": "Client", "site": "Site web", "url": "URL principale", "address": "Adresse",
           "contact": "Personne de contact", "email": "E-mail", "phone": "Téléphone", "mobile": "Mobile", "sub_h": "Abonnement et prix", "hosting": "Hébergement", "term": "Abonnement", "renew": "Date de renouvellement", "pay": "Paiement",
           "base": "Prix de base (site, mode édition, médias, thèmes, langues, sécurité)", "month": "Mensuel", "quarter": "Trimestriel", "year": "Annuel", "per_month": "Total par mois", "disc": "remise", "price": "Prix par période",
           "vat": "Tous les prix sont mensuels et TVA incluse. L'abonnement commence le 1er du mois ; les jours jusqu'à la fin du premier mois sont facturés au prorata.", "ai": "Les coûts de l'IA ne sont pas inclus dans la licence : l'IA est facturée par jeton et achetée à l'avance.",
           "stripe": "Payé avec Stripe (abonnement)", "invoice": "Sur facture : la facture est envoyée le 1er de chaque mois", "none": "Non payé : la licence ne dure que peu de temps, ensuite le site passe en mode gratuit", "open": "Reste à payer", "agree": "Accord donné avec un code par e-mail ou SMS",
           "items": "Élément", "monthly": "Mensuel", "page": "Page"},
    "es": {"title": "Resumen de la licencia", "sub": "Resumen de tu licencia de easy2edit", "number": "Número de licencia", "date": "Fecha", "customer": "Datos", "client": "Cliente", "site": "Sitio web", "url": "URL principal", "address": "Dirección",
           "contact": "Persona de contacto", "email": "Correo electrónico", "phone": "Teléfono", "mobile": "Móvil", "sub_h": "Suscripción y precio", "hosting": "Alojamiento", "term": "Suscripción", "renew": "Fecha de renovación", "pay": "Pago",
           "base": "Precio base (sitio, modo edición, medios, temas, idiomas, seguridad)", "month": "Mensual", "quarter": "Trimestral", "year": "Anual", "per_month": "Total al mes", "disc": "descuento", "price": "Precio por periodo",
           "vat": "Todos los precios son mensuales e incluyen IVA. La suscripción empieza el día 1 del mes; los días hasta el final del primer mes se cobran en proporción.", "ai": "Los costes de la IA no están incluidos en la licencia: la IA se cobra por token y se compra por adelantado.",
           "stripe": "Pagado con Stripe (suscripción)", "invoice": "A cuenta: la factura se envía el día 1 de cada mes", "none": "No pagado: la licencia solo dura poco tiempo, después el sitio pasa al modo gratuito", "open": "Pendiente de pago", "agree": "Conformidad dada con un código por correo electrónico o SMS",
           "items": "Componente", "monthly": "Mensual", "page": "Página"},
}


def _logo():
    p = Path(settings.BASE_DIR).parent / "frontend" / "public" / "logos" / "easy2edit" / "logo.png"
    return p if p.is_file() else None


def _rows(hosting_key):
    """What the licence costs per month incl. VAT, as lines: base price, everything in use and the chosen hosting."""
    lines = [("base", license_price.config_base())]
    for c in license_price.catalog():
        if c["active"] and c["price"] > 0 and c["kind"] != "hosting":
            lines.append((c["label"], c["price"]))
    host = next((h for h in license_price.hosting_options() if h["key"] == hosting_key), None)
    if host and Decimal(host["price"]) > 0:
        lines.append(("Hosting: " + host["label"], Decimal(host["price"])))
    return lines, host


def build(data, lang="nl", number="", pay="open"):
    """The PDF (bytes). data = the fields of the wizard (company_name, site_name, frontend_url, street…, hosting, renew_months, license_until)."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    t = T.get(lang) or T["en"]
    esc = lambda v: str(v or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")  # noqa: E731
    months = int(data.get("renew_months") or 12) if int(data.get("renew_months") or 12) in (1, 3, 12) else 12
    lines, host = _rows(str(data.get("hosting") or ""))
    monthly = sum((p for _, p in lines), Decimal(0))
    disc = license_price.discount(months)
    per_month = monthly * (Decimal(100) - disc) / 100
    price = (per_month * months).quantize(Decimal("0.01"))
    buf = io.BytesIO()
    client = data.get("company_name") or data.get("site_name") or ""
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=12 * mm, bottomMargin=15 * mm, title=f"{t['title']} {number}", author="easy2edit")
    st = lambda **k: ParagraphStyle("x", fontName=k.pop("font", "Helvetica"), **k)  # noqa: E731
    h1 = st(fontSize=24, leading=28, textColor=colors.HexColor(DARK), font="Helvetica-Bold")
    h2 = st(fontSize=12.5, leading=16, textColor=colors.HexColor(ORANGE), font="Helvetica-Bold", spaceBefore=7, spaceAfter=2)
    body = st(fontSize=9.6, leading=13.5, textColor=colors.HexColor(DARK))
    small = st(fontSize=8.2, leading=11.5, textColor=colors.HexColor(GREY))
    story = []
    logo = _logo()
    head = [Image(str(logo), width=48 * mm, height=48 * mm * 162 / 461) if logo else Paragraph("<b>easy2edit</b>", h1),
            Paragraph(f"<para align='right'><font color='{GREY}'>{t['date']}: {date.today().strftime('%d-%m-%Y')}</font></para>", body)]
    tb = Table([head], colWidths=[100 * mm, 70 * mm])
    tb.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LINEBELOW", (0, 0), (-1, 0), 2.5, colors.HexColor(ORANGE)), ("BOTTOMPADDING", (0, 0), (-1, 0), 8)]))
    story += [tb, Spacer(1, 4 * mm), Paragraph(t["title"], h1), Paragraph(esc(t["sub"]), small), Spacer(1, 3 * mm)]
    nb = Table([[Paragraph(f"<para align='center'><font color='{GREY}'>{t['number']}</font></para>", small)], [Paragraph(f"<para align='center' leading='26'><font name='Courier-Bold' size='21'>{esc(number)}</font></para>", body)]], colWidths=[170 * mm])
    nb.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(LIGHT)), ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor(ORANGE)), ("TOPPADDING", (0, 0), (-1, 0), 8), ("BOTTOMPADDING", (0, 0), (-1, 0), 0), ("TOPPADDING", (0, 1), (-1, 1), 1), ("BOTTOMPADDING", (0, 1), (-1, 1), 9), ("ROUNDEDCORNERS", [6, 6, 6, 6])]))
    story.append(nb)
    term = {1: t["month"], 3: t["quarter"], 12: t["year"]}[months]
    renew = ""
    try:
        renew = datetime.strptime(str(data.get("license_until") or "")[:10], "%Y-%m-%d").strftime("%d-%m-%Y")
    except ValueError:
        pass
    paid_col = {"stripe": "#2f9e6a", "invoice": "#1b97d3", "none": ORANGE}.get(pay, GREY)
    payline = {"stripe": t["stripe"], "invoice": t["invoice"], "none": t["none"]}.get(pay, t["open"])
    disc_txt = f" · {t['disc']} {disc.normalize():f}%" if disc else ""

    def tile(label, value, sub=""):
        c = Table([[Paragraph(f"<font color='{GREY}'>{esc(label).upper()}</font>", small)], [Paragraph(f"<font size='15'><b>{esc(value)}</b></font>", body)], [Paragraph(f"<font color='{GREY}'>{esc(sub)}</font>", small)]], colWidths=[53 * mm])
        c.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#e3e3e5")), ("BACKGROUND", (0, 0), (-1, -1), colors.white), ("LINEABOVE", (0, 0), (-1, 0), 2.2, colors.HexColor(ORANGE)),
                               ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2), ("TOPPADDING", (0, 0), (-1, 0), 7), ("BOTTOMPADDING", (0, -1), (-1, -1), 7), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("ROUNDEDCORNERS", [5, 5, 5, 5])]))
        return c
    story += [Spacer(1, 3 * mm), Table([[tile(t["monthly"], eur(per_month), term + disc_txt), tile(t["price"], eur(price), term.lower()), tile(t["renew"], renew or "-", t["term"])]], colWidths=[56.5 * mm] * 3,
                                       style=[("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 3.5 * mm)])]
    badge = Table([[Paragraph(f"<para align='center'><font color='white'><b>{esc(t['pay'])}</b></font></para>", small), Paragraph(esc(payline), body)]], colWidths=[26 * mm, 144 * mm])
    badge.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, 0), colors.HexColor(paid_col)), ("BACKGROUND", (1, 0), (1, 0), colors.HexColor(LIGHT)), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5), ("LEFTPADDING", (1, 0), (1, 0), 8), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ROUNDEDCORNERS", [5, 5, 5, 5])]))
    story += [Spacer(1, 3 * mm), badge]

    def kv(rows):
        tbl = Table([[Paragraph(f"<font color='{GREY}'>{esc(k)}</font>", body), Paragraph(f"<b>{esc(v)}</b>", body)] for k, v in rows if v], colWidths=[48 * mm, 122 * mm])
        tbl.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#e3e3e5")), ("TOPPADDING", (0, 0), (-1, -1), 2.2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
        return tbl
    addr = system.compose_address({k: data.get(k, "") for k in system.ADDRESS_PARTS}) + ((", " + str(data.get("country"))) if str(data.get("country") or "").strip().lower() in ("nl", "nederland", "netherlands") else "")
    story += [Paragraph(t["customer"], h2), kv([(t["client"], client), (t["site"], data.get("site_name")), (t["url"], data.get("frontend_url")), (t["address"], addr),
                                               (t["contact"], " ".join(x for x in (data.get("contact_first_name"), data.get("contact_last_name")) if x)), (t["email"], data.get("contact_email")), (t["phone"], data.get("phone")), (t["mobile"], data.get("mobile"))])]
    story += [Paragraph(t["sub_h"], h2), kv([(t["hosting"], host["label"] if host else ""), (t["term"], term + (f" · {t['disc']} {disc.normalize():f}%" if disc else ""))]), Spacer(1, 3 * mm)]
    rows = [[Paragraph(f"<font color='{GREY}' size='8.5'>{t['items'].upper()}</font>", body), Paragraph(f"<para align='right'><font color='{GREY}' size='8.5'>{t['monthly'].upper()}</font></para>", body)]]
    rows += [[Paragraph(esc(t["base"] if l == "base" else l), body), Paragraph(f"<para align='right'>{eur(p)}</para>", body)] for l, p in lines]
    rows.append([Paragraph(f"<b>{t['per_month']}</b>", body), Paragraph(f"<para align='right'><b>{eur(monthly)}</b></para>", body)])
    if disc:
        rows.append([Paragraph(f"{term} · {t['disc']} {disc.normalize():f}%", body), Paragraph(f"<para align='right'>{eur(per_month)} / {t['per_month'].split()[-1]}</para>", body)])
    rows.append([Paragraph(f"<b>{t['price']} ({term.lower()})</b>", body), Paragraph(f"<para align='right'><font color='{ORANGE}' size='12'><b>{eur(price)}</b></font></para>", body)])
    lt = Table(rows, colWidths=[130 * mm, 40 * mm])
    lt.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(LIGHT)), ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#e3e3e5")), ("LINEABOVE", (0, -1), (-1, -1), 1.2, colors.HexColor(DARK)),
                            ("TOPPADDING", (0, 0), (-1, -1), 2.6), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.6)]))
    story += [lt, Spacer(1, 4 * mm), Paragraph(esc(t["vat"]), small), Spacer(1, 1.5 * mm), Paragraph(esc(t["ai"]), small), Spacer(1, 1.5 * mm), Paragraph(esc(t["agree"]), small)]

    def footer(canvas, d):
        canvas.saveState()
        canvas.setFillColor(colors.HexColor(ORANGE))
        canvas.rect(0, 0, A4[0], 4 * mm, stroke=0, fill=1)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor(GREY))
        canvas.drawString(20 * mm, 9 * mm, f"easy2edit · easy2edit.com · {number}"[:110])
        canvas.drawRightString(A4[0] - 20 * mm, 9 * mm, f"{t['page']} {d.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()

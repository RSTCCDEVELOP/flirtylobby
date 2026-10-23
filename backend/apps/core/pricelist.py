"""The price list: a matrix of the standard installations against the packages, loose modules and plugins, with the prices; as data (screen, system object) and as a PDF."""
import io
from datetime import date
from decimal import Decimal
from pathlib import Path

from django.conf import settings

from . import modules, presets, pricing

SLUG = "prijslijst"
T = {
    "nl": {"host": "Hosting (aanbevolen per installatie)", "thost": "Totaal per maand incl. aanbevolen hosting", "fair": "Alles is gebaseerd op fair use. Bij veel dataverbruik (opslag, verkeer of e-mail) volgt een naheffing.", "title": "Prijslijst", "inst": "Standaardinstallaties", "item": "Onderdeel", "own": "Los per maand", "base": "Basis (website, bewerkmodus, media, thema's, talen, beveiliging, back-ups)", "pkg": "Pakketten",
           "mod": "Losse modules", "plug": "Plugins", "total": "Totaal per maand", "note": "Alle prijzen zijn per maand en exclusief btw. Een onderdeel in een pakket wordt één keer gerekend. Een vinkje (x) betekent dat het onderdeel in de installatie zit.", "date": "Datum"},
    "en": {"host": "Hosting (recommended per installation)", "thost": "Total per month incl. recommended hosting", "fair": "Everything is based on fair use. If you use a lot of data (storage, traffic or e-mail), an additional charge follows.", "title": "Price list", "inst": "Standard installations", "item": "Item", "own": "Separately per month", "base": "Base (website, edit mode, media, themes, languages, security, backups)", "pkg": "Packages",
           "mod": "Single modules", "plug": "Plugins", "total": "Total per month", "note": "All prices are per month and exclude VAT. An item inside a package is charged once. An x means the item is part of the installation.", "date": "Date"},
    "de": {"host": "Hosting (empfohlen je Installation)", "thost": "Gesamt pro Monat inkl. empfohlenem Hosting", "fair": "Alles basiert auf Fair Use. Bei sehr hohem Datenverbrauch (Speicher, Traffic oder E-Mail) folgt eine Nachberechnung.", "title": "Preisliste", "inst": "Standardinstallationen", "item": "Bestandteil", "own": "Einzeln pro Monat", "base": "Basis (Website, Bearbeitungsmodus, Medien, Themen, Sprachen, Sicherheit, Backups)", "pkg": "Pakete",
           "mod": "Einzelne Module", "plug": "Plugins", "total": "Gesamt pro Monat", "note": "Alle Preise gelten pro Monat und ohne MwSt. Ein Bestandteil in einem Paket wird einmal berechnet. Ein x bedeutet: Teil der Installation.", "date": "Datum"},
    "fr": {"host": "Hébergement (recommandé par installation)", "thost": "Total par mois, hébergement recommandé inclus", "fair": "Tout repose sur un usage raisonnable (fair use). En cas de forte consommation de données (stockage, trafic ou e-mail), un supplément est facturé.", "title": "Liste de prix", "inst": "Installations standard", "item": "Élément", "own": "Seul par mois", "base": "Base (site, mode édition, médias, thèmes, langues, sécurité, sauvegardes)", "pkg": "Packs",
           "mod": "Modules seuls", "plug": "Plugins", "total": "Total par mois", "note": "Tous les prix sont par mois et hors TVA. Un élément d'un pack est facturé une fois. Un x signifie que l'élément fait partie de l'installation.", "date": "Date"},
    "es": {"host": "Alojamiento (recomendado por instalación)", "thost": "Total al mes con el alojamiento recomendado", "fair": "Todo se basa en un uso razonable (fair use). Si se usan muchos datos (almacenamiento, tráfico o correo), se aplica un cargo adicional.", "title": "Lista de precios", "inst": "Instalaciones estándar", "item": "Elemento", "own": "Suelto al mes", "base": "Base (web, modo edición, medios, temas, idiomas, seguridad, copias)", "pkg": "Paquetes",
           "mod": "Módulos sueltos", "plug": "Plugins", "total": "Total al mes", "note": "Todos los precios son por mes y sin IVA. Un elemento dentro de un paquete se cobra una vez. Una x significa que forma parte de la instalación.", "date": "Fecha"},
}


def matrix():
    """{installations: [{key, name, total}], base, sections: [{key, rows: [{key, label, price, in: {installation: bool}}]}], currency}."""
    from apps.plugins.models import Plugin

    cfg = pricing.load()
    items = cfg["items"]
    inst, want = [], {}
    for p in presets.PRESETS:
        mods, plugs = presets._wanted_modules(p), set(presets.plugins_for(p))
        want[p["key"]] = (mods, plugs)
        total, _lines = pricing.price_of(mods, plugs)
        inst.append({"key": p["key"], "name": p["name"], "total": str(total)})
    in_pkg = {k for pk in modules.PACKAGES for k in pk["modules"]}
    pk_rows = [{"key": f"package:{pk['key']}", "label": pk["label"], "price": items.get(f"package:{pk['key']}", 0),
                "in": {k: bool(want[k][0] & set(pk["modules"])) for k in want}} for pk in modules.PACKAGES]
    mod_rows = [{"key": f"module:{m['key']}", "label": m["label"], "price": items.get(f"module:{m['key']}", 0), "in": {k: m["key"] in want[k][0] for k in want}}
                for m in modules.MODULES if m["key"] not in in_pkg and not m.get("core") and (items.get(f"module:{m['key']}", 0) or any(m["key"] in w[0] for w in want.values()))]
    plug_rows = [{"key": f"plugin:{p.name}", "label": p.title or p.name, "price": items.get(f"plugin:{p.name}", 0), "in": {k: p.name in want[k][1] for k in want}} for p in Plugin.objects.order_by("name")]
    rec = {"standaard-website": "shared", "bedrijfswebsite": "shared", "stichting": "shared", "webshop": "vps-s", "zakelijk-netwerk": "vps-s", "marktplaats": "vps-s", "spelletjessite": "vps-s", "datingplatform": "vps-m", "sportclub": "vps-m"}
    hosts = pricing.hosting_options()
    hp = {h["key"]: Decimal(str(h["price"])) for h in hosts}
    for i in inst:
        i["hosting"], i["total_host"] = rec.get(i["key"], "shared"), str(Decimal(i["total"]) + hp.get(rec.get(i["key"], "shared"), Decimal(0)))
    host_rows = [{"key": f"hosting:{h['key']}", "label": h["label"], "price": h["price"], "in": {i["key"]: i["hosting"] == h["key"] for i in inst}} for h in hosts]
    return {"installations": inst, "base": cfg["base_price"], "currency": cfg.get("currency", "EUR"), "sections": [{"key": "pkg", "rows": pk_rows}, {"key": "mod", "rows": mod_rows}, {"key": "plug", "rows": plug_rows}, {"key": "host", "rows": host_rows}]}


def installation(key):
    """One standard installation for a block on a page: name, description, price per month and what is in it (the matrix column)."""
    m = matrix()
    inst = next((i for i in m["installations"] if i["key"] == key), None)
    p = presets.BY_KEY.get(key)
    if not inst or not p:
        return None
    sections = []
    for sec in m["sections"]:
        rows = [{"label": r["label"], "price": r["price"], "in": bool(r["in"].get(key))} for r in sec["rows"]]
        if sec["key"] == "host":
            rows = [r for r in rows if r["in"]]
        sections.append({"key": sec["key"], "rows": rows})
    return {"key": key, "name": p["name"], "desc": p["desc"], "icon": p.get("icon", ""), "price": inst["total"], "price_host": inst["total_host"], "base": m["base"], "sections": sections, "enabled": True, "title": p["name"]}


def eur(v):
    s = f"{Decimal(str(v)):,.2f}"
    return "€ " + s.replace(",", "X").replace(".", ",").replace("X", ".")


def _vtext_class():
    from reportlab.platypus import Flowable

    class VText(Flowable):
        """A header cell with the text written from top to bottom."""

        def __init__(self, text, height, size=7):
            super().__init__()
            self.text, self.height, self.size = text, height, size
            self.width = size + 3

        def wrap(self, aw, ah):
            return self.width, self.height

        def draw(self):
            c = self.canv
            c.saveState()
            c.setFont("Helvetica-Bold", self.size)
            c.setFillColorRGB(1, 1, 1)
            c.translate(self.width - 2, self.height - 3)
            c.rotate(-90)
            c.drawString(0, 0, self.text)
            c.restoreState()

    return VText


def pdf(lang="nl"):
    """The price list as a landscape A4 PDF (bytes)."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    from .pricing_pdf import DARK, GREY, LIGHT, ORANGE

    t = T.get(lang, T["nl"])
    m = matrix()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=12 * mm, rightMargin=12 * mm, topMargin=8 * mm, bottomMargin=8 * mm, title=t["title"])
    sty = lambda **k: ParagraphStyle("x", fontName=k.pop("font", "Helvetica"), **k)  # noqa: E731
    cell, head = sty(fontSize=7, leading=8.2), sty(fontSize=7, leading=8.5, textColor=colors.white, font="Helvetica-Bold", alignment=1)
    story = []
    logo = Path(settings.BASE_DIR).parent / "frontend" / "public" / "logos" / "easy2edit" / "logo.png"
    story.append(Image(str(logo), width=40 * mm, height=40 * mm * 162 / 461) if logo.is_file() else Paragraph("<b>easy2edit</b>", sty(fontSize=18, leading=22)))
    story += [Spacer(1, 3 * mm), Paragraph(f"{t['title']} <font size=9 color='{GREY}'>· {t['date']}: {date.today().strftime('%d-%m-%Y')}</font>", sty(fontSize=18, leading=22, font="Helvetica-Bold", textColor=colors.HexColor(DARK))), Spacer(1, 3 * mm)]
    ids = [i["key"] for i in m["installations"]]
    hh = 27 * mm
    VText = _vtext_class()
    rows = [[Paragraph(t["item"], head), VText(t["own"], hh)] + [VText(i["name"], hh) for i in m["installations"]]]
    styles = [("TOPPADDING", (0, 1), (-1, -1), 1.5), ("BOTTOMPADDING", (0, 1), (-1, -1), 1.5), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(DARK)), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d9d9dc")), ("ALIGN", (1, 1), (-1, -1), "CENTER")]
    rows.append([Paragraph(t["base"], cell), Paragraph(eur(m["base"]), cell)] + ["x"] * len(ids))
    for sec in m["sections"]:
        rows.append([Paragraph(f"<b>{t[sec['key']]}</b>", cell)] + [""] * (len(ids) + 1))
        styles.append(("BACKGROUND", (0, len(rows) - 1), (-1, len(rows) - 1), colors.HexColor(LIGHT)))
        for r in sec["rows"]:
            rows.append([Paragraph(r["label"], cell), Paragraph(eur(r["price"]) if r["price"] else "-", cell)] + ["x" if r["in"][k] else "" for k in ids])
    for label, key in ((t["total"], "total"), (t["thost"], "total_host")):
        rows.append([Paragraph(f"<b>{label}</b>", cell), ""] + [Paragraph(f"<b>{eur(i[key])}</b>", cell) for i in m["installations"]])
        styles += [("BACKGROUND", (0, len(rows) - 1), (-1, len(rows) - 1), colors.HexColor(ORANGE))]
    w = doc.width
    first, second = 62 * mm, 22 * mm
    other = (w - first - second) / max(1, len(ids))
    tb = Table(rows, colWidths=[first, second] + [other] * len(ids), repeatRows=1)
    tb.setStyle(TableStyle(styles))
    story += [tb, Spacer(1, 3 * mm), Paragraph(t["note"], sty(fontSize=7.5, leading=10, textColor=colors.HexColor(GREY))), Spacer(1, 1.5 * mm), Paragraph(f"<b>{t['fair']}</b>", sty(fontSize=8, leading=10, textColor=colors.HexColor(DARK)))]
    doc.build(story)
    return buf.getvalue()

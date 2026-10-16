"""E-mail layout: plain text or an HTML template that follows the theme (Vormgeving) or own settings."""
import html
import re

from django.conf import settings as dj_settings

from apps.core import theme
from apps.core.models import SiteSettings

from .models import EmailSettings

FONTS = {
    "system": 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    "arial": "Arial, Helvetica, sans-serif",
    "georgia": 'Georgia, "Times New Roman", serif',
    "verdana": "Verdana, Geneva, sans-serif",
    "trebuchet": '"Trebuchet MS", Helvetica, sans-serif',
}
DEFAULTS = {
    "format": "html",          # html | text
    "design": "theme",         # theme | custom
    "brand_name": "",          # shown when there is no logo
    "variant": "classic",      # classic | centered | banner | minimal
    "show_logo": True,
    "footer": "",              # extra footer text
    "custom": {"accent": "#1b97d3", "background": "#f4f6fa", "card": "#ffffff", "text": "#1f2937", "muted": "#6b7280",
               "font": "system", "radius": 12},
}
VARIANTS = ("classic", "centered", "banner", "minimal")
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def get():
    stored = EmailSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}
    out = {**DEFAULTS, **{k: v for k, v in stored.items() if k in DEFAULTS and k != "custom"}}
    out["custom"] = {**DEFAULTS["custom"], **(stored.get("custom") or {})}
    return out


class Invalid(Exception):
    pass


def _apply(cur, incoming):
    if "format" in incoming:
        if incoming["format"] not in ("html", "text"):
            raise Invalid("Kies HTML of platte tekst.")
        cur["format"] = incoming["format"]
    if "design" in incoming:
        if incoming["design"] not in ("theme", "custom"):
            raise Invalid("Kies de vormgeving van het thema of eigen instellingen.")
        cur["design"] = incoming["design"]
    if "variant" in incoming:
        if incoming["variant"] not in VARIANTS:
            raise Invalid("Kies een van de vier opmaakvarianten.")
        cur["variant"] = incoming["variant"]
    for k in ("show_logo",):
        if k in incoming:
            cur[k] = bool(incoming[k])
    for k, n in (("brand_name", 80), ("footer", 500)):
        if k in incoming:
            cur[k] = str(incoming[k] or "").strip()[:n]
    if isinstance(incoming.get("custom"), dict):
        c = incoming["custom"]
        for k in ("accent", "background", "card", "text", "muted"):
            if k in c:
                if not HEX.match(str(c[k])):
                    raise Invalid(f"Ongeldige kleur voor {k}.")
                cur["custom"][k] = c[k]
        if "font" in c:
            if c["font"] not in FONTS:
                raise Invalid("Ongeldig lettertype.")
            cur["custom"]["font"] = c["font"]
        if "radius" in c:
            try:
                r = int(c["radius"])
            except (TypeError, ValueError):
                raise Invalid("Afronding moet een getal zijn.")
            if not 0 <= r <= 32:
                raise Invalid("Afronding: getal tussen 0 en 32.")
            cur["custom"]["radius"] = r
    return cur


def save(incoming):
    cur = _apply(get(), incoming)
    EmailSettings.objects.update_or_create(pk=1, defaults={"data": cur})
    return cur


def merge_preview(incoming):
    """Settings with unsaved changes applied (for the live preview)."""
    return _apply(get(), incoming or {})


def _site_url(base_url=None):
    from apps.seo import service as seo

    try:
        url = seo.get()["site"]["site_url"]
    except Exception:  # noqa: BLE001
        url = ""
    return (url or getattr(dj_settings, "PUBLIC_SITE_URL", "") or base_url or "").rstrip("/")


def _logo_url(values, base_url, api_base):
    """Absolute URL of the logo, or "" (then the brand name is shown)."""
    site = _site_url(base_url)
    sets = {"rstcc": "/logos/rstcc/logo.png", "studio2": "/logos/studio2/logo.png"}
    which = values.get("brand_logo", "custom")
    if which in sets and site:
        return site + sets[which]
    if which == "custom":
        from apps.branding.models import SiteAsset

        a = SiteAsset.objects.filter(slot="logo").first()
        if a and (api_base or site):
            return (api_base or site).rstrip("/") + a.image.url
    return ""


def palette(base_url=None, api_base=None, s=None):
    """Colours, font and radius for the HTML: from the theme, or from the own settings."""
    s = s or get()
    values = theme.merged(SiteSettings.load().theme)
    if s["design"] == "custom":
        c = s["custom"]
        p = {"accent": c["accent"], "background": c["background"], "card": c["card"], "text": c["text"], "muted": c["muted"],
             "font": FONTS[c["font"]], "radius": int(c["radius"]), "line": "#e5e8ef"}
    else:
        font = next((f for f in theme.FONTS if f["value"] == values.get("font_body")), None)
        stack = (font["css"] + ", " if font and font.get("css") else "") + "Helvetica, Arial, sans-serif"
        p = {"accent": values["primary"], "background": values.get("light_bg", "#f4f6fa"), "card": values.get("light_card", "#ffffff"),
             "text": values.get("light_text", "#1f2937"), "muted": values.get("light_muted", "#6b7280"), "font": stack,
             "radius": int(values.get("btn_radius", 10)) + 2, "line": values.get("light_line", "#e5e8ef")}
    p["logo"] = _logo_url(values, base_url, api_base) if s["show_logo"] else ""
    return p


LINK = re.compile(r"\[([^\]]{1,80})\]\((https?://[^\s)]{3,300}|/[^\s)]{1,300})\)")
URL = re.compile(r"(https?://[^\s<]+)")


def _abs(url, site):
    """Links in an e-mail must be absolute: /login -> https://site/login."""
    return (site + url) if url.startswith("/") and site else url


def _inline(text, accent, site=""):
    out, last = [], 0
    text = text.replace("\r", "")
    for m in LINK.finditer(text):
        out.append(_plain_links(text[last:m.start()], accent))
        out.append(f'<a href="{html.escape(_abs(m.group(2), site), quote=True)}" style="color:{accent};text-decoration:underline">{html.escape(m.group(1))}</a>')
        last = m.end()
    out.append(_plain_links(text[last:], accent))
    return "".join(out).replace("\n", "<br>")


def _plain_links(text, accent):
    out, last = [], 0
    for m in URL.finditer(text):
        out.append(html.escape(text[last:m.start()]))
        u = m.group(1).rstrip(".,;:)")
        out.append(f'<a href="{html.escape(u, quote=True)}" style="color:{accent};text-decoration:underline">{html.escape(u)}</a>')
        out.append(html.escape(m.group(1)[len(u):]))
        last = m.end()
    out.append(html.escape(text[last:]))
    return "".join(out)


def to_html(subject, body, base_url=None, api_base=None, s=None):
    s = s or get()
    p = palette(base_url, api_base, s)
    p["font"] = html.escape(p["font"], quote=True)  # the stack contains quotes and goes into style="…"
    brand = s["brand_name"] or "Studio2"
    site = _site_url(base_url)
    blocks = []
    for para in re.split(r"\n{2,}", (body or "").strip()):
        if not para.strip():
            continue
        only_link = LINK.fullmatch(para.strip())
        if only_link:  # a paragraph that is just [text](url) becomes a button
            blocks.append(f'<p style="margin:24px 0"><a href="{html.escape(_abs(only_link.group(2), site), quote=True)}" '
                          f'style="display:inline-block;background:{p["accent"]};color:#ffffff;text-decoration:none;font-weight:600;'
                          f'padding:12px 22px;border-radius:{p["radius"]}px">{html.escape(only_link.group(1))}</a></p>')
        elif re.fullmatch(r"[A-Z0-9]{4,10}", para.strip()):  # a lone verification code
            blocks.append(f'<p style="margin:20px 0;font-size:28px;font-weight:700;letter-spacing:6px;color:{p["accent"]}">{html.escape(para.strip())}</p>')
        else:
            blocks.append(f'<p style="margin:0 0 16px;line-height:1.6">{_inline(para, p["accent"], site)}</p>')
    v = s.get("variant", "classic")
    ta = "center" if v == "centered" else "left"
    blocks = [b.replace('style="margin:', f'style="text-align:{ta};margin:', 1) for b in blocks]
    logo = (f'<img src="{html.escape(p["logo"], quote=True)}" alt="{html.escape(brand)}" height="44" style="display:inline-block;height:44px;border:0">'
            if p["logo"] else "")
    name_color = "#ffffff" if v == "banner" else p["accent"]
    brandname = f'<span style="font-size:20px;font-weight:700;color:{name_color}">{html.escape(brand)}</span>'
    foot = html.escape(s["footer"]).replace("\n", "<br>") if s["footer"] else ""
    r = p["radius"]
    page_bg = p["card"] if v == "minimal" else p["background"]
    if v == "banner":  # coloured bar with the logo in a white tag, the message box hangs under it
        pill = f'<span style="display:inline-block;background:#ffffff;padding:8px 16px;border-radius:{r}px">{logo}</span>' if logo else brandname
        top = f'<tr><td align="center" style="background:{p["accent"]};padding:22px 16px;border-radius:{r}px {r}px 0 0">{pill}</td></tr>'
        card = f'background:{p["card"]};border:1px solid {p["line"]};border-top:0;border-radius:0 0 {r}px {r}px;padding:28px 28px 12px'
    elif v == "minimal":  # no box: logo top right under an accent line
        top = f'<tr><td align="right" style="border-top:4px solid {p["accent"]};padding:18px 0 22px">{logo or brandname}</td></tr>'
        card = "padding:0 0 12px"
    elif v == "centered":
        top = f'<tr><td align="center" style="padding:0 4px 18px">{logo or brandname}</td></tr>'
        card = f'background:{p["card"]};border:1px solid {p["line"]};border-radius:{r}px;padding:28px 28px 12px'
    else:  # classic: logo centred above the box, text left
        top = f'<tr><td align="center" style="padding:0 4px 18px">{logo or brandname}</td></tr>'
        card = f'background:{p["card"]};border:1px solid {p["line"]};border-radius:{r}px;padding:28px 28px 12px'
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(subject)}</title></head>
<body style="margin:0;padding:0;background:{page_bg};font-family:{p["font"]};color:{p["text"]}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{page_bg};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
{top}
<tr><td style="{card};font-size:15px;color:{p["text"]}">
<h1 style="margin:0 0 18px;font-size:20px;line-height:1.3;text-align:{ta};color:{p["text"]}">{html.escape(subject)}</h1>
{"".join(blocks)}
</td></tr>
<tr><td style="padding:16px 8px;font-size:12px;line-height:1.5;color:{p["muted"]};text-align:{"left" if v == "minimal" else "center"}">{foot}{"<br>" if foot and site else ""}{html.escape(site) if site else ""}</td></tr>
</table></td></tr></table></body></html>"""


def build(subject, body, base_url=None, api_base=None, s=None):
    """(text, html_or_None) for an outgoing message, following the settings."""
    s = s or get()
    text = body if not s["footer"] else f"{body}\n\n--\n{s['footer']}"
    if s["format"] == "html":
        return text, to_html(subject, body, base_url, api_base, s)
    return text, None

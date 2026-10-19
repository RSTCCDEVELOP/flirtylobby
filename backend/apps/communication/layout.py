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
    "code_style": "card",      # verification mails: card | boxes | plain | band
    "show_logo": True,
    "logo_align": "auto",      # auto (follows the variant) | left | center | right
    "logo_size": "m",          # s | m | l
    "footer": "",              # extra footer text
    "custom": {"accent": "#1b97d3", "background": "#f4f6fa", "card": "#ffffff", "text": "#1f2937", "muted": "#6b7280",
               "font": "system", "radius": 12},
}
VARIANTS = ("classic", "centered", "banner", "minimal")
CODE_STYLES = ("card", "boxes", "plain", "band")
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
    if "code_style" in incoming:
        if incoming["code_style"] not in CODE_STYLES:
            raise Invalid("Kies een van de opmaken voor verificatiemails.")
        cur["code_style"] = incoming["code_style"]
    if "logo_align" in incoming:
        if incoming["logo_align"] not in ("auto", "left", "center", "right"):
            raise Invalid("Kies links, midden, rechts of automatisch voor het logo.")
        cur["logo_align"] = incoming["logo_align"]
    if "logo_size" in incoming:
        if incoming["logo_size"] not in ("s", "m", "l"):
            raise Invalid("Kies een klein, gewoon of groot logo.")
        cur["logo_size"] = incoming["logo_size"]
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
    sets = {"easy2edit": "/logos/easy2edit/logo.png", "rstcc": "/logos/rstcc/logo.png", "studio2": "/logos/studio2/logo.png"}
    which = values.get("brand_logo", "custom")
    if which in sets and site:
        return site + sets[which]
    if which == "custom":
        from apps.branding.models import SiteAsset

        a = SiteAsset.objects.filter(slot="logo").first()
        if a and (api_base or site):
            return (api_base or site).rstrip("/") + a.image.url
    return ""


def _lum(hex_):
    r, g, b = (int(hex_[i:i + 2], 16) for i in (1, 3, 5))
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255


def _light(hex_, fallback):
    """An e-mail is always a light (white) message: a dark colour from the theme is replaced."""
    return hex_ if isinstance(hex_, str) and HEX.match(hex_) and _lum(hex_) > 0.85 else fallback


def _tint(hex_, amount=0.09):
    """The colour at 9% on white: a soft background for the code."""
    r, g, b = (int(hex_[i:i + 2], 16) for i in (1, 3, 5))
    return "#%02x%02x%02x" % tuple(round(255 - (255 - c) * amount) for c in (r, g, b))


def _logo_file(values):
    """(bytes, mime) of the logo from a file on this server, to send inside the e-mail when there is no public address for it."""
    from pathlib import Path

    which = values.get("brand_logo", "custom")
    try:
        if which in ("easy2edit", "rstcc", "studio2"):
            f = Path(dj_settings.PROJECT_ROOT) / "frontend" / "public" / "logos" / which / "logo.png"
            return (f.read_bytes(), "image/png") if f.is_file() else None
        from apps.branding.models import SiteAsset

        a = SiteAsset.objects.filter(slot="logo").first()
        if a:
            with a.image.open("rb") as fh:
                import mimetypes

                return fh.read(), mimetypes.guess_type(a.image.name)[0] or "image/png"
    except Exception:  # noqa: BLE001 - no logo file is fine: the name is shown
        pass
    return None


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
    p["card"], p["background"] = _light(p["card"], "#ffffff"), _light(p["background"], "#f4f6fa")  # always a light message
    if p["text"] and _lum(p["text"]) > 0.5:
        p["text"] = "#1f2937"
    p["logo"] = _logo_url(values, base_url, api_base) if s["show_logo"] else ""
    p["logo_file"] = _logo_file(values) if s["show_logo"] and not p["logo"] else None
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


def to_html(subject, body, base_url=None, api_base=None, s=None, code=None, inline=None):
    """The HTML of a message. code: a verification code, shown big in its own box. inline: a list that gets (cid, bytes, mime) for images sent inside the message."""
    s = s or get()
    p = palette(base_url, api_base, s)
    if not p["logo"] and p.get("logo_file") and inline is not None:
        inline.append(("logo", *p["logo_file"]))
        p["logo"] = "cid:logo"
    p["font"] = html.escape(p["font"], quote=True)  # the stack contains quotes and goes into style="…"
    from apps.core import system

    brand = s["brand_name"] or system.site_name()
    site = _site_url(base_url)
    blocks = []

    def code_box():
        style, c, acc, rad = s.get("code_style", "card"), html.escape(str(code)), p["accent"], p["radius"]
        mono = "Menlo,Consolas,'Courier New',monospace"
        if style == "boxes":  # a box per digit, like the code screen of the website
            cells = "".join(f'<td bgcolor="{_tint(acc)}" align="center" width="46" style="width:46px;height:56px;background:{_tint(acc)};border:1px solid {acc}55;border-radius:{min(rad, 10)}px;'
                            f'font-family:{mono};font-size:28px;font-weight:700;color:{acc};text-align:center">{ch}</td><td width="8" style="width:8px;font-size:0">&nbsp;</td>' for ch in c)
            return f'<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:22px auto"><tr>{cells}</tr></table>'
        if style == "plain":
            return f'<p style="margin:22px 0;text-align:center;font-family:{mono};font-size:40px;font-weight:700;letter-spacing:12px;color:{acc}">{c}</p>'
        if style == "band":
            return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0"><tr><td bgcolor="{acc}" align="center" style="background:{acc};border-radius:{rad}px;'
                    f'padding:18px;font-family:{mono};font-size:34px;font-weight:700;letter-spacing:12px;color:#ffffff;text-align:center">{c}</td></tr></table>')
        return (f'<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:22px auto"><tr><td bgcolor="{_tint(acc)}" align="center" '
                f'style="background:{_tint(acc)};border:1px solid {acc}33;border-radius:{rad}px;padding:16px 34px;font-family:{mono};'
                f'font-size:34px;font-weight:700;letter-spacing:10px;color:{acc};text-align:center">{c}</td></tr></table>')
    for para in re.split(r"\n{2,}", (body or "").strip()):
        if not para.strip():
            continue
        if code and str(code) in para:  # "Your code is 123456. Valid 15 minutes." -> text, the code in a box, text
            before, _, after = para.partition(str(code))
            if before.strip():
                blocks.append(f'<p style="margin:0 0 4px;line-height:1.6;text-align:center">{_inline(before.strip(), p["accent"], site)}</p>')
            blocks.append(code_box())
            rest = after.lstrip(" .:\n").strip()
            if rest:
                blocks.append(f'<p style="margin:0 0 16px;line-height:1.6;text-align:center;color:{p["muted"]};font-size:14px">{_inline(rest, p["accent"], site)}</p>')
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
    lh = {"s": 32, "m": 44, "l": 64}.get(s.get("logo_size"), 44)
    la = s.get("logo_align") if s.get("logo_align") in ("left", "center", "right") else ""  # "" = as the variant has it

    def al(default):
        return la or default

    logo = (f'<img src="{html.escape(p["logo"], quote=True)}" alt="{html.escape(brand)}" height="{lh}" style="display:inline-block;height:{lh}px;border:0">'
            if p["logo"] else "")
    name_color = "#ffffff" if v == "banner" else p["accent"]
    brandname = f'<span style="font-size:20px;font-weight:700;color:{name_color}">{html.escape(brand)}</span>'
    foot = html.escape(s["footer"]).replace("\n", "<br>") if s["footer"] else ""
    r = p["radius"]
    page_bg = p["card"] if v == "minimal" else p["background"]
    if v == "banner":  # coloured bar with the logo in a white tag, the message box hangs under it
        pill = f'<span style="display:inline-block;background:#ffffff;padding:8px 16px;border-radius:{r}px">{logo}</span>' if logo else brandname
        top = f'<tr><td align="{al("center")}" style="background:{p["accent"]};padding:22px 16px;border-radius:{r}px {r}px 0 0">{pill}</td></tr>'
        card = f'background:{p["card"]};border:1px solid {p["line"]};border-top:0;border-radius:0 0 {r}px {r}px;padding:28px 28px 12px'
    elif v == "minimal":  # no box: logo top right under an accent line
        top = f'<tr><td align="{al("right")}" style="border-top:4px solid {p["accent"]};padding:18px 0 22px">{logo or brandname}</td></tr>'
        card = "padding:0 0 12px"
    elif v == "centered":
        top = f'<tr><td align="{al("center")}" style="padding:0 4px 18px">{logo or brandname}</td></tr>'
        card = f'background:{p["card"]};border:1px solid {p["line"]};border-radius:{r}px;padding:28px 28px 12px'
    else:  # classic: logo centred above the box, text left
        top = f'<tr><td align="{al("center")}" style="padding:0 4px 18px">{logo or brandname}</td></tr>'
        card = f'background:{p["card"]};border:1px solid {p["line"]};border-radius:{r}px;padding:28px 28px 12px'
    return f"""<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><style>:root{{color-scheme:light only;supported-color-schemes:light}}</style><title>{html.escape(subject)}</title></head>
<body bgcolor="{page_bg}" style="margin:0;padding:0;background:{page_bg};font-family:{p["font"]};color:{p["text"]}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="{page_bg}" style="background:{page_bg};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
{top}
<tr><td bgcolor="{p["card"]}" style="{card};font-size:15px;color:{p["text"]};border-top:4px solid {p["accent"]}">
<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;text-align:{"center" if code else ta};color:{p["text"]}">{html.escape(subject)}</h1>
{"".join(blocks)}
</td></tr>
<tr><td style="padding:16px 8px;font-size:12px;line-height:1.5;color:{p["muted"]};text-align:{"left" if v == "minimal" else "center"}">{foot}{"<br>" if foot and site else ""}{html.escape(site) if site else ""}</td></tr>
</table></td></tr></table></body></html>"""


def build_full(subject, body, base_url=None, api_base=None, s=None, code=None):
    """(text, html_or_None, inline_images) for an outgoing message, following the settings."""
    s = s or get()
    text = body if not s["footer"] else f"{body}\n\n--\n{s['footer']}"
    inline = []
    if s["format"] == "html":
        return text, to_html(subject, body, base_url, api_base, s, code, inline), inline
    return text, None, []


def build(subject, body, base_url=None, api_base=None, s=None, code=None):
    """(text, html_or_None) for an outgoing message (used by the preview)."""
    text, html_body, inline = build_full(subject, body, base_url, api_base, s, code)
    if html_body and inline:  # a preview in the browser cannot show cid: images: use the file itself
        import base64

        cid, data, mime = inline[0]
        html_body = html_body.replace(f"cid:{cid}", f"data:{mime};base64,{base64.b64encode(data).decode()}")
    return text, html_body

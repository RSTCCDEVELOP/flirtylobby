"""A theme made from a website address. The site is read like in Site importeren (colours, fonts, shapes, logo, favicon, share picture, hero pictures);
when Claude is linked and switched on (Admin -> API keys) it designs a complete theme from that. The result is a draft: the user checks it with examples
and only then saves it as a theme package (themepacks.save_draft)."""
import base64
import hashlib
import json
import logging
import re
import threading
import time
import uuid
from datetime import date
from io import BytesIO
from urllib.parse import urljoin, urlparse

from django import db
from django.utils import timezone

from apps.integrations import ai
from apps.siteimport import importer as si

from . import theme as T
from . import themepacks
from .models import ThemeImportJob

logger = logging.getLogger(__name__)
MAX_DRAFT_IMG = 1_500_000  # bytes per picture in the draft
HOME_MAX = 5
PHOTO_MAX, PHOTO_PAGES, PHOTO_MIN_W = 24, 3, 400
SKIP_PHOTO = re.compile(r"logo|icon|favicon|sprite|avatar|emoji|pixel|tracking|badge", re.I)


def _photo_urls(root, base):
    """Picture addresses in a page: img src / lazy src / srcset (largest), picture sources and inline background images."""
    out = []
    for im in si.find(root, "img") + si.find(root, "source"):
        a = im.attrs
        cands = [a.get("data-src"), a.get("data-lazy-src"), a.get("src")]
        srcset = a.get("srcset") or a.get("data-srcset") or ""
        if srcset:
            parts = [p.strip().split() for p in srcset.split(",") if p.strip()]
            cands.insert(0, parts[-1][0] if parts and parts[-1] else None)
        out += [urljoin(base, c) for c in cands if c and not c.startswith("data:")][:1]
    for n in si.find(root):
        st = n.attrs.get("style", "")
        out += [urljoin(base, m) for m in re.findall(r"url\(['\"]?([^)'\"]+)", st) if not m.startswith("data:")]
    return out


def _collect_photos(job, fetcher, root, base, skip_urls):
    """Download the pictures of the start page and a few more pages. The files go to storage (themeimport/<job>/), the draft keeps small previews."""
    from django.core.files.base import ContentFile
    from django.core.files.storage import default_storage
    from PIL import Image

    fetcher.t0 = time.time()  # a new time budget for the pictures
    urls = list(dict.fromkeys(_photo_urls(root, base)))
    for href, _label in si._links(root, base, fetcher)[:PHOTO_PAGES]:
        try:
            u2, d2, _ = fetcher.get(href, si.MAX_HTML)
            urls += _photo_urls(si.parse_html(d2.decode("utf-8", "replace")), u2)
        except si.ImportError_:
            continue
    seen, hashes, photos = set(skip_urls), set(), []
    for url in dict.fromkeys(urls):
        if len(photos) >= PHOTO_MAX:
            break
        if url in seen or SKIP_PHOTO.search(urlparse(url).path) or not url.startswith(("http://", "https://")):
            continue
        seen.add(url)
        try:
            _, data, _ct = fetcher.get(url, 4 * 2**20)
            ext = themepacks.check_image(data)
            im = Image.open(BytesIO(data))
            w, h = im.size
        except (si.ImportError_, themepacks.ThemeError, OSError, ValueError):
            continue
        digest = hashlib.sha1(data).hexdigest()
        if w < PHOTO_MIN_W or h < 200 or digest in hashes:
            continue
        hashes.add(digest)
        key = f"themeimport/{job.pk}/{len(photos) + 1:02d}.{ext}"
        default_storage.save(key, ContentFile(data))
        thumb = BytesIO()
        small = im.resize((min(w, 800), max(1, round(h * min(w, 800) / w))))
        alpha = im.mode in ("RGBA", "LA", "PA") or (im.mode == "P" and "transparency" in im.info)
        if alpha:  # transparent pictures keep their transparency in the preview
            small.convert("RGBA").save(thumb, "PNG", optimize=True)
        else:
            small.convert("RGB").save(thumb, "JPEG", quality=78)
        photos.append({"key": key, "ext": ext, "w": w, "h": h, "size": len(data), "src": url, "name": (urlparse(url).path.rsplit("/", 1)[-1] or f"foto-{len(photos) + 1}.{ext}")[:120],
                       "mime": "image/png" if alpha else "image/jpeg", "thumb": base64.b64encode(thumb.getvalue()).decode()})
    return photos


def cleanup(job):
    """Remove the pictures that were kept for the check."""
    from django.core.files.storage import default_storage

    for p in (job.draft or {}).get("photos", []):
        try:
            default_storage.delete(p["key"])
        except Exception:  # noqa: BLE001
            pass


# ── the real colours of the site: CSS custom properties (--bg, --card, --accent …) for light and dark ──
ROLES = {
    "bg": r"^(bg|background|page|body-bg|surface-0|color-bg|c-bg)$", "card": r"^(card|surface|panel|bg-card|card-bg|surface-1|color-card|c-card)$",
    "text": r"^(text|fg|foreground|ink|color-text|text-primary|c-text)$", "muted": r"^(muted|text-muted|subtle|text-2|text-secondary|muted-foreground|color-muted)$",
    "line": r"^(line|border|divider|stroke|color-border|border-color|c-line)$", "primary": r"^(accent|primary|brand|main|color-primary|color-accent|c-accent)$",
    "secondary": r"^(accent2|accent-2|secondary|brand-2|color-secondary|color-accent-2)$", "ok": r"^(ok|success|green|color-success)$", "danger": r"^(bad|danger|error|red|color-danger|color-error)$",
}


def _blocks(css):
    """[(selector, body, in_dark_media)] for the rules of a stylesheet (one level of @media)."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out, i, n = [], 0, len(css)

    def rules(text, dark):
        j = 0
        while True:
            a = text.find("{", j)
            if a < 0:
                return
            sel, depth, k = text[j:a].strip(), 1, a + 1
            while k < len(text) and depth:
                depth += (text[k] == "{") - (text[k] == "}")
                k += 1
            body = text[a + 1:k - 1]
            if sel.startswith("@media"):
                rules(body, dark or "prefers-color-scheme" in sel and "dark" in sel)
            elif not sel.startswith("@"):
                out.append((sel, body, dark))
            j = k

    rules(css, False)
    return out


def site_tokens(css):
    """{"light": {role: hex}, "dark": {role: hex}, "scheme": "both"|"light"|"dark", "fonts": [...]} from the custom properties of the site."""
    light, dark, fonts = {}, {}, []
    for sel, body, in_dark in _blocks(css):
        if not re.search(r":root|^html|^body|data-theme|\.dark|\.light|\[data-", sel):
            continue
        is_dark = in_dark or bool(re.search(r"dark", sel, re.I))
        target = dark if is_dark else light
        for name, val in re.findall(r"--([\w-]+)\s*:\s*([^;]+);?", body):
            name = name.lower()
            cols = si.colors_in(val)
            if cols:
                for role, rx in ROLES.items():
                    if re.match(rx, name) and role not in target:
                        target[role] = cols[0]
            elif re.search(r"font|sans|serif|body|heading", name):
                for fam in val.split(","):
                    fam = fam.strip().strip("'\"")
                    if fam and fam.lower() not in si.GENERIC and not fam.startswith("var(") and fam not in fonts:
                        fonts.append(fam)
    scheme = "both" if light and dark else ("dark" if dark else "light")
    return {"light": light, "dark": dark, "scheme": scheme, "fonts": fonts}


def _mix(a, b, t):
    ra, rb = si._rgb(a), si._rgb(b)
    return si._hex(tuple(round(x + (y - x) * t) for x, y in zip(ra, rb)))


def tokens_to_values(tok):
    """Theme settings (light_*, dark_*, primary, secondary, ok, danger, default_mode) from the tokens; only what the site really defines."""
    v = {}
    for mode in ("light", "dark"):
        t = tok[mode]
        if not t:
            continue
        if "bg" in t:
            v[f"{mode}_page"] = v[f"{mode}_bg"] = t["bg"]
        if "card" in t:
            v[f"{mode}_card"] = t["card"]
        if "bg" in t and "card" in t:
            v[f"{mode}_hover"] = _mix(t["bg"], t["card"], 0.5)
        for src, dst in (("line", "line"), ("text", "text"), ("muted", "muted")):
            if src in t:
                v[f"{mode}_{dst}"] = t[src]
    first = tok["light"] or tok["dark"]
    for role, key in (("primary", "primary"), ("secondary", "secondary"), ("ok", "ok"), ("danger", "danger")):
        if role in (tok["light"] or {}):
            v[key] = tok["light"][role]
        elif role in first:
            v[key] = first[role]
    v["default_mode"] = {"both": "system", "dark": "dark", "light": "light"}[tok["scheme"]]
    return v


def start(user, url):
    url = url.strip()
    if not re.match(r"^https?://", url):
        url = "https://" + url
    si.check_public(url)  # raises ImportError_
    if ThemeImportJob.objects.filter(user=user, status="running", created_at__gte=timezone.now() - timezone.timedelta(minutes=5)).exists():
        raise themepacks.ThemeError("Er loopt al een import. Wacht tot die klaar is.")
    for old in ThemeImportJob.objects.filter(created_at__lt=timezone.now() - timezone.timedelta(hours=24)):
        cleanup(old)
        old.delete()
    job = ThemeImportJob.objects.create(user=user, url=url[:500])
    threading.Thread(target=_run, args=(job.pk,), daemon=True).start()
    return job


def _set(job, progress, step):
    ThemeImportJob.objects.filter(pk=job.pk).update(progress=progress, step=step)


def _image(fetcher, url):
    """(ext, bytes) of a picture of the site, or None."""
    try:
        _, data, _ct = fetcher.get(url, 4 * 2**20)
        ext = themepacks.check_image(data)
    except (si.ImportError_, themepacks.ThemeError):
        return None
    return (ext, data) if len(data) <= MAX_DRAFT_IMG else None


PAGE_KEYS = ("header_layout", "header_style", "header_sticky", "menu_style", "footer_layout", "footer_tone", "block_style", "block_gap", "content_w")


def guess_layout(css, primary, fixed_header):
    """A first guess of the page templates from the stylesheets of the site; Claude (when linked) refines it."""
    g = {}

    def rule(sel_rx):
        return " ".join(m.group(1) for m in re.finditer(r"(?:^|[}\s,])(?:%s)[^{]*\{([^}]*)\}" % sel_rx, css, re.I))

    head = rule(r"header|\.header|\.site-header|\.navbar|\.topbar")
    foot = rule(r"footer|\.footer|\.site-footer")
    g["header_sticky"] = "yes" if re.search(r"position\s*:\s*(sticky|fixed)", head, re.I) or fixed_header else "no"
    if re.search(r"backdrop-filter", head, re.I):
        g["header_style"] = "glass"
    elif re.search(r"box-shadow\s*:\s*(?!none)", head, re.I):
        g["header_style"] = "shadow"
    elif re.search(r"background(?:-color)?\s*:\s*(transparent|none)", head, re.I) and not re.search(r"border-bottom", head, re.I):
        g["header_style"] = "plain"
    else:
        g["header_style"] = "solid"
    if re.search(r"justify-content\s*:\s*center", head, re.I) and re.search(r"flex-direction\s*:\s*column", head, re.I):
        g["header_layout"] = "centered"
    navrule = rule(r"nav\s+a|\.nav-link|\.menu\s+a|\.nav\s+a")
    if re.search(r"border-radius\s*:\s*(9{2,}|[3-9]\d|\d{3,})", navrule, re.I):
        g["menu_style"] = "pills"
    elif re.search(r"border-bottom|text-decoration\s*:\s*underline", navrule, re.I):
        g["menu_style"] = "underline"
    elif re.search(r"border\s*:\s*\d", navrule, re.I):
        g["menu_style"] = "boxed"
    cols = si.colors_in(" ".join(re.findall(r"background(?:-color)?\s*:\s*([^;]+)", foot, re.I)))
    if cols:
        c = cols[0]
        if c.lower() == (primary or "").lower():
            g["footer_tone"] = "brand"
        elif si._hls(c)[1] < 0.25:
            g["footer_tone"] = "dark"
        elif c.lower() not in ("#ffffff", "#fff"):
            g["footer_tone"] = "card"
    if re.search(r"grid-template-columns\s*:\s*(repeat\(\s*[34]|[^;]*(1fr\s+){2})", foot, re.I):
        g["footer_layout"] = "columns"
    cards = rule(r"\.card|\.box|article")
    if re.search(r"box-shadow\s*:\s*(?!none)[^;]*(\d{2,}px)", cards, re.I):
        g["block_style"] = "elevated"
    elif re.search(r"border\s*:\s*\d", cards, re.I) and not re.search(r"box-shadow\s*:\s*(?!none)", cards, re.I):
        g["block_style"] = "outline"
    elif cards and not re.search(r"border|box-shadow", cards, re.I):
        g["block_style"] = "flat"
    m = re.search(r"max-width\s*:\s*(\d{3,4})px", rule(r"\.container|\.wrapper|main|\.content"), re.I)
    if m:
        g["content_w"] = max(720, min(1600, int(m.group(1))))
    return g


def _complete(values):
    """Every setting of the page templates is in the theme: what is not known gets the default."""
    return {**{k: T.DEFAULTS[k] for k in PAGE_KEYS}, **values}


def _schema_for_ai():
    skip = {"brand_logo", "remember_collapse", "sidebar_auto", "nav_default", "version_notice", "device_mobile", "device_tablet", "device_desktop", "device_app"}
    out = []
    for g in T.SCHEMA:
        for f in g["fields"]:
            if f["key"] in skip or f["key"].startswith("chat_"):
                continue
            row = {"key": f["key"], "type": f["type"], "default": f["default"]}
            if f["type"] == "number":
                row["range"] = [f["min"], f["max"]]
            elif f["type"] == "choice":
                row["options"] = [c["value"] for c in f["choices"]]
            out.append(row)
    return out


def _ask_ai(info):
    system = ("You are a web designer. From the facts about a website you design a complete theme for a content management system. "
              "Answer with ONE JSON object only, no text around it: {\"name\": short theme name, \"description\": one Dutch sentence, \"values\": {setting: value}}. "
              "Use only the settings from the list, with values of the right type (hex colours like #aabbcc, numbers within the range, one of the options). "
              "Choose colours that fit the brand: primary and secondary, matching light_* and dark_* neutrals (page, bg, card, hover, line, text, muted; text must be readable on bg), "
              "fonts from the options, radius, btn_radius, shadow, popup_* settings, tab_style and system_popup that fit the style of the site. "
              "Also choose the page templates that fit the site: header_layout, header_style, header_sticky, menu_style, footer_layout, footer_tone, block_style, block_gap and content_w (heuristic_values has a first guess; correct it where the site clearly looks different). "
              "IMPORTANT: site_tokens are the real colours the site defines for light and dark; heuristic_values already contain them. Keep them exactly (do not recolour, do not tint the neutrals differently); "
              "only fill in settings that are still missing. Never invent fonts: use fonts_found when they match an option, otherwise System. Keep the radius and button radius of the site.")
    prompt = json.dumps({"site": info, "settings": _schema_for_ai()}, ensure_ascii=False)
    return _ai_json(system, prompt, 4000, 110)


def reference_site(url):
    """The colours and fonts of a page on the web (the page and its own stylesheets), as a small summary for Claude to base a theme on."""
    url = (url or "").strip()
    if not url:
        return None
    if not re.match(r"^https?://", url):
        url = "https://" + url
    try:
        fetcher = si.WebFetcher(url)
        base, data, _ = fetcher.get(url, si.MAX_HTML)
        root = si.parse_html(data.decode("utf-8", "replace"))
        css = "\n".join(" ".join(k for k in st.kids if isinstance(k, str)) for st in si.find(root, "style"))
        for l in [urljoin(base, l.attrs.get("href", "")) for l in si.find(root, "link", lambda n: "stylesheet" in n.attrs.get("rel", "").lower())][:si.MAX_STYLESHEETS]:
            try:
                if l.startswith("https://fonts.googleapis.com"):
                    css += f"\n/* {l} */"
                elif fetcher.same_site(l):
                    css += "\n" + fetcher.get(l, si.MAX_CSS)[1].decode("utf-8", "replace")
            except si.ImportError_:
                continue
        weight, bg, fg, fonts = si.analyse_css(css)
        tc = next((m.attrs.get("content") for m in si.find(root, "meta") if m.attrs.get("name") == "theme-color"), None)
    except si.ImportError_ as e:
        raise themepacks.ThemeError(f"De pagina kon niet worden gelezen: {e}")
    tok = site_tokens(css)
    if not weight and not tok["light"] and not tok["dark"] and not tc:
        raise themepacks.ThemeError("Op die pagina zijn geen kleuren gevonden (de stijlbladen staan misschien op een ander adres). Probeer een andere pagina.")
    return {"url": base, "theme_color": tc, "page_background": bg, "page_text": fg, "palette_most_used_first": list(weight)[:10] if not hasattr(weight, "most_common") else [c for c, _n in weight.most_common(10)],
            "named_colours_light": tok["light"], "named_colours_dark": tok["dark"], "fonts": (list(fonts)[:4] if not hasattr(fonts, "most_common") else [f for f, _n in fonts.most_common(4)])}


def refine_values(values, request_text, site="", reference_url=""):
    """Claude changes the settings of a theme after the text of the user (and, when a web address is given, after the colours and fonts of that page).
    Returns (changes, summary, name, description)."""
    if not ai.available():
        raise themepacks.ThemeError("Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan.")
    ref = reference_site(reference_url)
    ask = (request_text or "").strip()[:800]
    if ref and len(ask) < 3:
        ask = "Gebruik de kleuren en lettertypen van de pagina in reference_site voor dit thema."
    if len(ask) < 3:
        raise themepacks.ThemeError("Schrijf wat er anders moet.")
    system = ("You are a web designer who improves a theme for a content management system. The user asks for a change. "
              "Answer with ONE JSON object only, no text around it: {\"values\": {setting: value}, \"summary\": one short Dutch sentence about what you changed, \"name\": optional new name, \"description\": optional new Dutch sentence}. "
              "In values only put the settings that change, with the right type (hex colours like #aabbcc, numbers within the range, one of the options). Keep the result consistent: "
              "text must stay readable on its background in light and dark, and light_*/dark_* neutrals must match the primary colour when you change it. The page templates (header_layout, header_style, header_sticky, menu_style, footer_layout, footer_tone, block_style, block_gap, content_w) belong to the theme: change them when the request is about layout.")
    if ref:
        system += (" The user also gave a web page as an example (reference_site, read from that page: its colours and fonts). Use those colours and fonts as the base for the new theme "
                   "(brand colour as primary, neutrals for the backgrounds and text) but still follow the request, and keep the result readable in light and dark.")
    prompt = json.dumps({"request": ask, "current_values": values, "site": site, "settings": _schema_for_ai(), **({"reference_site": ref} if ref else {})}, ensure_ascii=False)
    try:
        out = _ai_json(system, prompt, 3500, 90)
    except (ValueError, KeyError) as e:
        raise themepacks.ThemeError(f"Claude kon het thema niet aanpassen: {e}")
    clean, errors = T.validate({k: v for k, v in (out.get("values") or {}).items() if k in T.FIELDS})
    changes = {k: v for k, v in clean.items() if k not in errors and values.get(k) != v}
    if not changes:
        raise themepacks.ThemeError("Claude had geen aanpassingen. Probeer het anders te omschrijven.")
    return changes, str(out.get("summary") or f"{len(changes)} instellingen aangepast.")[:300], str(out.get("name") or "")[:60], str(out.get("description") or "")[:300]


def refine(job, request_text):
    """Claude changes the draft the way the user asks (colours, shapes, fonts, popups …). Returns a short Dutch summary of what changed."""
    if job.status != "done" or not job.draft:
        raise themepacks.ThemeError("Dit thema is nog niet klaar.")
    if not ai.available():
        raise themepacks.ThemeError("Koppel Claude eerst bij Admin → API keys (Anthropic) en zet de koppeling aan.")
    ask = (request_text or "").strip()[:800]
    if len(ask) < 3:
        raise themepacks.ThemeError("Schrijf wat er anders moet.")
    d = job.draft
    system = ("You are a web designer who improves a theme for a content management system. The user asks for a change. "
              "Answer with ONE JSON object only, no text around it: {\"values\": {setting: value}, \"summary\": one short Dutch sentence about what you changed, \"name\": optional new name, \"description\": optional new Dutch sentence}. "
              "In values only put the settings that change, with the right type (hex colours like #aabbcc, numbers within the range, one of the options). Keep the result consistent: "
              "text must stay readable on its background in light and dark, and light_*/dark_* neutrals must match the primary colour when you change it. Follow the request of the user over the original colours of the site.")
    prompt = json.dumps({"request": ask, "current_values": d["values"], "site": d.get("address"), "settings": _schema_for_ai()}, ensure_ascii=False)
    try:
        out = _ai_json(system, prompt, 3500, 90)
    except (ValueError, KeyError) as e:
        raise themepacks.ThemeError(f"Claude kon het thema niet aanpassen: {e}")
    clean, errors = T.validate({k: v for k, v in (out.get("values") or {}).items() if k in T.FIELDS})
    changes = {k: v for k, v in clean.items() if k not in errors and d["values"].get(k) != v}
    if not changes:
        raise themepacks.ThemeError("Claude had geen aanpassingen. Probeer het anders te omschrijven.")
    d["history"] = [*d.get("history", []), {"values": d["values"], "name": d["name"], "description": d["description"]}][-5:]
    d["values"] = {**d["values"], **changes}
    if out.get("name"):
        d["name"] = str(out["name"])[:60]
    if out.get("description"):
        d["description"] = str(out["description"])[:300]
    d["ai"] = True
    ThemeImportJob.objects.filter(pk=job.pk).update(draft=d)
    return str(out.get("summary") or f"{len(changes)} instellingen aangepast.")[:300]


def undo(job):
    d = job.draft
    if not d.get("history"):
        raise themepacks.ThemeError("Er is niets om ongedaan te maken.")
    prev = d["history"].pop()
    d["values"], d["name"], d["description"] = prev["values"], prev["name"], prev["description"]
    ThemeImportJob.objects.filter(pk=job.pk).update(draft=d)


def _objects(text):
    """Every balanced {...} piece of a text (string aware), longest first."""
    out, n = [], len(text)
    for start in (i for i, ch in enumerate(text) if ch == "{"):
        depth, i, in_str, esc = 0, start, False, False
        while i < n:
            ch = text[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
            elif ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    out.append(text[start:i + 1])
                    break
            i += 1
    return sorted(out, key=len, reverse=True)


def _repair(t):
    """Typical slips of a model: smart quotes, comments, trailing commas, single quotes, python constants."""
    t = t.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")
    t = re.sub(r"(?m)(^|[\s,{}\]])//[^\n\"]*$", r"\1", t)
    t = re.sub(r",\s*([}\]])", r"\1", t)
    t = re.sub(r"\bTrue\b", "true", t)
    t = re.sub(r"\bFalse\b", "false", t)
    t = re.sub(r"\bNone\b", "null", t)
    if '"' not in t:
        t = t.replace("'", '"')
    else:  # keys in single quotes: 'key':
        t = re.sub(r"'([\w-]+)'\s*:", r'"\1":', t)
        t = re.sub(r":\s*'([^'\"]*)'", r': "\1"', t)
    t = re.sub(r"([{,]\s*)([A-Za-z_][\w-]*)\s*:", r'\1"\2":', t)  # keys without quotes
    return t


def _parse_json(raw, need=("values", "name")):
    raw = re.sub(r"```(?:json)?", "", raw)
    for cand in _objects(raw):
        for text in (cand, _repair(cand)):
            try:
                d = json.loads(text)
            except ValueError:
                continue
            if isinstance(d, dict) and any(k in d for k in need):
                return d
    raise ValueError("geen bruikbaar antwoord")


def _ai_json(system, prompt, max_tokens, timeout):
    """Ask Claude for a JSON answer; one more try when the answer cannot be read."""
    try:
        return _parse_json(ai.claude(system, prompt, max_tokens=max_tokens, timeout=timeout))
    except ValueError as e:
        if "bruikbaar" not in str(e):
            raise
        retry = system + " Your previous answer could not be read. Answer again with valid JSON only: double quotes for every key and text, no comments, no trailing commas, no text before or after the object."
        return _parse_json(ai.claude(retry, prompt, max_tokens=max_tokens, timeout=timeout))


def _run(job_id):
    job = ThemeImportJob.objects.get(pk=job_id)
    try:
        fetcher = si.WebFetcher(job.url)
        _set(job, 5, "De website ophalen")
        base, data, _ = fetcher.get(job.url, si.MAX_HTML)
        root = si.parse_html(data.decode("utf-8", "replace"))
        title = si.find(root, "title")
        site_name = (next((m.attrs.get("content", "") for m in si.find(root, "meta") if m.attrs.get("property") == "og:site_name"), "") or (title[0].text() if title else "")).strip()
        site_name = re.split(r"\s[|–—-]\s", site_name)[0][:60] or urlparse(base).hostname
        desc = next((m.attrs.get("content", "") for m in si.find(root, "meta") if m.attrs.get("name") == "description"), "")[:300]

        _set(job, 18, "De stijlbladen lezen")
        css = "\n".join(" ".join(k for k in s.kids if isinstance(k, str)) for s in si.find(root, "style"))
        notes = []
        for l in [urljoin(base, l.attrs.get("href", "")) for l in si.find(root, "link", lambda n: "stylesheet" in n.attrs.get("rel", "").lower())][:si.MAX_STYLESHEETS]:
            try:
                if l.startswith("https://fonts.googleapis.com"):
                    css += f"\n/* {l} */"
                elif fetcher.same_site(l):
                    css += "\n" + fetcher.get(l, si.MAX_CSS)[1].decode("utf-8", "replace")
            except si.ImportError_ as e:
                notes.append(f"Stijlblad overgeslagen: {e}")

        _set(job, 38, "Kleuren, lettertypen en vormen bepalen")
        weight, bg, fg, fonts = si.analyse_css(css)
        tc = next((m.attrs.get("content") for m in si.find(root, "meta") if m.attrs.get("name") == "theme-color"), None)
        th = si.pick_theme(weight, bg, fg, fonts, tc)
        radius = si.css_radius(css)
        popup = si.suggest_popup(css, radius)
        btn = si.css_radius("".join(re.findall(r"(?:button|\.btn[\w-]*|input)[^{]*\{[^}]*\}", css, re.I)))
        values = dict(th["values"])
        for key, val in (("radius", si._clamp("radius", radius)), ("popup_radius", si._clamp("popup_radius", popup["radius"])), ("btn_radius", si._clamp("btn_radius", btn)), ("popup_btn_radius", si._clamp("popup_btn_radius", btn))):
            if val is not None:
                values[key] = val
        values["system_popup"] = popup["key"]
        values.update(guess_layout(css, values.get("primary"), False))
        tokens = site_tokens(css)
        values.update(tokens_to_values(tokens))  # the colours the site really defines win over the guess
        site_fonts = tokens["fonts"] or th["fonts"]
        if not site_fonts:
            values["font_body"] = values["font_heading"] = "System"  # no web font found: the site uses the system font

        _set(job, 52, "Logo, favicon en afbeeldingen ophalen")
        assets, home = {}, []

        def grab(slot, url):
            got = _image(fetcher, urljoin(base, url)) if url else None
            if got and slot not in assets:
                assets[slot] = {"ext": got[0], "b64": base64.b64encode(got[1]).decode()}

        for l in si.find(root, "link", lambda n: "icon" in n.attrs.get("rel", "").lower()):
            grab("icon" if "apple" in l.attrs.get("rel", "").lower() else "favicon", l.attrs.get("href", ""))
        if "favicon" not in assets and "icon" in assets:
            assets["favicon"] = assets["icon"]
        grab("og_image", next((m.attrs.get("content") for m in si.find(root, "meta") if m.attrs.get("property") == "og:image"), None))
        header_imgs = [i for h in (si.find(root, "header") + si.find(root, "nav")) for i in si.find(h, "img")]
        logo = next((i for i in header_imgs + si.find(root, "img", lambda n: "logo" in (n.attrs.get("src", "") + n.attrs.get("alt", "") + n.attrs.get("class", "")).lower())), None)
        if logo:
            grab("logo", logo.attrs.get("src", ""))
        from io import BytesIO

        from PIL import Image

        for im in si.find(si.main_node(root), "img"):
            if len(home) >= HOME_MAX:
                break
            got = _image(fetcher, urljoin(base, im.attrs.get("src", ""))) if im.attrs.get("src") else None
            if not got:
                continue
            try:
                if Image.open(BytesIO(got[1])).size[0] < 600:
                    continue
            except Exception:  # noqa: BLE001
                continue
            home.append({"ext": got[0], "b64": base64.b64encode(got[1]).decode(), "caption": (im.attrs.get("alt") or "")[:120]})
        if "logo" in assets:
            values["brand_logo"] = "custom"
        _set(job, 62, "De foto's van de website ophalen")
        photos = _collect_photos(job, fetcher, root, base, [base])

        name, description, used_ai = site_name, desc[:200] or f"Geïmporteerd van {urlparse(base).hostname}", False
        if ai.available():
            _set(job, 70, "Claude ontwerpt het thema")
            try:
                info = {"name": site_name, "address": base, "description": desc, "dark_site": th["dark"], "palette": th["palette"], "fonts": th["fonts"], "radius": radius, "button_radius": btn,
                        "popup_suggestion": popup["key"], "site_tokens": tokens, "fonts_found": site_fonts, "heuristic_values": values, "text": si.main_node(root).text()[:700]}
                out = _ask_ai(info)
                clean, errors = T.validate({k: v for k, v in (out.get("values") or {}).items() if k in T.FIELDS})
                values.update({k: v for k, v in clean.items() if k not in errors})
                name = str(out.get("name") or name)[:60]
                description = str(out.get("description") or description)[:300]
                used_ai = True
            except (ValueError, KeyError, TypeError) as e:
                notes.append(f"Claude kon het thema niet maken ({e}). Het thema is afgeleid uit de kleuren en lettertypen van de site.")

        _set(job, 92, "Het thema samenstellen")
        clean, _errors = T.validate(_complete(values))
        ThemeImportJob.objects.filter(pk=job.pk).update(status="done", progress=100, step="Klaar", draft={
            "name": name, "description": description, "values": clean, "assets": assets, "home": home, "ai": used_ai, "notes": notes, "address": base, "photos": photos})
    except (si.ImportError_, themepacks.ThemeError) as e:
        ThemeImportJob.objects.filter(pk=job.pk).update(status="error", error=str(e))
    except Exception as e:  # noqa: BLE001 - the user sees what went wrong, the site stays up
        logger.exception("Theme import of %s failed", job.url)
        ThemeImportJob.objects.filter(pk=job.pk).update(status="error", error=f"Het importeren is mislukt: {e}")
    finally:
        db.connections.close_all()


def _photos_to_library(job, indexes, user, slug):
    """The chosen pictures go into the media library (Admin -> Media) with the tags import and the theme."""
    from django.core.files.base import ContentFile
    from django.core.files.storage import default_storage
    from django.utils.text import get_valid_filename

    from apps.medialib import areas
    from apps.medialib.models import MediaItem

    n = 0
    for i in indexes:
        photos = job.draft.get("photos", [])
        if not 0 <= i < len(photos):
            continue
        p = photos[i]
        with default_storage.open(p["key"], "rb") as fh:
            data = fh.read()
        today = date.today()
        stored = default_storage.save(areas.site_path("library", f"{today:%Y/%m}/{uuid.uuid4().hex[:8]}-{get_valid_filename(p['name'])}"), ContentFile(data))
        item = MediaItem.objects.get(key=stored)
        item.name, item.uploaded_by, item.tags = p["name"][:255], user, ["import", slug[:28]]
        item.save(update_fields=["name", "uploaded_by", "tags"])
        n += 1
    return n


def public(job):
    """The job for the browser: pictures as data urls."""
    d = dict(job.draft or {})
    if d:
        url = lambda x: f"data:image/{'x-icon' if x['ext'] == 'ico' else ('jpeg' if x['ext'] == 'jpg' else x['ext'])};base64,{x['b64']}"  # noqa: E731
        d["assets"] = {k: {"ext": v["ext"], "url": url(v)} for k, v in d.get("assets", {}).items()}
        d["home"] = [{"ext": h["ext"], "url": url(h), "caption": h.get("caption", "")} for h in d.get("home", [])]
    if d:
        d["photos"] = [{"name": p["name"], "w": p["w"], "h": p["h"], "size": p["size"], "url": f"data:{p.get('mime', 'image/jpeg')};base64," + p["thumb"]} for p in d.get("photos", [])]
    if d:
        d["can_undo"] = bool(d.pop("history", []))
    return {"id": str(job.pk), "status": job.status, "progress": job.progress, "step": job.step, "error": job.error, "draft": d, "url": job.url, "ai": ai.available()}


def save(job, name, description, use_assets, use_home, values=None, use_photos=(), user=None):
    """The checked draft becomes a theme package. use_assets: slots to keep; use_home: indexes of home pictures to keep."""
    d = job.draft
    if job.status != "done" or not d:
        raise themepacks.ThemeError("Dit thema is nog niet klaar.")
    key = themepacks.create(name or d["name"])
    doc = themepacks._doc(key)
    doc["description"] = (description if description is not None else d["description"])[:300]
    doc["values"] = values if values else d["values"]
    clean, errors = T.validate(doc["values"])
    if errors:
        raise themepacks.ThemeError("Ongeldige instellingen: " + ", ".join(sorted(errors)))
    doc["values"] = clean
    themepacks._save_doc(key, doc)
    for slot, a in d.get("assets", {}).items():
        if slot in use_assets:
            themepacks.set_slot(key, slot, base64.b64decode(a["b64"]))
    for i, h in enumerate(d.get("home", [])):
        if i in use_home:
            themepacks.add_home(key, base64.b64decode(h["b64"]), h.get("caption", ""))
    imported = _photos_to_library(job, use_photos, user, key) if use_photos else 0
    cleanup(job)
    job.delete()
    return key, imported

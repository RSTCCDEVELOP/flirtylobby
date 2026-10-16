"""
Read in another website and turn it into: a theme (colours + fonts), a basic home page, pages, icons and pictures.

Safe by design: addresses may only be public http(s) hosts (no internal network), redirects are re-checked, sizes and counts are
limited, a folder import is limited to the imports folder, ZIP files are unpacked without leaving their folder, and all text goes
through the same HTML sanitizer as the rich text editor. Nothing is applied to the live site by the import itself: the theme and the
home page are options that the user switches on (and off) afterwards.
"""
import colorsys
import html as htmllib
import ipaddress
import logging
import mimetypes
import os
import re
import socket
import time
import urllib.error
import urllib.request
import uuid
import zipfile
from collections import Counter
from datetime import date
from html.parser import HTMLParser
from urllib.parse import urljoin, urldefrag, urlparse

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils.text import get_valid_filename, slugify

from apps.core import richtext, theme as T
from apps.core.models import ContentBlock, Language
from apps.medialib.models import IMAGE_EXT, MediaItem, kind_of
from apps.pages.models import Page

from .models import SiteImport

logger = logging.getLogger(__name__)
UA = "Mozilla/5.0 (compatible; SiteImport/1.0)"
MAX_HTML, MAX_CSS, MAX_IMG, MAX_TOTAL = 2 * 2**20, 600 * 1024, 4 * 2**20, 40 * 2**20
MAX_PAGES, MAX_IMAGES, MAX_STYLESHEETS, DEADLINE = 12, 40, 5, 90
VIRTUAL = "http://site.local/"  # base address used for folder / ZIP imports


class ImportError_(Exception):
    pass


# ── fetching ─────────────────────────────────────────────────────────────────
class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


_opener = urllib.request.build_opener(_NoRedirect)


def check_public(url):
    """Only public http(s) hosts. Raises ImportError_ for anything that points at the internal network."""
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise ImportError_("Alleen http(s)-adressen zijn toegestaan.")
    if p.port not in (None, 80, 443, 8080, 8443):
        raise ImportError_("Deze poort is niet toegestaan.")
    try:
        infos = socket.getaddrinfo(p.hostname, p.port or (443 if p.scheme == "https" else 80), proto=socket.IPPROTO_TCP)
    except OSError:
        raise ImportError_("Het adres is niet gevonden.")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
            raise ImportError_("Dit adres is niet toegestaan (het wijst naar een intern netwerk).")


class WebFetcher:
    virtual = False

    def __init__(self, start):
        self.start, self.total, self.t0 = start, 0, time.time()

    def get(self, url, limit):
        for _ in range(5):
            if time.time() - self.t0 > DEADLINE:
                raise ImportError_("Het inlezen duurde te lang.")
            check_public(url)
            try:
                res = _opener.open(urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"}), timeout=10)
            except urllib.error.HTTPError as e:
                loc = e.headers.get("Location") if e.code in (301, 302, 303, 307, 308) else None
                if loc:
                    url = urljoin(url, loc)
                    continue
                raise ImportError_(f"HTTP {e.code} bij {url}")
            except Exception as e:  # noqa: BLE001
                raise ImportError_(f"Geen verbinding met {url}: {e}")
            data = res.read(limit + 1)
            if len(data) > limit:
                raise ImportError_("Bestand is te groot.")
            self.total += len(data)
            if self.total > MAX_TOTAL:
                raise ImportError_("De site is in totaal te groot om in te lezen.")
            return url, data, res.headers.get_content_type()
        raise ImportError_("Te veel doorverwijzingen.")

    def same_site(self, url):
        a, b = urlparse(url).hostname or "", urlparse(self.start).hostname or ""
        return a == b or a == "www." + b or b == "www." + a


class FolderFetcher:
    """A folder on the server (already inside the imports folder, or unpacked from a ZIP) served as if it were a website."""
    virtual = True

    def __init__(self, root):
        self.root, self.total, self.start = os.path.realpath(root), 0, VIRTUAL

    def get(self, url, limit):
        path = urlparse(url).path.lstrip("/")
        full = os.path.realpath(os.path.join(self.root, path))
        if full != self.root and not full.startswith(self.root + os.sep):
            raise ImportError_("Bestand ligt buiten de map.")
        if os.path.isdir(full):
            full = os.path.join(full, "index.html")
        if not os.path.isfile(full):
            raise ImportError_(f"Niet gevonden: {path or 'index.html'}")
        if os.path.getsize(full) > limit:
            raise ImportError_("Bestand is te groot.")
        with open(full, "rb") as fh:
            data = fh.read()
        self.total += len(data)
        return url, data, mimetypes.guess_type(full)[0] or "application/octet-stream"

    def same_site(self, url):
        return urlparse(url).hostname == urlparse(VIRTUAL).hostname


# ── a tiny HTML tree ─────────────────────────────────────────────────────────
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class Node:
    __slots__ = ("tag", "attrs", "kids", "parent")

    def __init__(self, tag, attrs=None, parent=None):
        self.tag, self.attrs, self.kids, self.parent = tag, dict(attrs or {}), [], parent

    def walk(self):
        yield self
        for k in self.kids:
            if isinstance(k, Node):
                yield from k.walk()

    def text(self):
        return " ".join(" ".join(k if isinstance(k, str) else k.text() for k in self.kids).split())


class _Builder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root")
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, {k: (v or "") for k, v in attrs}, self.cur)
        self.cur.kids.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.kids.append(Node(tag, {k: (v or "") for k, v in attrs}, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n and n.tag != tag:
            n = n.parent
        if n and n.parent:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.kids.append(data)


def parse_html(text):
    b = _Builder()
    b.feed(text[:MAX_HTML])
    return b.root


def find(node, tag=None, pred=None):
    return [n for n in node.walk() if (tag is None or n.tag == tag) and (pred is None or pred(n))]


# ── colours and fonts ────────────────────────────────────────────────────────
HEX_RE = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z])")
RGB_RE = re.compile(r"rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})")
GENERIC = {"serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "inherit", "initial", "ui-sans-serif", "ui-serif", "ui-monospace",
           "-apple-system", "blinkmacsystemfont", "segoe ui", "arial", "helvetica", "helvetica neue", "times new roman", "verdana", "georgia", "tahoma"}


def _hex(rgb):
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def _rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _hls(h):
    r, g, b = (c / 255 for c in _rgb(h))
    return colorsys.rgb_to_hls(r, g, b)  # hue 0-1, lightness, saturation


def colors_in(css):
    out = []
    for m in HEX_RE.finditer(css):
        out.append(_hex(_rgb(m.group(0))))
    for m in RGB_RE.finditer(css):
        out.append(_hex(tuple(min(255, int(x)) for x in m.groups())))
    return out


def analyse_css(css):
    """-> palette (list of hex, most important first), body background/text colour, font families (most used first)."""
    weight = Counter()
    for c in colors_in(css):
        weight[c] += 1
    for m in re.finditer(r"--[\w-]*(?:primary|brand|accent|main|theme)[\w-]*\s*:\s*([^;}]+)", css, re.I):  # named brand colours count more
        for c in colors_in(m.group(1)):
            weight[c] += 25
    body_bg = body_fg = None
    for m in re.finditer(r"(?:^|[}\s,])(?:html|body)\s*(?:,\s*(?:html|body))?\s*\{([^}]*)\}", css, re.I):
        block = m.group(1)
        b = re.search(r"background(?:-color)?\s*:\s*([^;]+)", block, re.I)
        f = re.search(r"(?<![\w-])color\s*:\s*([^;]+)", block, re.I)
        body_bg = body_bg or ((colors_in(b.group(1)) or [None])[0] if b else None)
        body_fg = body_fg or ((colors_in(f.group(1)) or [None])[0] if f else None)
    fonts = Counter()
    for m in re.finditer(r"font-family\s*:\s*([^;}{]+)", css, re.I):
        for fam in m.group(1).split(","):
            name = fam.strip().strip("'\"").strip()
            if name and name.lower() not in GENERIC and not name.startswith("var("):
                fonts[name] += 1
    for m in re.finditer(r"family=([A-Za-z0-9+ ]+)", css):  # Google Fonts addresses
        fonts[m.group(1).replace("+", " ")] += 2
    return weight, body_bg, body_fg, [f for f, _ in fonts.most_common(4)]


def pick_theme(weight, body_bg, body_fg, fonts, theme_color=None):
    """Turn what was found into theme values (see apps/core/theme.py): primary, secondary, matching neutrals, fonts, light/dark."""
    if theme_color and HEX_RE.fullmatch(theme_color.strip()):
        weight[_hex(_rgb(theme_color.strip()))] += 40

    def vivid(c):
        h, l, s = _hls(c)
        return s >= 0.35 and 0.18 <= l <= 0.78

    ranked = [c for c, _ in weight.most_common() if vivid(c)]
    primary = ranked[0] if ranked else "#1b97d3"
    secondary = next((c for c in ranked[1:] if abs(_hls(c)[0] - _hls(primary)[0]) * 360 >= 25 and abs(_hls(c)[0] - _hls(primary)[0]) * 360 <= 335), "#f08a35")
    hue = _hls(primary)[0] * 360
    dark_site = bool(body_bg) and _hls(body_bg)[1] < 0.35
    values = {"primary": primary, "secondary": secondary, **T._neutrals(hue, 0.25)}
    values["chat_color"] = primary  # chat button and popup frame follow the imported colours, not the defaults
    values["popup_border_color"] = values["light_line"]
    if dark_site:
        values["default_mode"] = "dark"
    known = {f["value"].lower(): f["value"] for f in T.FONTS}
    matched = [known[f.lower()] for f in fonts if f.lower() in known]
    if matched:
        values["font_body"] = matched[0]
        values["font_heading"] = matched[1] if len(matched) > 1 else matched[0]
    clean, _errors = T.validate(values)
    palette = [c for c, _ in weight.most_common(8)]
    return {"values": clean, "palette": palette, "fonts": fonts, "dark": dark_site}


# ── content -> clean rich text ───────────────────────────────────────────────
SKIP = {"script", "style", "nav", "header", "footer", "form", "noscript", "svg", "iframe", "button", "aside", "select", "input", "textarea", "template", "head", "video", "audio", "canvas", "object"}
BLOCKS = {"h1": "h2", "h2": "h2", "h3": "h3", "h4": "h4", "h5": "h4", "h6": "h4", "p": "p", "ul": "ul", "ol": "ol", "li": "li", "blockquote": "blockquote"}
INLINE = {"strong": "strong", "b": "strong", "em": "em", "i": "em"}


class Ctx:
    def __init__(self, imp, fetcher, page_url, images):
        self.imp, self.fetcher, self.page_url, self.images = imp, fetcher, page_url, images

    def link(self, href):
        href = (href or "").strip()
        if not href or href.startswith(("#", "javascript:")):
            return ""
        absu = urljoin(self.page_url, href)
        if absu.startswith(("mailto:", "tel:")):
            return absu
        if self.fetcher.virtual and absu.startswith(VIRTUAL):
            return ""  # a link to a file of the imported folder: has no address of its own on this site
        return absu if absu.startswith(("http://", "https://")) else ""

    def image(self, src, alt):
        key = self.images.fetch(urljoin(self.page_url, src or ""), role="image", alt=alt)
        return f'<img data-file="{htmllib.escape(key, quote=True)}" alt="{htmllib.escape(alt or "", quote=True)}">' if key else ""


def to_html(node, ctx, depth=0):
    out = []
    for k in node.kids:
        if isinstance(k, str):
            t = " ".join(k.split())
            if t:
                out.append(htmllib.escape(t) + " ")
            continue
        tag = k.tag
        if tag in SKIP or depth > 40:
            continue
        inner = to_html(k, ctx, depth + 1)
        if tag in BLOCKS:
            if inner.strip():
                out.append(f"<{BLOCKS[tag]}>{inner.strip()}</{BLOCKS[tag]}>")
        elif tag in INLINE:
            if inner.strip():
                out.append(f"<{INLINE[tag]}>{inner.strip()}</{INLINE[tag]}> ")
        elif tag == "a":
            href = ctx.link(k.attrs.get("href"))
            out.append(f'<a href="{htmllib.escape(href, quote=True)}">{inner.strip()}</a> ' if href and inner.strip() else inner)
        elif tag == "br":
            out.append("<br>")
        elif tag == "hr":
            out.append("<hr>")
        elif tag == "img":
            out.append(ctx.image(k.attrs.get("src") or k.attrs.get("data-src"), k.attrs.get("alt", "")))
        else:  # div, section, span, table cells, …: keep what is inside
            out.append(inner)
    return "".join(out)


def main_node(root):
    for pred in (lambda n: n.tag == "main", lambda n: n.tag == "article", lambda n: n.attrs.get("role") == "main", lambda n: n.tag == "body"):
        hit = find(root, pred=pred)
        if hit:
            return hit[0]
    return root


def tidy(html_text):
    h = re.sub(r"(<br>\s*){3,}", "<br><br>", html_text)
    h = re.sub(r"<p>\s*</p>", "", h)
    return h[: richtext.MAX * 2]  # sanitized later, when the proposal is approved


def text_preview(html_text, n=240):
    return " ".join(re.sub(r"<[^>]+>", " ", html_text).split())[:n]


# ── pictures: written into the theme folder, registered in the library only after approval ──
def theme_dir(slug):
    return os.path.join(str(settings.MEDIA_ROOT), "themes", slug)


class Images:
    def __init__(self, slug, fetcher):
        self.slug, self.f, self.cache, self.items = slug, fetcher, {}, []

    def fetch(self, url, role="image", alt="", name=""):
        """Download one picture into themes/<slug>/img/. Returns its key (path below the media folder) or None."""
        url = urldefrag(url)[0]
        if not url.startswith(("http://", "https://")) or not self.f.same_site(url):
            return None
        if url in self.cache:
            return self.cache[url]
        self.cache[url] = None
        if len(self.items) >= MAX_IMAGES:
            return None
        ext = os.path.splitext(urlparse(url).path)[1].lower().lstrip(".")
        if ext not in IMAGE_EXT:
            return None
        try:
            _, data, _ct = self.f.get(url, MAX_IMG)
        except ImportError_:
            return None
        if ext != "ico":
            try:
                from io import BytesIO

                from PIL import Image

                Image.open(BytesIO(data)).verify()
            except Exception:  # noqa: BLE001
                return None
        base = get_valid_filename(os.path.basename(urlparse(url).path)) or f"image.{ext}"
        rel = f"themes/{self.slug}/img/{uuid.uuid4().hex[:6]}-{base}"
        full = os.path.join(str(settings.MEDIA_ROOT), rel)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "wb") as fh:
            fh.write(data)
        self.cache[url] = rel
        self.items.append({"file": rel, "role": role, "name": (name or alt or base)[:120], "src": url, "include": True, "size": len(data)})
        return rel


def _links(root, base_url, fetcher):
    """Same-site links of the navigation (else of the header), no files, no anchors and not the home page itself."""
    nav = find(root, "nav") or find(root, "header") or []
    seen, out = set(), []
    for container in nav[:3]:
        for a in find(container, "a"):
            href = urldefrag(urljoin(base_url, a.attrs.get("href", "")))[0]
            ext = os.path.splitext(urlparse(href).path)[1].lower()
            if not href.startswith(("http://", "https://")) or not fetcher.same_site(href) or ext not in ("", ".html", ".htm", ".php"):
                continue
            key = re.sub(r"/(index|home|default)\.(html?|php)$", "", urlparse(href).path).rstrip("/") or "/"
            if key == "/" or key in seen:
                continue
            seen.add(key)
            out.append((href, a.text() or key.rsplit("/", 1)[-1]))
    return out[:MAX_PAGES]


def _lang():
    return Language.objects.filter(is_default=True).values_list("code", flat=True).first() or "nl"


# ── suggestions ──────────────────────────────────────────────────────────────
PROFILE_WORDS = {
    "dating": ["dating", "relatie", "match", "single", "ontmoet", "liefde", "love", "partner zoeken", "flirt"],
    "sporters": ["sport", "training", "fitness", "hardlop", "club", "wedstrijd", "yoga", "coach", "marathon", "zwem"],
    "business": ["bedrijf", "zakelijk", "netwerk", "consult", "advies", "diensten", "b2b", "vacature", "oplossingen", "klanten", "expertise"],
    "webshop": ["winkel", "webshop", "bestel", "producten", "verzending", "korting", "winkelwagen", "shop", "bezorg", "assortiment"],
}


def suggest_profile(text):
    t = text.lower()
    score = {k: sum(t.count(w) for w in ws) for k, ws in PROFILE_WORDS.items()}
    best = max(score, key=score.get)
    if score[best] < 2:
        return {"key": "normal", "reason": "Geen duidelijk type gevonden: een gewoon ledenprofiel past het best.", "scores": score}
    found = [w for w in PROFILE_WORDS[best] if w in t][:4]
    return {"key": best, "reason": "Gevonden woorden: " + ", ".join(found) + ".", "scores": score}


def css_radius(css):
    vals = []
    for m in re.finditer(r"border-radius\s*:\s*(\d+(?:\.\d+)?)(px|rem|em)", css, re.I):
        v = float(m.group(1)) * (16 if m.group(2) != "px" else 1)
        if 0 <= v <= 60:
            vals.append(round(v))
    return Counter(vals).most_common(1)[0][0] if vals else None


def suggest_popup(css, radius):
    if re.search(r"backdrop-filter\s*:\s*blur", css, re.I):
        return {"key": "glass", "reason": "De site gebruikt doorzichtige vlakken met vervaging.", "radius": max(radius or 20, 16)}
    if re.search(r"box-shadow\s*:\s*\d+px\s+\d+px\s+0(?:px)?\s", css, re.I) or re.search(r"border(?:-width)?\s*:\s*[3-9]px", css, re.I):
        return {"key": "bold", "reason": "De site heeft dikke randen of harde schaduwen.", "radius": min(radius or 4, 8)}
    if radius is not None and radius <= 2 and not re.search(r"box-shadow", css, re.I):
        return {"key": "minimal", "reason": "De site is vlak: geen afronding en geen schaduwen.", "radius": radius}
    return {"key": "clean", "reason": "Een rustig venster past bij de stijl van de site.", "radius": radius if radius is not None else 14}


def _clamp(key, v):
    f = T.FIELDS.get(key)
    return max(f["min"], min(f["max"], v)) if f and v is not None else None


# ── step 1: analyse (nothing is added to the site yet) ───────────────────────
def unique_slug(name):
    base = slugify(name)[:40] or "thema"
    slug, n = base, 2
    while SiteImport.objects.filter(slug=slug).exists() or os.path.exists(theme_dir(slug)):
        slug, n = f"{base}-{n}", n + 1
    return slug


def analyze(fetcher, start_url, theme_name, kind, source, user):
    """Read the site and make a proposal (theme, profiles, popups, pages, pictures). Files go into themes/<name>/;
    the library, pages and settings are only touched after the user approves the proposal."""
    name = (theme_name or "").strip()[:120] or "Geïmporteerde site"
    slug = unique_slug(name)
    imp = SiteImport.objects.create(name=name, slug=slug, status="proposal", source=source[:500], kind=kind, created_by=user)
    try:
        base, data, _ = fetcher.get(start_url, MAX_HTML)
        root = parse_html(data.decode("utf-8", "replace"))
        title_el = find(root, "title")
        site_name = (next((m.attrs.get("content", "") for m in find(root, "meta") if m.attrs.get("property") == "og:site_name"), "") or (title_el[0].text() if title_el else "")).strip()
        site_name = re.split(r"\s[|–—-]\s", site_name)[0][:120]
        if not theme_name and site_name:
            imp.name = site_name
        notes = []

        css = "\n".join(" ".join(k for k in s.kids if isinstance(k, str)) for s in find(root, "style"))
        sheets = [urljoin(base, l.attrs.get("href", "")) for l in find(root, "link", lambda n: "stylesheet" in n.attrs.get("rel", "").lower())][:MAX_STYLESHEETS]
        for s in sheets:
            try:
                if s.startswith("https://fonts.googleapis.com") and not fetcher.virtual:
                    css += f"\n/* {s} */"
                elif fetcher.same_site(s):
                    css += "\n" + fetcher.get(s, MAX_CSS)[1].decode("utf-8", "replace")
            except ImportError_ as e:
                notes.append(f"Stijlblad overgeslagen: {e}")
        weight, bg, fg, fonts = analyse_css(css)
        tc = next((m.attrs.get("content") for m in find(root, "meta") if m.attrs.get("name") == "theme-color"), None)
        th = pick_theme(weight, bg, fg, fonts, tc)
        radius = css_radius(css)
        popup = suggest_popup(css, radius)
        btn = css_radius("".join(re.findall(r"(?:button|\.btn[\w-]*|input)[^{]*\{[^}]*\}", css, re.I)))
        for key, val in (("radius", _clamp("radius", radius)), ("popup_radius", _clamp("popup_radius", popup["radius"])),
                         ("btn_radius", _clamp("btn_radius", btn)), ("popup_btn_radius", _clamp("popup_btn_radius", btn))):
            if val is not None:
                th["values"][key] = val

        images = Images(slug, fetcher)
        for l in find(root, "link", lambda n: "icon" in n.attrs.get("rel", "").lower()):
            images.fetch(urljoin(base, l.attrs.get("href", "")), role="icon" if "apple" in l.attrs.get("rel", "").lower() else "favicon", name="Icoon van de site")
        og = next((m.attrs.get("content") for m in find(root, "meta") if m.attrs.get("property") == "og:image"), None)
        if og:
            images.fetch(urljoin(base, og), role="og_image", name="Deelafbeelding")
        header_imgs = [i for h in (find(root, "header") + find(root, "nav")) for i in find(h, "img")]
        logo = next((i for i in header_imgs + find(root, "img", lambda n: "logo" in (n.attrs.get("src", "") + n.attrs.get("alt", "") + n.attrs.get("class", "")).lower())), None)
        if logo:
            images.fetch(urljoin(base, logo.attrs.get("src", "")), role="logo", name="Logo van de site")

        ctx = Ctx(imp, fetcher, base, images)
        main = main_node(root)
        h1 = find(main, "h1")
        home_html = tidy(to_html(main, ctx))
        home = {"title": (h1[0].text() if h1 else imp.name)[:200], "html": home_html, "preview": text_preview(home_html), "include": True}
        pages, all_text = [], home["title"] + " " + home["preview"]
        for href, label in _links(root, base, fetcher):
            try:
                url2, d2, _ = fetcher.get(href, MAX_HTML)
            except ImportError_ as e:
                notes.append(f"Pagina overgeslagen ({label}): {e}")
                continue
            m2 = main_node(parse_html(d2.decode("utf-8", "replace")))
            h = find(m2, "h1")
            body = tidy(to_html(m2, Ctx(imp, fetcher, url2, images)))
            title = (h[0].text() if h else label or "Pagina")[:80]
            pages.append({"title": title, "path": urlparse(url2).path or "/", "in_menu": True, "include": True, "html": body, "preview": text_preview(body)})
            all_text += " " + title + " " + text_preview(body, 600)
        if len(images.items) >= MAX_IMAGES:
            notes.append(f"{MAX_IMAGES} afbeeldingen is het maximum; de rest is overgeslagen.")

        profile = suggest_profile(all_text)
        imp.proposal = {
            "theme": {"name": imp.name, "values": th["values"], "palette": th["palette"], "fonts": th["fonts"], "dark": th["dark"], "include": True},
            "profile": {"key": profile["key"], "reason": profile["reason"], "apply": True},
            "popup": {"key": popup["key"], "reason": popup["reason"], "apply": True},
            "home": home, "pages": pages, "assets": images.items,
        }
        imp.notes = notes
        imp.save()
        return imp
    except Exception:
        remove_import(imp)  # a failed analysis leaves nothing behind
        raise


# ── step 2: approval → create everything ─────────────────────────────────────
def _register_file(rel, name, imp):
    full = os.path.join(str(settings.MEDIA_ROOT), rel)
    item, _ = MediaItem.objects.get_or_create(key=rel, defaults={"name": name[:255], "kind": kind_of(rel), "mime": mimetypes.guess_type(rel)[0] or "", "size": os.path.getsize(full), "storage": "local"})
    item.name, item.source, item.tags = name[:255], imp.tag, ["import", imp.slug[:28]]
    item.save(update_fields=["name", "source", "tags"])
    return item


def approve(imp, choice):
    """`choice` = what the user left on after checking the proposal (names, colours, ticks). Creates the theme package, the pages and
    registers the pictures. The theme itself is switched on separately ("Thema gebruiken")."""
    if imp.status != "proposal":
        raise ImportError_("Deze import is al verwerkt.")
    pr = imp.proposal
    th = pr["theme"]
    name = str(choice.get("name") or th["name"]).strip()[:120] or imp.name
    values = dict(th["values"])
    for k in ("primary", "secondary"):  # colours may have been adjusted
        v = (choice.get("colors") or {}).get(k)
        if isinstance(v, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", v):
            values[k] = v.lower()
    if values.get("chat_color") == th["values"].get("primary"):
        values["chat_color"] = values["primary"]  # keeps following the primary colour when it was adjusted
    prof_key = choice.get("profile") if choice.get("profile") in PROFILE_WORDS or choice.get("profile") == "normal" else None
    popup_key = choice.get("popup") if choice.get("popup") in ("clean", "header", "glass", "minimal", "bold") else None
    if popup_key:
        values["system_popup"] = popup_key
    values, _errs = T.validate(values)

    # pictures: keep the ticked ones, remove the other files from the theme folder
    keep = {a["file"]: a for a in (choice.get("assets") or []) if a.get("include")}
    idmap, assets = {}, []
    for a in pr["assets"]:
        c = keep.get(a["file"])
        if c:
            item = _register_file(a["file"], a["name"], imp)
            idmap[a["file"]] = item.id
            role = c.get("role") if c.get("role") in ("logo", "logo_dark", "favicon", "icon", "og_image", "image") else a["role"]
            assets.append({"media": item.id, "role": role, "name": a["name"], "src": a["src"]})
        else:
            try:
                os.remove(os.path.join(str(settings.MEDIA_ROOT), a["file"]))
            except OSError:
                pass

    def final(html_text):
        def fix(m):
            mid = idmap.get(htmllib.unescape(m.group(1)))
            return f'<img data-media="{mid}" alt="{m.group(2)}">' if mid else ""
        return richtext.clean(re.sub(r'<img data-file="([^"]*)" alt="([^"]*)">', fix, html_text))[: richtext.MAX]

    lang = _lang()
    n_order = (Page.objects.order_by("-order").values_list("order", flat=True).first() or 0) + 1
    made = 0
    for sel in choice.get("pages") or []:
        try:
            src = pr["pages"][int(sel["i"])]
        except (KeyError, ValueError, IndexError, TypeError):
            continue
        if not sel.get("include"):
            continue
        title = str(sel.get("title") or src["title"]).strip()[:80] or "Pagina"
        key = f"{imp.slug[:22]}-{slugify(title)[:26] or 'pagina'}".strip("-")[:58]
        while Page.objects.filter(key=key).exists():
            key = f"{key[:54]}-{uuid.uuid4().hex[:3]}"
        Page.objects.create(key=key, kind="content", title={lang: title}, in_menu=bool(sel.get("in_menu")), enabled=True, order=n_order + made, source=imp.tag)
        ContentBlock.objects.update_or_create(key=f"page.{key}.body", lang=lang, defaults={"text": richtext.PREFIX + final(src["html"])})
        made += 1
    home = pr["home"]
    imp.home = {"title": home["title"], "html": final(home["html"])} if (choice.get("home") or {}).get("include", True) else {}
    imp.theme = {"values": values, "palette": th["palette"], "fonts": th["fonts"], "dark": th["dark"],
                 "popup": popup_key, "profile": prof_key, "profile_reason": pr["profile"]["reason"], "popup_reason": pr["popup"]["reason"]}
    imp.name, imp.assets, imp.proposal, imp.status = name, assets, {}, "imported"
    imp.save()
    try:  # the package as a plain file next to its pictures: easy to find, copy and back up
        import json

        with open(os.path.join(theme_dir(imp.slug), "theme.json"), "w", encoding="utf-8") as fh:
            json.dump({"name": name, "source": imp.source, "theme": imp.theme, "home": imp.home, "assets": assets}, fh, ensure_ascii=False, indent=2)
    except OSError:
        pass
    return imp


# ── apply / revert / remove ──────────────────────────────────────────────────
def apply_theme(imp):
    """Switch the package on: colours/fonts/popup look (Vormgeving) and, when chosen, the community profile theme."""
    from apps.core.models import SiteSettings

    obj = SiteSettings.load()
    cur = dict(obj.theme or {})
    if not imp.theme_applied:
        imp.theme_backup = {"values": {k: cur.get(k) for k in imp.theme["values"]}}
    cur.update(imp.theme["values"])
    obj.theme = cur
    obj.save()
    prof = imp.theme.get("profile")
    if prof and "profile" not in imp.theme_backup:
        from apps.social import service as social
        from apps.social import themes as ST
        from apps.social.models import SocialSettings

        so, _ = SocialSettings.objects.get_or_create(pk=1)
        imp.theme_backup["profile"] = {"had": "profiles" in (so.data or {}), "data": (so.data or {}).get("profiles")}
        social.save({"profiles": ST.theme_payload(prof)}, ["profiles"])
    imp.theme_applied = True
    imp.save(update_fields=["theme_applied", "theme_backup"])


def revert_theme(imp):
    from apps.core.models import SiteSettings

    if not imp.theme_applied:
        return
    obj = SiteSettings.load()
    cur = dict(obj.theme or {})
    for k, v in ((imp.theme_backup or {}).get("values") or {}).items():
        if v is None:
            cur.pop(k, None)
        else:
            cur[k] = v
    obj.theme = cur
    obj.save()
    prev = (imp.theme_backup or {}).get("profile")
    if prev:
        from apps.social.models import SocialSettings

        so, _ = SocialSettings.objects.get_or_create(pk=1)
        data = dict(so.data or {})
        if prev["had"]:
            data["profiles"] = prev["data"]
        else:
            data.pop("profiles", None)
        so.data = data
        so.save()
    imp.theme_applied, imp.theme_backup = False, {}
    imp.save(update_fields=["theme_applied", "theme_backup"])


HOME_KEYS = ("home.title", "home.text")


def apply_home(imp):
    if not imp.home:
        raise ImportError_("Er is geen startpagina ingelezen.")
    if not imp.home_applied:
        imp.home_backup = {k: list(ContentBlock.objects.filter(key=k).values("lang", "text")) for k in HOME_KEYS}
    lang = _lang()
    for k in HOME_KEYS:
        ContentBlock.objects.filter(key=k).delete()
    ContentBlock.objects.create(key="home.title", lang=lang, text=imp.home.get("title", ""))
    ContentBlock.objects.create(key="home.text", lang=lang, text=richtext.PREFIX + imp.home.get("html", ""))
    imp.home_applied = True
    imp.save(update_fields=["home_applied", "home_backup"])


def revert_home(imp):
    if not imp.home_applied:
        return
    for k in HOME_KEYS:
        ContentBlock.objects.filter(key=k).delete()
        for row in (imp.home_backup or {}).get(k, []):
            ContentBlock.objects.create(key=k, lang=row["lang"], text=row["text"])
    imp.home_applied = False
    imp.save(update_fields=["home_applied"])


def remove_import(imp):
    """Everything that came from this import goes: pages and their texts, library pictures (and brand pictures that use them), the
    theme folder, and the theme / home page are put back when they were switched on."""
    import shutil

    from apps.branding.models import SiteAsset

    try:
        revert_theme(imp)
        revert_home(imp)
    except Exception:  # noqa: BLE001
        logger.exception("revert failed for import %s", imp.id)
    for p in Page.objects.filter(source=imp.tag):
        ContentBlock.objects.filter(key__startswith=f"page.{p.key}.").delete()
        p.delete()
    for item in MediaItem.objects.filter(source=imp.tag):
        SiteAsset.objects.filter(image=item.key).delete()
        default_storage.delete(item.key)
    MediaItem.objects.filter(source=imp.tag).delete()
    if imp.slug:
        shutil.rmtree(theme_dir(imp.slug), ignore_errors=True)
    imp.delete()


# ── entry points ─────────────────────────────────────────────────────────────
def imports_dir():
    d = getattr(settings, "SITE_IMPORT_DIR", None) or os.path.join(settings.BASE_DIR, "imports")
    os.makedirs(d, exist_ok=True)
    return d


def list_folders():
    d = imports_dir()
    return sorted(n for n in os.listdir(d) if os.path.isdir(os.path.join(d, n)) and not n.startswith("."))


def import_url(url, name, user):
    url = (url or "").strip()
    if not re.match(r"^https?://", url):
        url = "https://" + url
    check_public(url)
    return analyze(WebFetcher(url), url, name, "url", url, user)


def import_folder(folder, name, user):
    if folder not in list_folders():
        raise ImportError_("Deze map staat niet in de importmap.")
    return analyze(FolderFetcher(os.path.join(imports_dir(), folder)), VIRTUAL, name or folder, "folder", folder, user)


def import_zip(upload, name, user):
    import shutil
    import tempfile

    tmp = tempfile.mkdtemp(prefix="siteimport-")
    try:
        with zipfile.ZipFile(upload) as z:
            infos = [i for i in z.infolist() if not i.is_dir()]
            if len(infos) > 800 or sum(i.file_size for i in infos) > 120 * 2**20:
                raise ImportError_("Het ZIP-bestand is te groot.")
            for i in infos:
                dest = os.path.realpath(os.path.join(tmp, i.filename))
                if not dest.startswith(os.path.realpath(tmp) + os.sep):
                    continue  # never write outside the folder
                if os.path.splitext(i.filename)[1].lower().lstrip(".") not in {"html", "htm", "css", *IMAGE_EXT, "svg"}:
                    continue
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                with z.open(i) as src, open(dest, "wb") as out:
                    out.write(src.read())
        root = tmp
        entries = os.listdir(tmp)
        if not os.path.exists(os.path.join(tmp, "index.html")) and len(entries) == 1 and os.path.isdir(os.path.join(tmp, entries[0])):
            root = os.path.join(tmp, entries[0])
        if not os.path.exists(os.path.join(root, "index.html")):
            raise ImportError_("Er staat geen index.html in het ZIP-bestand.")
        return analyze(FolderFetcher(root), VIRTUAL, name or os.path.splitext(upload.name)[0], "zip", upload.name, user)
    except zipfile.BadZipFile:
        raise ImportError_("Dit is geen geldig ZIP-bestand.")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

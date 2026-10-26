# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net


"""The toolkit to read another website: fetching (address, map, ZIP), the HTML parser and the analysis of the colours, fonts and style. Used by Thema uit een webadres (core)
and by the plugin Site importeren."""
import colorsys
import ipaddress
import logging
import mimetypes
import os
import re
import socket
import time
import urllib.error
import urllib.request
from collections import Counter
from html.parser import HTMLParser
from urllib.parse import urljoin, urldefrag, urlparse

from apps.core import theme as T

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


def main_node(root):
    for pred in (lambda n: n.tag == "main", lambda n: n.tag == "article", lambda n: n.attrs.get("role") == "main", lambda n: n.tag == "body"):
        hit = find(root, pred=pred)
        if hit:
            return hit[0]
    return root


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

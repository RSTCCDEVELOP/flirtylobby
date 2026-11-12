# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Reads a website ZIP (made with the AI prompt of Easy2edit) into a clean bundle, with the rules of importrules.py:
only the root (or ONE common top folder) and img/; html, css, pictures (jpg, png, webp, svg) and vertalingen-<taal>.json; file names that follow the rule
(renamed names are rewritten in every html/css reference); svg is sanitized; too many/too large files are skipped with a note. Used by both import routes."""
import json
import posixpath
import re
import xml.etree.ElementTree as ET
from urllib.parse import quote, unquote

from . import importrules as R

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
BAD_TAGS = {"script", "foreignobject", "iframe", "object", "embed", "audio", "video", "canvas", "set", "animate", "animatetransform", "animatemotion", "handler", "listener"}
SAFE_REF = re.compile(r"^(#|data:image/(?:png|jpe?g|webp|gif);base64,)", re.I)
CSS_URL = re.compile(r"url\(\s*([\"']?)([^)\"']+)\1\s*\)", re.I)


def sanitize_svg(data):
    """The svg without scripts, event handlers, foreign objects and external references; None when it is not a usable svg."""
    try:
        text = data.decode("utf-8-sig") if isinstance(data, (bytes, bytearray)) else str(data)
    except UnicodeDecodeError:
        return None
    if re.search(r"<!(?:DOCTYPE|ENTITY)", text, re.I) or len(text) > R.MAX_IMAGE_BYTES:
        return None  # entity tricks are never needed in a drawing
    ET.register_namespace("", SVG_NS)
    ET.register_namespace("xlink", XLINK_NS)
    try:
        root = ET.fromstring(text.encode("utf-8"))
    except ET.ParseError:
        return None
    if root.tag.split("}")[-1].lower() != "svg":
        return None

    def clean(el):
        for ch in list(el):
            if not isinstance(ch.tag, str) or ch.tag.split("}")[-1].lower() in BAD_TAGS:
                el.remove(ch)
                continue
            if ch.tag.split("}")[-1].lower() == "style" and re.search(r"@import|url\(\s*[\"']?(?!#)", ch.text or "", re.I):
                ch.text = re.sub(r"@import[^;]*;?", "", ch.text or "", flags=re.I)
                ch.text = re.sub(r"url\(\s*[\"']?(?!#|data:image)[^)]*\)", "none", ch.text, flags=re.I)
            clean(ch)
        for k in list(el.attrib):
            local = k.split("}")[-1].lower()
            v = el.attrib[k].strip()
            if local.startswith("on") or (local == "href" and not SAFE_REF.match(v)) or (local == "style" and re.search(r"url\(\s*[\"']?(?!#|data:image)|expression\(|javascript:", v, re.I)):
                del el.attrib[k]
            elif re.match(r"^\s*(javascript|vbscript):", v, re.I):
                del el.attrib[k]

    clean(root)
    return ET.tostring(root, encoding="unicode").encode("utf-8")


def _ref_map(old_to_new):
    """{normalized old path (lower, no ./ or /): new path} plus a basename index for references without folder."""
    by_path, by_base = {}, {}
    for old, new in old_to_new.items():
        by_path[old.lower()] = new
        by_base.setdefault(posixpath.basename(old).lower(), new)
    return by_path, by_base


def rewrite_refs(text, old_to_new):
    """The references in html/css (src, srcset, poster, data-*, og:image content, url()) to renamed pictures point to the new names."""
    if not old_to_new:
        return text
    by_path, by_base = _ref_map(old_to_new)

    def fix(ref):
        r = ref.strip()
        if not r or r.startswith(("data:", "http:", "https:", "//", "#", "mailto:", "tel:")):
            return ref
        path, tail = re.match(r"^([^?#]*)(.*)$", r).groups()
        norm = posixpath.normpath(unquote(path).replace("\\", "/")).lstrip("/").lower()
        new = by_path.get(norm) or (by_base.get(posixpath.basename(norm)) if "/" not in norm else None)
        return (new + tail) if new else ref

    def attr(m):
        name, q, val = m.group(1), m.group(2), m.group(3)
        if name.lower() in ("srcset", "data-srcset"):
            parts = []
            for p in val.split(","):
                bits = p.strip().split(None, 1)
                if bits:
                    parts.append(" ".join([fix(bits[0])] + bits[1:]))
            return f"{name}={q}{', '.join(parts)}{q}"
        return f"{name}={q}{fix(val)}{q}"

    text = re.sub(r"\b(src|srcset|data-src|data-srcset|data-bg|poster|content|href)\s*=\s*([\"'])(.*?)\2", attr, text, flags=re.I | re.S)
    return CSS_URL.sub(lambda m: f"url({m.group(1)}{fix(m.group(2))}{m.group(1)})", text)


class Bundle:
    def __init__(self):
        self.files = {}  # path (index.html, style.css, img/x.jpg, vertalingen-en.json) -> bytes
        self.notes = []
        self.translations = {}  # language code -> parsed file
        self.renamed = {}  # old path -> new path (pictures)

    def names(self, ext):
        return sorted(n for n in self.files if n.rsplit(".", 1)[-1] == ext)


def parse_translation(name, data):
    """(language, dict) of a vertalingen-<taal>.json, or raises ValueError with a reason."""
    m = R.TRANSLATION_RE.match(name.lower())
    if not m:
        raise ValueError("de naam moet " + R.TRANSLATION_FILE + " zijn")
    try:
        d = json.loads(data.decode("utf-8-sig"))
    except (ValueError, UnicodeDecodeError):
        raise ValueError("geen geldige JSON")
    if not isinstance(d, dict) or d.get("formaat") != R.TRANSLATION_FORMAT or not isinstance(d.get("paginas"), dict):
        raise ValueError(f'het formaat moet "{R.TRANSLATION_FORMAT}" zijn met een veld "paginas"')
    return m.group(1), d


def read_zip(z):
    """The ZIP (a zipfile.ZipFile) as a Bundle."""
    b = Bundle()
    entries = []
    for zi in z.infolist()[:800]:
        n = zi.filename.replace("\\", "/")
        if zi.is_dir() or "__MACOSX/" in n or n.startswith("/") or ".." in n.split("/") or posixpath.basename(n).startswith("."):
            continue
        entries.append((n.lstrip("./") if n.startswith("./") else n, zi))
    if sum(zi.file_size for _, zi in entries) > R.MAX_TOTAL:
        raise ValueError(f"Het ZIP-bestand is te groot (maximaal {R.mb(R.MAX_TOTAL)} MB uitgepakt).")
    tops = {n.split("/")[0] for n, _ in entries if "/" in n}
    if entries and all("/" in n for n, _ in entries) and len(tops) == 1:  # one common top folder (the ZIP of a folder): its content is the root
        entries = [(n.split("/", 1)[1], zi) for n, zi in entries]
    raw = {}
    for n, zi in entries:
        parts = n.split("/")
        ext = parts[-1].rsplit(".", 1)[-1].lower() if "." in parts[-1] else ""
        if len(parts) == 1:
            if ext in ("html", "htm", "css") or R.TRANSLATION_RE.match(parts[0].lower()) or ext in R.IMAGE_EXT:
                pass
            else:
                b.notes.append(f"{n} is overgeslagen (geen html, css, afbeelding of vertalingbestand).")
                continue
        elif len(parts) == 2 and parts[0].lower() == R.IMAGE_FOLDER and ext in R.IMAGE_EXT:
            pass
        else:
            b.notes.append(f"{n} is overgeslagen: alleen de hoofdmap en de map {R.IMAGE_FOLDER}/ worden gelezen.")
            continue
        raw[n] = zi
    # html / css / translations
    for n, zi in sorted(raw.items()):
        ext = n.rsplit(".", 1)[-1].lower()
        if ext in R.IMAGE_EXT:
            continue
        if ext in ("html", "htm"):
            if zi.file_size > R.MAX_HTML:
                b.notes.append(f"{n} is overgeslagen (groter dan {R.mb(R.MAX_HTML)} MB).")
                continue
            new, _ = R.clean_name(n.lower()[:-4] + ".html" if ext == "htm" else n.lower())
            if new != n:
                b.renamed[n] = new  # links to this page are rewritten as well
                b.notes.append(f"{n} heet voortaan {new}; de links zijn aangepast.")
            b.files[new] = z.read(zi)
        elif ext == "css":
            if zi.file_size > R.MAX_CSS:
                b.notes.append(f"{n} is overgeslagen (groter dan {R.MAX_CSS // 1024} KB).")
                continue
            b.files[n.lower()] = z.read(zi)
        elif ext == "json":
            if zi.file_size > R.MAX_TRANSLATION_BYTES:
                b.notes.append(f"{n} is overgeslagen (te groot).")
                continue
            data = z.read(zi)
            try:
                lang, d = parse_translation(n, data)
            except ValueError as e:
                b.notes.append(f"{n} is overgeslagen: {e}.")
                continue
            b.translations[lang] = d
    htmls = sorted((n for n in b.files if n.endswith(".html")), key=lambda x: (x != "index.html", x))
    for n in htmls[R.MAX_PAGES:]:
        del b.files[n]
        b.notes.append(f"{n} is overgeslagen: maximaal {R.MAX_PAGES} pagina's.")
    sheets = [n for n in sorted(b.files) if n.endswith(".css")]
    for n in sheets[R.MAX_STYLESHEETS:]:
        del b.files[n]
        b.notes.append(f"{n} is overgeslagen: maximaal {R.MAX_STYLESHEETS} stijlbladen.")
    # pictures: the ones that are used first, then the rest; at most MAX_IMAGES
    text = "\n".join(b.files[n].decode("utf-8", "replace").lower() for n in b.files)
    pics = sorted((n for n in raw if n.rsplit(".", 1)[-1].lower() in R.IMAGE_EXT), key=lambda n: (posixpath.basename(n).lower() not in text and quote(posixpath.basename(n).lower()) not in text, n))
    taken, count = set(), 0
    for n in pics:
        zi = raw[n]
        base = posixpath.basename(n)
        if count >= R.MAX_IMAGES:
            b.notes.append(f"{base} is overgeslagen: maximaal {R.MAX_IMAGES} afbeeldingen.")
            continue
        if zi.file_size > R.MAX_IMAGE_BYTES:
            b.notes.append(f"{base} is overgeslagen (groter dan {R.mb(R.MAX_IMAGE_BYTES)} MB).")
            continue
        data = z.read(zi)
        ext = base.rsplit(".", 1)[-1].lower()
        if ext == "svg":
            data = sanitize_svg(data)
            if data is None:
                b.notes.append(f"{base} is overgeslagen (geen bruikbare svg).")
                continue
        else:
            try:
                import io

                from PIL import Image

                Image.open(io.BytesIO(data)).verify()
            except Exception:  # noqa: BLE001
                b.notes.append(f"{base} is geen geldige afbeelding en is overgeslagen.")
                continue
        new, changed = R.clean_name(base)
        if ext == "jpeg":
            new = new[:-4] + "jpg"
            changed = True
        stem, dot, e = new.rpartition(".")
        k = 2
        while f"{R.IMAGE_FOLDER}/{new}" in taken:
            new, k = f"{stem[:R.NAME_MAX - 3]}-{k}.{e}", k + 1
        taken.add(f"{R.IMAGE_FOLDER}/{new}")
        final = f"{R.IMAGE_FOLDER}/{new}"
        b.files[final] = data
        count += 1
        if final != n:
            b.renamed[n] = final
            if changed:
                b.notes.append(f"{base} heet voortaan {new}; de verwijzingen in de pagina's zijn aangepast.")
    for n in list(b.files):
        if n.endswith((".html", ".css")):
            old = b.files[n].decode("utf-8", "replace")
            new = rewrite_refs(old, b.renamed)
            if new != old:
                b.files[n] = new.encode("utf-8")
    if not any(n.endswith(".html") for n in b.files):
        raise ValueError("Er staat geen html-bestand in het ZIP-bestand.")
    return b


def validate_translations(bundle, main_lang, active_codes):
    """Keeps only the translation files that fit this site: source language = the main language, target language = an active language. The html in the translations
    is cleaned like rich text (p, ul, ol, li, strong, em, a, br). Reasons go into bundle.notes."""
    from . import richtext

    ok = {}
    for code, d in bundle.translations.items():
        if str(d.get("bron") or "") != main_lang:
            bundle.notes.append(f"vertalingen-{code}.json is overgeslagen: bron is '{d.get('bron')}', maar de hoofdtaal van de site is '{main_lang}'.")
            continue
        if str(d.get("doel") or code) != code or code not in active_codes or code == main_lang:
            bundle.notes.append(f"vertalingen-{code}.json is overgeslagen: '{code}' is geen actieve extra taal van de site.")
            continue
        pages = {}
        for page, items in d["paginas"].items():
            rows = []
            for it in items if isinstance(items, list) else []:
                if isinstance(it, dict) and isinstance(it.get(code), str):
                    it = {**it, code: richtext.clean(it[code]) if "<" in it[code] else it[code]}
                    rows.append(it)
            pages[page] = rows
        ok[code] = {**d, "paginas": pages}
    bundle.translations = ok
    return bundle


def validate_for_site(bundle):
    """validate_translations with the main language and the active languages of this site (from the database)."""
    from .models import Language

    main = Language.objects.filter(is_default=True).values_list("code", flat=True).first() or "nl"
    active = set(Language.objects.filter(enabled=True).values_list("code", flat=True))
    return validate_translations(bundle, main, active)

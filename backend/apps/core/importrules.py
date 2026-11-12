# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The ONE place with the rules of the website import (ZIP / html files). The importer, the AI creator, the AI prompt (through the catalog endpoint)
and the tests all read these numbers from here, so the prompt never promises more or less than the importer really does."""
import re

MAX_PAGES = 12  # html pages
MAX_IMAGES = 40  # picture files in total (jpg, png, webp, svg)
MAX_IMAGE_BYTES = 5 * 2**20  # per picture
MAX_HTML = 2 * 2**20  # per html file
MAX_CSS = 600 * 1024  # per css file
MAX_STYLESHEETS = 5
MAX_TOTAL = 40 * 2**20  # whole ZIP
NAME_MAX = 40  # characters of a file name before the extension
IMAGE_EXT = ("jpg", "jpeg", "png", "webp", "svg")
IMAGE_FOLDER = "img"
NAME_BASE_RE = re.compile(r"^[a-z0-9_-]{1,%d}$" % NAME_MAX)
TRANSLATION_FORMAT = "easy2edit-vertalingen/1"
TRANSLATION_FILE = "vertalingen-<taal>.json"  # <taal> = language code, e.g. vertalingen-en.json
TRANSLATION_RE = re.compile(r"^vertalingen-([a-z]{2,3}(?:-[a-z0-9]{2,4})?)\.json$")
MAX_TRANSLATION_BYTES = 2 * 2**20


def mb(n):
    return f"{n / 2**20:g}"


def as_dict():
    """What the AI prompt needs (served by the catalog endpoint)."""
    return {"max_pages": MAX_PAGES, "max_images": MAX_IMAGES, "max_image_mb": float(mb(MAX_IMAGE_BYTES)), "name_max": NAME_MAX, "image_ext": list(IMAGE_EXT),
            "image_folder": IMAGE_FOLDER, "translation_format": TRANSLATION_FORMAT, "translation_file": TRANSLATION_FILE, "max_html_mb": float(mb(MAX_HTML)), "max_css_kb": MAX_CSS // 1024}


def clean_name(name, ext_ok=None):
    """A file name that follows the rule (a-z 0-9 - _, max NAME_MAX before the extension); the extension is lower case. Returns (new_name, changed)."""
    import unicodedata

    raw = str(name or "")
    base, dot, ext = raw.rpartition(".")
    if not dot:
        base, ext = raw, ""
    ext = ext.lower()
    if ext_ok and ext not in ext_ok:
        return None, False
    ascii_ = unicodedata.normalize("NFKD", base).encode("ascii", "ignore").decode().lower()
    new = re.sub(r"[^a-z0-9_-]+", "-", ascii_).strip("-_")[:NAME_MAX].strip("-_") or "bestand"
    out = f"{new}.{ext}" if ext else new
    return out, out != raw

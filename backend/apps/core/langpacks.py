# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Language packages: a language is a folder <THEMES_DIR>/language/<code>/ with one file, language.json:

    {"code": "fr", "name": "Frans", "native_name": "Français", "rtl": false, "version": "1.0.0", "ui": {"Nederlandse tekst": "Texte français", …}}

`ui` is the dictionary of the interface (the Dutch text is the key, see frontend/lib/t.js). The languages that come with the system have their
dictionary in frontend/public/locales/<code>.json; an installed package takes its place, so a language can be added or replaced without an update.
A package holds data only (texts), so it cannot run code. Export: <project>/resource/languages/<code>.zip per language and all_languages.zip."""
import io
import json
import re
import shutil
import zipfile

from django.conf import settings
from django.db import transaction

from .models import Language

CODE_RE = re.compile(r"^[a-z]{2,3}(-[a-z0-9]{2,8})?$")
PROTECTED = ("en",)  # English is the standard language of the system and cannot be removed
MAX_ZIP = 40 * 1024 * 1024
MAX_UI = 8 * 1024 * 1024
MAX_ENTRY = 2000


class LanguageError(ValueError):
    pass


def root():
    d = settings.THEMES_DIR / "language"
    d.mkdir(parents=True, exist_ok=True)
    return d


def dist_dir():
    d = settings.RESOURCE_DIR / "languages"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _file(code):
    return root() / code / "language.json"


def installed(code):
    """The installed package of this language (dict), or None."""
    if not CODE_RE.match(code or ""):
        return None
    try:
        return json.loads(_file(code).read_text())
    except (OSError, ValueError):
        return None


def builtin_ui(code):
    f = settings.PROJECT_ROOT / "frontend" / "public" / "locales" / f"{code}.json"
    try:
        d = json.loads(f.read_text())
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def ui(code):
    pack = installed(code)
    return pack["ui"] if pack and isinstance(pack.get("ui"), dict) else builtin_ui(code)


def parse(raw):
    """Validate a language.json (bytes/str). Returns the clean dict."""
    try:
        d = json.loads(raw)
    except (TypeError, ValueError):
        raise LanguageError("language.json is geen geldige JSON.")
    if not isinstance(d, dict):
        raise LanguageError("language.json moet een object zijn.")
    code = str(d.get("code") or "").strip().lower()
    if not CODE_RE.match(code):
        raise LanguageError("De code in language.json is ongeldig (bijvoorbeeld nl, fr of pt-br).")
    words = d.get("ui")
    if not isinstance(words, dict):
        raise LanguageError(f"{code}: language.json heeft geen ui (de vertalingen).")
    if len(words) > 20000 or any(not isinstance(k, str) or not isinstance(v, str) or len(k) > MAX_ENTRY or len(v) > MAX_ENTRY for k, v in words.items()):
        raise LanguageError(f"{code}: de vertalingen zijn ongeldig (alleen tekst naar tekst, maximaal {MAX_ENTRY} tekens per regel).")
    ver = str(d.get("version") or "1.0.0")
    return {"code": code, "name": str(d.get("name") or "").strip()[:100], "native_name": str(d.get("native_name") or "").strip()[:100], "rtl": bool(d.get("rtl")),
            "version": ver if re.fullmatch(r"\d{1,4}\.\d{1,4}\.\d{1,4}", ver) else "1.0.0", "ui": words}


def install_zip(data):
    """Unpack an uploaded zip: one language (language.json, or <code>/language.json) or a bundle with a folder per language. Returns the codes.
    A broken language stops the whole install before anything is written."""
    if len(data) > MAX_ZIP:
        raise LanguageError("Het zipbestand is te groot.")
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise LanguageError("Dit is geen geldig zipbestand.")
    names = [n for n in zf.namelist() if not n.endswith("/") and "__MACOSX" not in n and ".." not in n.split("/") and not n.rsplit("/", 1)[-1].startswith("._")]
    hits = sorted(n for n in names if n == "language.json" or (n.count("/") == 1 and n.endswith("/language.json")))
    if not hits:
        raise LanguageError("language.json ontbreekt in het zipbestand.")
    parsed = []
    for hit in hits:
        if zf.getinfo(hit).file_size > MAX_UI:
            raise LanguageError(f"{hit} is te groot.")
        parsed.append(parse(zf.read(hit)))
    codes = []
    with transaction.atomic():
        for p in parsed:
            lang = Language.objects.filter(code=p["code"]).first()
            if not lang:
                if not p["name"] or not p["native_name"]:
                    raise LanguageError(f"{p['code']}: een nieuwe taal heeft een name en native_name nodig.")
                last = Language.objects.order_by("-order").first()
                lang = Language(code=p["code"], name=p["name"], native_name=p["native_name"], rtl=p["rtl"], enabled=False, order=(last.order + 1) if last else 0)
            else:
                lang.name, lang.native_name, lang.rtl = p["name"] or lang.name, p["native_name"] or lang.native_name, p["rtl"]
            lang.save()
            _file(p["code"]).parent.mkdir(exist_ok=True)
            _file(p["code"]).write_text(json.dumps({"code": p["code"], "name": lang.name, "native_name": lang.native_name, "rtl": lang.rtl, "version": p["version"], "ui": p["ui"]}, indent=1, ensure_ascii=False) + "\n")
            codes.append(p["code"])
    return codes


def _doc(lang):
    pack = installed(lang.code) or {}
    return json.dumps({"code": lang.code, "name": lang.name, "native_name": lang.native_name, "rtl": lang.rtl, "version": pack.get("version", "1.0.0"), "ui": dict(sorted(ui(lang.code).items()))}, indent=1, ensure_ascii=False)


def as_zip(code):
    lang = Language.objects.filter(code=code).first()
    if not lang:
        return None
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(f"{code}/language.json", _doc(lang))
    return buf.getvalue()


def as_zip_all():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for lang in Language.objects.all():
            z.writestr(f"{lang.code}/language.json", _doc(lang))
    return buf.getvalue()


def build_dist():
    """Write <project>/resource/languages/<code>.zip for every language and all_languages.zip. Returns the names."""
    out = []
    for code in Language.objects.values_list("code", flat=True):
        (dist_dir() / f"{code}.zip").write_bytes(as_zip(code))
        out.append(f"{code}.zip")
    (dist_dir() / "all_languages.zip").write_bytes(as_zip_all())
    return out + ["all_languages.zip"]


def remove(lang):
    if lang.code in PROTECTED:
        raise LanguageError("Engels is de standaardtaal van het systeem en kan niet worden verwijderd.")
    if lang.is_default:
        raise LanguageError("De standaardtaal kan niet worden verwijderd. Kies eerst een andere standaardtaal.")
    shutil.rmtree(root() / lang.code, ignore_errors=True)
    lang.delete()

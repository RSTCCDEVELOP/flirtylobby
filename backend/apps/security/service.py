import copy
import ipaddress
import re
import time

from .countries import COUNTRY_CODES
from .defaults import DEFAULTS, SPEC, TEXT_KEYS
from .models import SecuritySettings

_cache = {"t": 0, "data": None}
TTL = 15  # seconds; also dropped on every save


def _merge(base, over):
    out = copy.deepcopy(base)
    for k, v in (over or {}).items():
        out[k] = _merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def raw():
    """Merged settings (defaults + stored), as edited on the security page. Cached briefly (middleware calls often)."""
    now = time.time()
    if _cache["data"] is None or now - _cache["t"] > TTL:
        stored = SecuritySettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}
        _cache.update(t=now, data=_merge(DEFAULTS, stored))
    return _cache["data"]


def get():
    """Effective settings: like raw(), but features of modules that are switched off are disabled."""
    from apps.core import modules

    s = dict(raw())
    for section, module in (("geo", "geo"), ("age", "age_gate"), ("gambling", "gambling"), ("cookies", "cookies"),
                            ("words", "word_filter"), ("twofa", "twofa"), ("email_verify", "security_basic"), ("registration", "registration")):
        if not modules.enabled(module):
            s[section] = {**s[section], "enabled": False}
    return s


def underage_message(birth_date):
    """Text when the birth date is below the site's age limit (18+ gate), else None."""
    from datetime import date

    cfg = get()["age"]
    if not birth_date or not cfg.get("enabled"):
        return None
    t = date.today()
    age = t.year - birth_date.year - ((t.month, t.day) < (birth_date.month, birth_date.day))
    if age < cfg["min_age"]:
        return f"Deze website is alleen voor bezoekers van {cfg['min_age']} jaar en ouder. Met deze geboortedatum kun je geen gegevens opslaan."
    return None


def invalidate():
    _cache["data"] = None


# ── validation ──────────────────────────────────────────────────────────────
class Invalid(Exception):
    pass


def _val(kind, v, where):
    if kind == "bool":
        if not isinstance(v, bool):
            raise Invalid(f"{where}: ja/nee verwacht.")
        return v
    if kind == "countries":
        codes = [str(c).upper() for c in v]
        bad = [c for c in codes if c not in COUNTRY_CODES]
        if bad:
            raise Invalid(f"{where}: onbekende landcode {bad[0]}.")
        return sorted(set(codes))
    if kind == "ips":
        out = []
        for raw in v:
            try:
                out.append(str(ipaddress.ip_network(str(raw).strip(), strict=False)))
            except ValueError:
                raise Invalid(f"{where}: ongeldig IP-adres '{raw}'.")
        return out[:200]
    if kind == "paths":
        paths = [str(p).strip() for p in v if str(p).strip()]
        if any(not p.startswith("/") or len(p) > 200 for p in paths):
            raise Invalid(f"{where}: paden beginnen met / (bv. /privacy).")
        return paths[:100]
    if kind == "text":
        v = str(v).strip()
        if len(v) > 60:
            raise Invalid(f"{where}: maximaal 60 tekens.")
        return v
    if kind == "url":
        v = str(v).strip()
        if v and not re.fullmatch(r"https?://[^\s]{1,500}", v):
            raise Invalid(f"{where}: gebruik een volledige URL (https://…).")
        return v
    t = kind[0]
    if t == "int":
        if isinstance(v, bool) or not isinstance(v, int) or not kind[1] <= v <= kind[2]:
            raise Invalid(f"{where}: getal tussen {kind[1]} en {kind[2]}.")
        return v
    if t == "choice":
        if v not in kind[1]:
            raise Invalid(f"{where}: ongeldige keuze.")
        return v
    raise Invalid(where)


def _texts(section, texts, lang_codes):
    out = {}
    for lang, entries in (texts or {}).items():
        if lang not in lang_codes or not isinstance(entries, dict):
            continue
        clean = {}
        for key, val in entries.items():
            if key not in TEXT_KEYS[section]:
                continue
            if key == "warnings":
                if not isinstance(val, list):
                    raise Invalid("Waarschuwingen moeten een lijst zijn.")
                clean[key] = [str(x).strip()[:500] for x in val if str(x).strip()][:10]
            else:
                clean[key] = str(val)[:6000 if key == "policy_body" else 1000]
        out[lang] = clean
    return out


def clean(incoming, lang_codes):
    """Validate a (partial) settings dict. Returns the cleaned dict or raises Invalid."""
    out = {}
    for section, body in (incoming or {}).items():
        if section not in DEFAULTS or not isinstance(body, dict):
            continue
        sec = {}
        for key, val in body.items():
            if key == "texts" and section in TEXT_KEYS:
                sec["texts"] = _texts(section, val, lang_codes)
            elif key == "lists" and section == "words":
                lists = {}
                for lang, words in (val or {}).items():
                    if lang in lang_codes and isinstance(words, list):
                        ws = sorted({str(w).strip().lower() for w in words if str(w).strip()})
                        if any(len(w) > 100 for w in ws):
                            raise Invalid("Een woord is te lang (max 100 tekens).")
                        lists[lang] = ws[:3000]
                sec["lists"] = lists
            elif key in SPEC.get(section, {}):
                sec[key] = _val(SPEC[section][key], val, f"{section}.{key}")
        out[section] = sec
    return out


def save(clean_data):
    obj, _ = SecuritySettings.objects.get_or_create(pk=1)
    obj.data = _merge(obj.data or {}, clean_data)
    obj.save()
    invalidate()
    return raw()


def reset_section(section):
    obj, _ = SecuritySettings.objects.get_or_create(pk=1)
    (obj.data or {}).pop(section, None)
    obj.save()
    invalidate()


# ── public payload (no secrets: no countries, IPs or word lists) ────────────
def public():
    s = get()
    gate = lambda name, extra=(): {  # noqa: E731
        k: s[name][k] for k in ("enabled", "frequency", "days", "show_on", "exclude_paths", "version", "texts", *extra)
    }
    return {
        "basic": {"security_headers": s["basic"]["security_headers"], "hsts": s["basic"]["hsts"]},
        "geo": {"enabled": s["geo"]["enabled"], "admin_bypass": s["geo"]["admin_bypass"], "texts": s["geo"]["texts"]},
        "age": gate("age", ("min_age", "deny_url")),
        "gambling": gate("gambling", ("min_age", "deny_url", "require_confirm")),
        "cookies": gate("cookies", ("position", "show_reject", "analytics", "marketing", "preferences")),
    }

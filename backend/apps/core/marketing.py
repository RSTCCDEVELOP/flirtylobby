# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Marketing system objects of Easy2edit: one tile per module that opens a pop-up with a marketing text, examples with made-up data and the flags of the active languages.
Built-in texts: Dutch and English (marketing_content.py). Other languages (and improvements) are made with the AI and kept in the database (MarketingText).
Super admin → Prijzen → Marketing: all tiles on/off, and each tile on/off. A tile is a system object (kind "marketing", ref_key = the module)."""
import json
import re

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from . import modules
from .marketing_content import C
from .marketing_extra import X


INST = "installation-"  # the marketing blocks of the standard installations use this prefix in front of the key of the installation


def _installations():
    from . import presets

    return {INST + p["key"]: {"key": INST + p["key"], "label": p["name"], "group": "Standaardinstallaties"} for p in presets.PRESETS}


def _mod(key):
    """A module of the system, or a standard installation (a block about a ready-made set)."""
    return modules.BY_KEY.get(key) or _installations().get(key)


def _first_sentence(text, n):
    t = " ".join(str(text or "").split())
    cut = t.split(". ")[0].rstrip(".")
    return (cut if len(cut) <= n else cut[: n - 1].rstrip() + "…")


def _installation_text(module, lang):
    """The built-in text of a standard installation, made from what is in it (nl and en)."""
    from apps.plugins.models import Plugin

    from . import pricelist

    d = pricelist.installation(module[len(INST):])
    if not d:
        return None
    nl = lang == "nl"
    inc = {sec["key"]: [r for r in sec["rows"] if r["in"]] for sec in d["sections"]}
    desc = {p["label"]: p["desc"] for p in modules.PACKAGES}
    desc.update({(p.title or p.name): _first_sentence((p.manifest or {}).get("description"), 90) for p in Plugin.objects.all()})
    cands = [(r["label"], _first_sentence(desc.get(r["label"]), 90)) for r in inc.get("pkg", []) + inc.get("plug", [])]
    base = [("Pagina's en bewerkmodus", "Je hele website in één overzicht, bewerk waar je hem ziet.") if nl else ("Pages and edit mode", "Your whole site in one overview, edit it where you see it."),
            ("Thema's, talen en media", "Een site die klopt met jouw merk, in elke taal.") if nl else ("Themes, languages and media", "A site that fits your brand, in every language."),
            ("Beveiliging en back-ups", "Veilig inloggen en automatische back-ups.") if nl else ("Security and backups", "Safe sign-in and automatic backups.")]
    pts = (cands + base)[:3]
    n_plug = len(inc.get("plug", []))
    n_mod = len([r for r in inc.get("mod", [])])
    price = "€ " + f"{float(d['price']):.2f}".replace(".", ",")
    items = (inc.get("pkg", []) + inc.get("plug", []) + inc.get("mod", []))[:3] or [{"label": "Basis"}]
    rows = [{"a": r["label"], "b": "Inbegrepen" if nl else "Included", "badge": "Aan" if nl else "On"} for r in items]
    while len(rows) < 3:
        rows.append({"a": base[len(rows) % 3][0], "b": "Inbegrepen" if nl else "Included", "badge": "Aan" if nl else "On"})
    tag = _first_sentence(d["desc"], 80) if nl else _first_sentence(f"Ready-made set: {d['name']}, switched on with one click.", 80)
    return {"title": d["name"], "tagline": tag, "intro": d["desc"][:250] if nl else f"{d['name']} switches on the right modules and plugins for you, with the profile theme and standard pages that go with it.",
            "points": [{"t": t[:30], "d": x[:90]} for t, x in pts],
            "story": d["desc"][:450] if nl else f"Choose {d['name']} and the system switches on exactly what this kind of website needs. Texts, users and other data are never touched.",
            "steps": [{"t": "Kies de installatie" if nl else "Choose the set", "d": "Eén klik zet de juiste modules en plugins aan." if nl else "One click switches on the right modules and plugins."},
                      {"t": "Laad voorbeeldgegevens" if nl else "Load example data", "d": "Meteen een complete site om te bekijken." if nl else "A complete site to look at right away."},
                      {"t": "Pas aan en publiceer" if nl else "Adjust and publish", "d": "Maak het van jou, in je eigen stijl." if nl else "Make it yours, in your own style."}],
            "usecase": "Handig voor: " + d["name"].lower() if nl else "Handy for: " + d["name"].lower(),
            "demo": {"title": ("Voorbeeld: " if nl else "Example: ") + d["name"], "rows": rows,
                     "stats": [{"v": price, "l": "per maand" if nl else "per month"}, {"v": str(n_plug), "l": "plugins"}, {"v": str(n_mod), "l": "modules" if nl else "modules"}]}}


def _built_in(module, lang):
    if module.startswith(INST):
        return _installation_text(module, lang) if lang in ("nl", "en") else None
    item = C.get(module)
    if not item or lang not in ("nl", "en"):
        return None
    en, nl, e = item
    tag, intro, points, demo_title, rows, stats = nl if lang == "nl" else e
    split = lambda s, n: (s.split("|", n - 1) + [""] * n)[:n]  # noqa: E731
    mod = _mod(module) or {}
    story, steps, use = X[module][0 if lang == "nl" else 1] if module in X else ("", [], "")
    return {"title": mod.get("label", module) if lang == "nl" else en, "tagline": tag, "intro": intro, "points": [dict(zip(("t", "d"), split(p, 2))) for p in points],
            "story": story, "steps": [dict(zip(("t", "d"), split(p, 2))) for p in steps], "usecase": use,
            "demo": {"title": demo_title, "rows": [dict(zip(("a", "b", "badge"), split(r, 3))) for r in rows], "stats": [dict(zip(("v", "l"), split(x, 2))) for x in stats]}}


def clean(d):
    """A marketing text in the shape the pop-up needs, from whatever the AI gave back."""
    def txt(v, n):
        return str(v or "").strip()[:n]

    pts = [{"t": txt(p.get("t"), 60), "d": txt(p.get("d"), 160)} for p in (d.get("points") or []) if isinstance(p, dict)][:3]
    demo = d.get("demo") if isinstance(d.get("demo"), dict) else {}
    rows = [{"a": txt(r.get("a"), 60), "b": txt(r.get("b"), 60), "badge": txt(r.get("badge"), 20)} for r in (demo.get("rows") or []) if isinstance(r, dict)][:3]
    stats = [{"v": txt(s.get("v"), 14), "l": txt(s.get("l"), 30)} for s in (demo.get("stats") or []) if isinstance(s, dict)][:3]
    steps = [{"t": txt(p.get("t"), 60), "d": txt(p.get("d"), 120)} for p in (d.get("steps") or []) if isinstance(p, dict)][:3]
    out = {"title": txt(d.get("title"), 60), "tagline": txt(d.get("tagline"), 120), "intro": txt(d.get("intro"), 400), "points": pts, "story": txt(d.get("story"), 700), "steps": steps, "usecase": txt(d.get("usecase"), 160), "demo": {"title": txt(demo.get("title"), 60), "rows": rows, "stats": stats}}
    if not out["title"] or not out["tagline"] or len(pts) < 3 or len(rows) < 3 or len(stats) < 3:
        raise ValueError("De AI gaf een onvolledige tekst terug.")
    return out


def content(module, lang):
    """(text, source): the database first (made or improved with the AI), then the built-in Dutch or English, then English as a fallback."""
    from .models import MarketingText

    row = MarketingText.objects.filter(module=module, lang=lang).first()
    if row:
        return row.data, "ai"
    own = _built_in(module, lang)
    if own:
        return own, "built-in"
    return (MarketingText.objects.filter(module=module, lang="en").first() or MarketingText(data=_built_in(module, "en"))).data, "fallback"


def active_languages():
    from .models import Language

    return [{"code": l.code, "name": l.name, "native_name": l.native_name, "rtl": l.rtl, "default": l.is_default} for l in Language.objects.filter(enabled=True)]


def _objects():
    from apps.sysobjects.models import SystemObject

    return {o.ref_key: o for o in SystemObject.objects.filter(kind="marketing")}


def set_master(on):
    """All marketing system objects on (one per module) or removed."""
    from apps.sysobjects.models import SystemObject

    if on:
        for m in list(modules.MODULES) + list(_installations().values()):
            SystemObject.objects.get_or_create(kind="marketing", ref_id=1, ref_key=m["key"], defaults={"slug": f"marketing-{m['key']}".replace("_", "-")})
    else:
        SystemObject.objects.filter(kind="marketing").delete()


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def admin(request):
    """Super admin → Prijzen → Marketing. GET: the tiles. POST {enabled: bool, modules: {key: bool}}: all on or off, or single tiles."""
    from apps.sysobjects.models import SystemObject

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    d = request.data if isinstance(request.data, dict) else {}
    if request.method == "POST":
        if "enabled" in d:
            set_master(bool(d["enabled"]))
        if isinstance(d.get("modules"), dict):
            if not _objects():
                set_master(True)
            for key, on in d["modules"].items():
                if _mod(key):
                    SystemObject.objects.filter(kind="marketing", ref_key=key).update(enabled=bool(on))
    objs = _objects()
    from .models import MarketingText

    have = {}
    for mod, lang in MarketingText.objects.values_list("module", "lang"):
        have.setdefault(mod, []).append(lang)
    items = []
    for m in list(modules.MODULES) + list(_installations().values()):
        o = objs.get(m["key"])
        text = _built_in(m["key"], "nl")
        items.append({"key": m["key"], "label": m["label"], "group": m.get("group", ""), "tagline": text["tagline"] if text else "", "slug": o.slug if o else "", "exists": bool(o), "on": bool(o and o.enabled), "ai_langs": sorted(have.get(m["key"], []))})
    return Response({"enabled": bool(objs), "items": items, "languages": active_languages()})


@api_view(["GET"])
@permission_classes([AllowAny])
def public(request, module):
    """The marketing text for the pop-up: ?lang=. Visitors only get it while the object of this module is on; super admins can always look."""
    if not _mod(module):
        return Response({"detail": "Onbekende module."}, status=status.HTTP_404_NOT_FOUND)
    staff = bool(request.user and request.user.is_authenticated and request.user.is_staff)
    o = _objects().get(module)
    if not staff and not (o and o.enabled):
        return Response({"detail": "Niet beschikbaar."}, status=status.HTTP_404_NOT_FOUND)
    langs = active_languages()
    lang = str(request.query_params.get("lang") or "nl")[:10]
    if lang not in {l["code"] for l in langs}:
        lang = next((l["code"] for l in langs if l["default"]), "nl")
    text, source = content(module, lang)
    return Response({"module": module, "group": (_mod(module) or {}).get("group", ""), "lang": lang, "source": source, "content": text, "languages": langs, "can_edit": staff})


def _json_object(raw):
    dec, best = json.JSONDecoder(), None
    for m in re.finditer(r"\{", raw):
        try:
            obj, _ = dec.raw_decode(raw[m.start():])
        except ValueError:
            continue
        if isinstance(obj, dict) and (best is None or len(json.dumps(obj)) > len(json.dumps(best))):
            best = obj
    if best is None:
        raise ValueError("Geen JSON in het antwoord van de AI.")
    return best


SYSTEM = ("You write short, friendly, concrete marketing copy for a module of Easy2edit, a modular website system. Keep product terms understandable and never invent prices or claims that are not plausible. "
          "Answer with ONE JSON object only, no text around it, with exactly these keys: title, tagline, intro, story (a longer explanation of 2 to 3 sentences, max 450 characters), steps (3 objects with t and d: how it works), usecase (one short sentence starting with who it is handy for), points (3 objects with t and d), demo (an object with title, rows (3 objects with a, b, badge) and stats (3 objects with v and l)). "
          "The demo holds made-up example data that fits the module. Keep every text short: title max 40 characters, tagline max 80, intro max 250, point title max 30, point text max 90.")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai(request, module):
    """AI for one module. {action: "improve", lang, instruction?}: make the text of that language better. {action: "translate", langs?}: translate the Dutch text into the active languages (all of them when langs is left out)."""
    from apps.integrations import ai as claude

    from .models import MarketingText

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    if not _mod(module):
        return Response({"detail": "Onbekende module."}, status=status.HTTP_404_NOT_FOUND)
    d = request.data if isinstance(request.data, dict) else {}
    action = d.get("action")
    names = {l["code"]: l["name"] for l in active_languages()}
    try:
        if action == "improve":
            lang = d.get("lang") if d.get("lang") in names else "nl"
            cur, _src = content(module, lang)
            prompt = (f"Improve this marketing text of the module \"{cur.get('title')}\" and write it in {names.get(lang, lang)}. Make it clearer, warmer and more convincing, keep the same structure.\n"
                      + (f"Extra wishes: {str(d.get('instruction'))[:400]}\n" if d.get("instruction") else "") + "Current text:\n" + json.dumps(cur, ensure_ascii=False))
            new = clean(_json_object(claude.claude(SYSTEM, prompt, 2000, 90)))
            MarketingText.objects.update_or_create(module=module, lang=lang, defaults={"data": new})
            return Response({"lang": lang, "content": new})
        if action == "translate":
            base, _s = content(module, "nl")
            want = [c for c in (d.get("langs") or [x for x in names if x not in ("nl", "en")]) if c in names and c != "nl"]  # nl and en are built in: only when asked
            done = {}
            for code in want:
                prompt = f"Translate this Dutch marketing text of a website module into {names[code]} (language code {code}). Keep the JSON structure and keys exactly the same and translate every value, also the demo data.\n" + json.dumps(base, ensure_ascii=False)
                new = clean(_json_object(claude.claude(SYSTEM, prompt, 2000, 90)))
                MarketingText.objects.update_or_create(module=module, lang=code, defaults={"data": new})
                done[code] = new
            return Response({"translated": sorted(done), "content": done})
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:  # noqa: BLE001 - network or API problem
        return Response({"detail": f"De AI kon niet antwoorden: {str(e)[:160]}"}, status=status.HTTP_502_BAD_GATEWAY)
    return Response({"detail": "Onbekende actie."}, status=status.HTTP_400_BAD_REQUEST)

# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Fake members for testing (admins with the users right, when Claude is linked or the sandbox simulates it):
AI invents the people (names, profile fields from the community settings), and a few illustrative avatars are drawn as their photos.
They are recognisable (username fake_…, e-mail …@example.com) and can all be removed at once."""
import colorsys
import io
import json
import logging
import random
import re
import secrets
from datetime import date, timedelta

from django.core.files.base import ContentFile
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import has_level
from apps.core.modules import module_required

from .models import User

logger = logging.getLogger(__name__)
PERM = [has_level("users", "manage"), module_required("users")]
bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731
FIRST = {"m": ["Daan", "Sem", "Lucas", "Milan", "Thijs", "Bram", "Ruben", "Jesse", "Tim", "Niels"], "f": ["Emma", "Sophie", "Julia", "Lotte", "Fleur", "Anna", "Nina", "Eva", "Sanne", "Iris"],
         "x": ["Sam", "Robin", "Alex", "Charlie", "Jamie", "Noa", "Dani", "Kai"]}
LAST = ["de Vries", "Jansen", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "Bos", "Vos", "Peters", "Hendriks", "van Dijk", "Dekker", "Brouwer"]
CITIES = [("Amsterdam", "NL"), ("Rotterdam", "NL"), ("Utrecht", "NL"), ("Eindhoven", "NL"), ("Antwerpen", "BE"), ("Gent", "BE"), ("Keulen", "DE"), ("Groningen", "NL")]
INTERESTS = ["reizen", "koken", "wandelen", "muziek", "fotografie", "sport", "lezen", "film", "tuinieren", "dansen", "yoga", "fietsen"]
HUE = {"m": 0.60, "f": 0.92, "x": 0.13}  # blue, rose, yellow: the gender colours of the system


def _fields():
    from apps.plugins import facade

    social = facade.mod("community", "service")
    if not social:
        return []
    cfg = social.get()["profiles"]
    return [f for f in cfg.get("fields", []) if f.get("type") in ("text", "textarea", "number", "select", "multiselect", "checkbox", "url", "date")]


def _simulated(n, gender, fields):
    out = []
    for _ in range(n):
        g = gender or random.choice("mfx")
        first, city = random.choice(FIRST[g]), random.choice(CITIES)
        vals = {}
        for f in fields:
            t, opts = f["type"], f.get("options") or []
            if t == "select" and opts:
                vals[f["key"]] = random.choice(opts)
            elif t == "multiselect" and opts:
                vals[f["key"]] = random.sample(opts, min(len(opts), random.randint(1, 3)))
            elif t == "checkbox":
                vals[f["key"]] = random.choice([True, False])
            elif t == "number":
                unit = str(f.get("unit") or "").lower()
                vals[f["key"]] = random.randint(150, 200) if unit == "cm" else random.randint(1, 10) if unit in ("uur", "jaar") else random.randint(1, 30)
            elif t in ("text", "textarea"):
                vals[f["key"]] = f"{f.get('label', '')} van {first}"[:80]
        out.append({"first_name": first, "last_name": random.choice(LAST), "gender": g, "age": random.randint(22, 58), "city": city[0], "country": city[1], "function": "Testgebruiker",
                    "short": "Nep-gebruiker voor testen", "description": f"{first} is een testprofiel zonder echte persoon.", "headline": f"Hoi, ik ben {first}!", "bio": f"Dit is een nep-profiel om het systeem te testen. {first} houdt van {random.choice(INTERESTS)}.",
                    "interests": random.sample(INTERESTS, 3), "aim": random.choice(["dating", "relationship", "friends", "chat"]), "fields": vals})
    return out


def _generate(n, gender, mood, fields):
    from apps.integrations import ai
    from apps.sandbox import service as sandbox

    if sandbox.active("integrations"):
        return _simulated(n, gender, fields), True
    spec = [{"key": f["key"], "label": f["label"], "type": f["type"], **({"options": f["options"]} if f.get("options") else {})} for f in fields]
    system = ("Je maakt FICTIEVE leden voor het testen van een community-website. Antwoord ALLEEN met een JSON-lijst, zonder uitleg of markdown. Elk element: "
              '{"first_name","last_name","gender" (m|f|x),"age" (22-65),"city","country" (ISO-2),"function","short" (max 80 tekens),"description" (max 300),"headline" (max 100),'
              '"bio" (max 400),"interests" (3-6 woorden),"aim" (dating|relationship|friends|chat),"fields": {veldsleutel: waarde}}. '
              "Verzin gevarieerde, realistische Nederlandse en Belgische namen en levens. Vul in 'fields' de profielvelden van deze site in en gebruik bij keuzevelden alleen de opties: "
              + json.dumps(spec, ensure_ascii=False))
    ask = f"Maak {n} fictieve leden" + (f", allemaal gender '{gender}'" if gender else "") + (f". Sfeer of wens: {mood}" if mood else "") + "."
    raw = ai.claude(system, ask, 4000 + 400 * n)
    m = re.search(r"\[.*\]", raw, re.S)
    people = json.loads(m.group(0)) if m else None
    if not isinstance(people, list):
        raise ValueError("Claude gaf een antwoord dat niet te lezen was. Probeer het nog eens.")
    return people[:n], False


def _avatar(gender, name, seed):
    """An illustrative portrait (no real person): coloured background in the gender colour, a head and shoulders."""
    from PIL import Image, ImageDraw, ImageFont

    rnd = random.Random(seed)
    w, h = 640, 800
    base = HUE.get(gender, HUE["x"]) + rnd.uniform(-0.04, 0.04)
    top, bot = [tuple(int(c * 255) for c in colorsys.hls_to_rgb(base % 1, l, 0.55)) for l in (0.82, 0.55)]
    img = Image.new("RGB", (w, h), top)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    skin = rnd.choice([(250, 220, 196), (236, 190, 160), (214, 160, 124), (170, 118, 86), (120, 80, 58)])
    cloth = tuple(int(c * 255) for c in colorsys.hls_to_rgb(rnd.random(), 0.35, 0.5))
    hair = rnd.choice([(40, 30, 25), (90, 60, 35), (160, 120, 60), (200, 170, 110), (30, 30, 35), (120, 120, 125)])
    cx = w // 2 + rnd.randint(-20, 20)
    d.ellipse([cx - 230, 520, cx + 230, 1000], fill=cloth)  # shoulders
    d.rectangle([cx - 45, 430, cx + 45, 560], fill=skin)  # neck
    long_hair = gender == "f" or (gender == "x" and rnd.random() < 0.5)
    if long_hair:
        d.rounded_rectangle([cx - 150, 190, cx + 150, 520], radius=120, fill=hair)
    d.ellipse([cx - 115, 210, cx + 115, 470], fill=skin)  # head
    d.pieslice([cx - 125, 190, cx + 125, 420], 180, 360, fill=hair)  # hair on top
    for dx in (-45, 45):  # eyes
        d.ellipse([cx + dx - 9, 335, cx + dx + 9, 353], fill=(40, 40, 50))
    d.arc([cx - 40, 370, cx + 40, 425], 20, 160, fill=(150, 70, 70), width=5)
    try:
        font = ImageFont.load_default(size=34)
        d.text((w // 2, h - 40), (name or "")[:24], fill=(255, 255, 255), font=font, anchor="mm")
    except Exception:  # noqa: BLE001
        pass
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=82)
    return buf.getvalue()


def _clean_value(f, v):
    t, opts = f["type"], f.get("options") or []
    if t == "select":
        return v if v in opts else ""
    if t == "multiselect":
        return [x for x in (v or []) if x in opts] if isinstance(v, list) else []
    if t == "checkbox":
        return bool(v)
    if t == "number":
        try:
            return float(v) if "." in str(v) else int(v)
        except (TypeError, ValueError):
            return None
    return str(v or "")[:500]


def _create(person, fields, photos):
    from apps.plugins import facade

    social = facade.community
    ProfilePhoto = facade.models("community", "ProfilePhoto")  # (the plugin Community)

    gender = person.get("gender") if person.get("gender") in ("m", "f", "x") else random.choice("mfx")
    first, last = str(person.get("first_name") or "Test")[:60], str(person.get("last_name") or "Gebruiker")[:60]
    uid = secrets.token_hex(4)
    age = max(18, min(80, int(person.get("age") or 30) if str(person.get("age") or "").isdigit() else 30))
    born = date.today() - timedelta(days=age * 365 + random.randint(0, 300))
    user = User(username=f"fake_{uid}", email=f"fake-{uid}@example.com", first_name=first, last_name=last, gender=gender, birth_date=born, function=str(person.get("function") or "")[:200],
                short=str(person.get("short") or "")[:255], description=str(person.get("description") or "")[:1500], city=str(person.get("city") or "")[:100],
                country=str(person.get("country") or "").upper()[:2], is_active=True, email_verified=True)
    user.set_password(secrets.token_urlsafe(20))
    user.save()
    p = social.profile_of(user)
    p.enabled, p.discover, p.visibility = True, True, "members"
    p.headline, p.bio, p.gender, p.birth_date = str(person.get("headline") or "")[:150], str(person.get("bio") or "")[:2000], gender, born
    p.city, p.country = user.city, user.country
    p.interests = [str(x)[:30] for x in (person.get("interests") or [])][:8]
    p.aim = person.get("aim") if person.get("aim") in ("dating", "relationship", "friends", "chat") else "friends"
    vals = person.get("fields") or {}
    p.data = {f["key"]: _clean_value(f, vals.get(f["key"])) for f in fields if f["key"] in vals}
    p.save()
    for i in range(photos):
        photo = ProfilePhoto(profile=p, visibility="public", order=i)
        photo.image.save("p.jpg", ContentFile(_avatar(gender, first, f"{uid}{i}")), save=False)
        photo.save()
        social.make_blur(photo)
        photo.save()
        if i == 0:
            user.image.save("a.jpg", ContentFile(_avatar(gender, first, f"{uid}0")), save=True)
    return user


@api_view(["GET", "POST", "DELETE"])
@permission_classes(PERM)
def fake_users(request):
    from apps.integrations import ai
    from apps.sandbox import service as sandbox

    fakes = User.objects.filter(username__startswith="fake_")
    ok = sandbox.active() and (ai.available() or sandbox.active("integrations"))  # fake members are a test tool: only while the sandbox is on
    if request.method == "GET":
        return Response({"available": ok, "simulated": sandbox.active("integrations"), "count": fakes.count(), "fields": [f["label"] for f in _fields()]})
    if request.method == "DELETE":
        from .erasure import erase_user

        n = 0
        for u in list(fakes):
            erase_user(u)
            n += 1
        return Response({"deleted": n})
    if not ok:
        return bad("Nep-gebruikers kunnen alleen met de sandbox aan en de Claude-koppeling (of gesimuleerde koppelingen).")
    try:
        n = max(1, min(10, int(request.data.get("count") or 1)))
        photos = max(0, min(4, int(request.data.get("photos") if request.data.get("photos") not in (None, "") else 2)))
    except (TypeError, ValueError):
        return bad("Aantal en foto's moeten getallen zijn.")
    gender = request.data.get("gender") if request.data.get("gender") in ("m", "f", "x") else ""
    mood = str(request.data.get("mood") or "").strip()[:300]
    fields = _fields()
    try:
        people, simulated = _generate(n, gender, mood, fields)
    except ValueError as e:
        return bad(str(e), 502)
    except Exception as e:  # noqa: BLE001
        logger.warning("Fake users failed: %s", e)
        return bad("Het maken is mislukt. Probeer het nog eens.", 502)
    made = [_create(p, fields, photos) for p in people if isinstance(p, dict)]
    logger.info("%s fake users created by %s", len(made), request.user.email)
    return Response({"created": [{"id": u.id, "name": f"{u.first_name} {u.last_name}", "email": u.email} for u in made], "simulated": simulated, "count": fakes.count()}, status=status.HTTP_201_CREATED)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, module_required("profiles")])
def fill_own_profile(request):
    """Test tool (sandbox only): AI fills in the whole profile of the logged-in member (profile fields, interests, aim, design, and two avatars when there are no photos)."""
    from apps.integrations import ai
    from apps.sandbox import service as sandbox
    from apps.plugins import facade

    social, themes = facade.community, facade.mod("community", "themes")
    ProfilePhoto = facade.models("community", "ProfilePhoto")  # (the plugin Community)
    if not social:
        return bad("De plugin Community staat uit.")

    ok = sandbox.active() and (ai.available() or sandbox.active("integrations"))
    if request.method == "GET":
        return Response({"available": ok, "simulated": sandbox.active("integrations")})
    if not ok:
        return bad("Alleen met de sandbox aan en de Claude-koppeling (of gesimuleerde koppelingen).")
    me, fields = request.user, _fields()
    p = social.profile_of(me)
    own_g = p.gender if p.gender in ("m", "f", "x") else ""
    try:
        people, _ = _generate(1, own_g, str(request.data.get("mood") or "").strip()[:300], fields)
        person = people[0]
    except Exception as e:  # noqa: BLE001 - shown to the tester
        logger.warning("fill own profile failed: %s", e)
        return bad(str(e) or "Invullen is niet gelukt. Probeer het nog eens.")
    gender = p.gender if p.gender in social.genders() else (person.get("gender") if person.get("gender") in social.genders() else random.choice("mfx"))
    age = max(18, min(80, int(person.get("age") or 30) if str(person.get("age") or "").isdigit() else 30))
    born = date.today() - timedelta(days=age * 365 + random.randint(0, 300))
    p.enabled, p.discover, p.visibility = True, True, p.visibility if p.visibility != "hidden" else "members"
    p.headline, p.bio = str(person.get("headline") or "")[:150], str(person.get("bio") or "")[:2000]
    p.gender, p.birth_date = gender, born
    p.city, p.country = str(person.get("city") or "")[:100], str(person.get("country") or "").upper()[:2]
    p.interests = [str(x)[:30] for x in (person.get("interests") or [])][:8]
    aims = [k for k, _ in social.aims()]
    p.aim = person.get("aim") if person.get("aim") in aims else (random.choice(aims) if aims else "")
    p.looking_for_genders = random.sample(list(social.genders()), random.randint(1, 2))
    p.design = random.choice(["", *themes.PROFILE_DESIGNS])
    vals = person.get("fields") or {}
    p.data = {f["key"]: _clean_value(f, vals.get(f["key"])) for f in fields if f["key"] in vals}
    p.save()
    type(me).objects.filter(pk=me.pk).update(gender=gender, birth_date=born, city=p.city, country=p.country)
    if not p.photos.exists():
        first = me.first_name or "Test"
        for i in range(2):
            photo = ProfilePhoto(profile=p, visibility="public", order=i)
            photo.image.save("p.jpg", ContentFile(_avatar(gender if gender in HUE else "x", first, f"{me.pk}-{i}")), save=False)
            photo.save()
            social.make_blur(photo)
            photo.save()
    return Response({"ok": True})


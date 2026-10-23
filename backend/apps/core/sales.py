"""Sales: the calculation form as a system object (a page can show it in edit mode) and what visitors can do with it: calculate a price and have the quotation mailed."""
import re

from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

SLUG = "calculatie-formulier"


class QuoteThrottle(AnonRateThrottle):
    """Mailing a quotation: a few per hour per address (it sends e-mail)."""
    rate = "10/hour"
    scope = "sales_quote"


class CalcThrottle(AnonRateThrottle):
    rate = "120/min"
    scope = "sales_calc"


EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # letters and digits without the ones that look alike (0/O, 1/I)


def settings():
    """The Sales settings of this website (kept with the system settings): where the requests go, whether the e-mail address must be confirmed, and which options the form offers."""
    from .models import SystemSettings

    raw = ((SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}).get("sales")) or {}
    opts = raw.get("options") if isinstance(raw.get("options"), dict) else {}
    return {"recipients": [x for x in raw.get("recipients", []) if EMAIL_RE.fullmatch(x)] if "recipients" in raw else None, "verify_email": bool(raw.get("verify_email")),
            "verify_method": raw.get("verify_method") if raw.get("verify_method") in ("code", "link", "screen") else "code",
            "options": {"questions": opts.get("questions"), "hosting": opts.get("hosting"), "installations": opts.get("installations"), "email": opts.get("email", True) is not False}}  # None = everything


def save_settings(d):
    from .models import SystemSettings

    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    data = dict(obj.data or {})
    cur = dict(data.get("sales") or {})
    if "recipients" in d:
        items = d["recipients"] if isinstance(d["recipients"], list) else str(d["recipients"]).replace(";", ",").split(",")
        items = [str(x).strip().lower() for x in items if str(x).strip()]
        bad = [x for x in items if not EMAIL_RE.fullmatch(x)]
        if bad:
            raise ValueError(f"Ongeldig e-mailadres: {bad[0]}")
        cur["recipients"] = items[:10]
    if "verify_email" in d:
        cur["verify_email"] = bool(d["verify_email"])
    if d.get("verify_method") in ("code", "link", "screen"):
        cur["verify_method"] = d["verify_method"]
    if isinstance(d.get("options"), dict):
        from . import pricing

        cfg = pricing.load()
        qs, hs = {q["key"] for q in cfg["wizard"] if q.get("type") != "choice"}, {h["key"] for h in pricing.hosting_options()}
        o = d["options"]
        from . import presets

        cur["options"] = {"questions": [k for k in (o.get("questions") or []) if k in qs] if o.get("questions") is not None else None,
                          "hosting": [k for k in (o.get("hosting") or []) if k in hs] if o.get("hosting") is not None else None,
                          "installations": [k for k in (o.get("installations") or []) if k in presets.BY_KEY] if o.get("installations") is not None else None, "email": bool(o.get("email", True))}
    data["sales"] = cur
    obj.data = data
    obj.save()


def recipients():
    """Who gets the note about a request: the addresses set here, otherwise the e-mail address of the reseller."""
    from . import pricing

    mine = settings()["recipients"]
    return mine if mine is not None else [x for x in [pricing.reseller_of({}).get("email")] if x]


def object_row():
    from apps.sysobjects.models import SystemObject

    return SystemObject.objects.filter(kind="calculator").first()


def set_object(on):
    """Make (or remove) the system object of the calculation form."""
    from apps.sysobjects.models import SystemObject

    if on:
        SystemObject.objects.get_or_create(kind="calculator", ref_id=1, ref_key="", defaults={"slug": SLUG})
    else:
        SystemObject.objects.filter(kind="calculator").delete()


def _live():
    o = object_row()
    return bool(o and o.enabled)


def _answers(raw):
    from . import pricing

    raw = raw if isinstance(raw, dict) else {}
    cfg = pricing.load()
    opts = settings()["options"]
    keys = {q["key"] for q in cfg["wizard"] if q.get("type") != "choice"}
    out = {k: bool(raw.get(k)) and (opts["questions"] is None or k in opts["questions"]) for k in keys}  # only what the form offers
    hosts = {h["key"] for h in pricing.hosting_options() if opts["hosting"] is None or h["key"] in opts["hosting"]} or {h["key"] for h in pricing.hosting_options()}
    out["hosting"] = raw.get("hosting") if raw.get("hosting") in hosts else (next(iter(sorted(hosts)), "shared") if (cfg.get("hosting") or {}).get("default", "shared") not in hosts else (cfg.get("hosting") or {}).get("default", "shared"))
    try:
        out["email"] = max(0, min(int((cfg.get("email") or {}).get("max", 200)), int(raw.get("email") or 0))) if opts["email"] else 0
    except (TypeError, ValueError):
        out["email"] = 0
    return out


def _admin_out():
    from . import pricing

    o, st = object_row(), settings()
    cfg = pricing.load()
    return {"system_object": bool(o), "slug": o.slug if o else SLUG, "recipients": recipients(), "recipients_custom": st["recipients"] is not None, "verify_email": st["verify_email"], "verify_method": st["verify_method"],
            "installations": [{"key": p["key"], "name": p["name"]} for p in __import__("apps.core.presets", fromlist=["PRESETS"]).PRESETS],
            "questions": [{"key": q["key"], "label": q["label"]} for q in cfg["wizard"] if q.get("type") != "choice"], "hosting": [{"key": h["key"], "label": h["label"]} for h in pricing.hosting_options()],
            "options": st["options"]}


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def admin(request):
    """Super admin → Prijzen → Sales. GET: the settings. POST {system_object, recipients, verify_email, options}: save."""
    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    d = request.data if isinstance(request.data, dict) else {}
    if request.method == "POST":
        if "system_object" in d:
            set_object(bool(d["system_object"]))
        try:
            save_settings(d)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(_admin_out())


def _installations(o):
    """The standard installations the form offers, each with the answers it stands for (only for the questions the form offers)."""
    from . import presets, pricing

    out = []
    for base in presets.PRESETS:
        if o["installations"] is not None and base["key"] not in o["installations"]:
            continue
        p = presets.get(base["key"])
        ans = pricing.answers_of(p)
        if o["questions"] is not None:
            ans = {k: v for k, v in ans.items() if k in o["questions"]}
        out.append({"key": p["key"], "name": p["name"], "icon": p["icon"], "desc": p["desc"], "answers": ans})
    return out


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([CalcThrottle])
def calc_config(request):
    """What the calculation form on a page needs (no purchase prices or margins)."""
    from . import pricing

    if not _live():
        return Response({"detail": "Niet beschikbaar."}, status=status.HTTP_404_NOT_FOUND)
    cfg, st = pricing.load(), settings()
    o = st["options"]
    hosting = [{k: h[k] for k in ("key", "label", "desc", "price")} for h in pricing.hosting_options() if o["hosting"] is None or h["key"] in o["hosting"]] or [{k: h[k] for k in ("key", "label", "desc", "price")} for h in pricing.hosting_options()]
    default = (cfg.get("hosting") or {}).get("default", "shared")
    return Response({"questions": [{k: q.get(k) for k in ("key", "label", "help", "requires")} for q in cfg["wizard"] if q.get("type") != "choice" and (o["questions"] is None or q["key"] in o["questions"])],
                     "hosting": hosting, "default_hosting": default if any(h["key"] == default for h in hosting) else hosting[0]["key"], "email": {k: pricing.email_config().get(k) for k in ("max", "tiers")} if o["email"] else None,
                     "vat_rate": cfg["vat_rate"], "periods": cfg["periods"], "verify_email": st["verify_email"], "verify_method": st["verify_method"], "installations": _installations(o)})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([CalcThrottle])
def calc_plan(request):
    from . import pricing

    if not _live():
        return Response({"detail": "Niet beschikbaar."}, status=status.HTTP_404_NOT_FOUND)
    return Response(pricing.public_plan(pricing.plan(_answers((request.data or {}).get("answers")))))


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([QuoteThrottle])
def calc_quote(request):
    """A visitor asks for the quotation: the PDF goes to the address entered, a note to the seller (the reseller in pricing.json)."""
    from apps.communication import sending

    from . import pricing, pricing_pdf

    if not _live():
        return Response({"detail": "Niet beschikbaar."}, status=status.HTTP_404_NOT_FOUND)
    d = request.data if isinstance(request.data, dict) else {}
    to, name, site = str(d.get("email") or "").strip(), str(d.get("name") or "").strip()[:200], str(d.get("site_name") or "").strip()[:100] or "-"
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", to) or not name:
        return Response({"detail": "Vul je naam en een geldig e-mailadres in."}, status=status.HTTP_400_BAD_REQUEST)
    lang = d.get("lang") if d.get("lang") in pricing_pdf.T else "nl"
    period = d.get("period") if d.get("period") in ("month", "quarter", "year") else "year"
    if settings()["verify_email"] and not _verified(d.get("token"), to):
        return Response({"detail": "Bevestig eerst je e-mailadres.", "verify": True}, status=status.HTTP_403_FORBIDDEN)
    answers = _answers(d.get("answers"))
    plan = pricing.plan(answers)
    seller = pricing.reseller_of({})
    pdf = pricing_pdf.build(plan, name, site, period, lang, reseller=seller)
    t = pricing_pdf.T[lang]
    fname = f"easy2edit-{t['title'].lower()}-{re.sub(r'[^a-z0-9]+', '-', site.lower()).strip('-') or 'website'}.pdf"
    try:
        sending.send_email(to, f"{t['title']} Easy2edit – {site}", f"{t['title']}: {site}\n\n{t['total']}: {pricing_pdf.eur(plan['monthly'])}\n\n{t['contact']}", attachments=[(fname, pdf, "application/pdf")])
    except sending.DeliveryError as e:
        return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
    chosen = ", ".join(plan["plugins"] + list(plan["answers"]))
    for rcpt in recipients():
        try:
            sending.send_email(rcpt, f"Nieuwe prijsberekening: {name} – {site}", f"Naam: {name}\nE-mail: {to}{' (bevestigd)' if settings()['verify_email'] else ''}\nWebsite: {site}\nPeriode: {period}\nTotaal per maand: {pricing_pdf.eur(plan['monthly'])}\nStandaard installatie: {str(d.get('installation') or '-')[:60]}\nKeuzes: {chosen}\nHosting: {answers['hosting']}, e-mailadressen: {answers['email']}")
        except sending.DeliveryError:
            pass  # the visitor has the quotation; the note to the seller is extra
    return Response({"sent": to})


# ── e-mail confirmation: a code of letters and digits by mail, then a token that the quotation request must carry ──────────
SALT_CHALLENGE, SALT_TOKEN, SALT_LINK = "sales-challenge", "sales-verified", "sales-link"


class VerifyThrottle(AnonRateThrottle):
    rate = "6/hour"
    scope = "sales_verify"


class CheckThrottle(AnonRateThrottle):
    rate = "30/hour"
    scope = "sales_check"


def _digest(email, code):
    import hashlib
    import hmac

    from django.conf import settings as dj

    return hmac.new(dj.SECRET_KEY.encode(), f"{email}|{code}".encode(), hashlib.sha256).hexdigest()


def _verified(token, email):
    from django.core import signing

    try:
        return signing.loads(str(token or ""), salt=SALT_TOKEN, max_age=3600).get("e") == email.lower()
    except signing.BadSignature:
        return False


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([VerifyThrottle])
def calc_verify(request):
    """Confirm an address. Method "code": a code of 6 letters and digits (valid 10 minutes), returns the challenge that goes back with the code.
    Method "link": a link in the e-mail; the form waits (verify/status/) until it was opened."""
    import secrets

    from django.core import signing

    from apps.communication import sending

    from .models import SalesVerification

    st = settings()
    if not _live() or not st["verify_email"]:
        return Response({"detail": "Niet beschikbaar."}, status=status.HTTP_404_NOT_FOUND)
    email = str((request.data or {}).get("email") or "").strip().lower()
    if not EMAIL_RE.fullmatch(email):
        return Response({"detail": "Vul een geldig e-mailadres in."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        if st["verify_method"] == "link":
            nonce = secrets.token_urlsafe(24)
            SalesVerification.objects.filter(created_at__lt=__import__("django.utils.timezone", fromlist=["now"]).now() - __import__("datetime").timedelta(days=1)).delete()
            SalesVerification.objects.create(nonce=nonce, email=email)
            link = request.build_absolute_uri("/api/sales/calculator/confirm/" + signing.dumps({"n": nonce}, salt=SALT_LINK) + "/")
            sending.send_email(email, "Bevestig je e-mailadres", f"Open deze link om je e-mailadres te bevestigen:\n\n{link}\n\nDe link is 30 minuten geldig. Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.")
            return Response({"method": "link", "nonce": nonce})
        code = "".join(secrets.choice(CODE_CHARS) for _ in range(6))
        sending.send_email(email, "Je bevestigingscode", f"Je code om je e-mailadres te bevestigen: {code}\n\nDe code is 10 minuten geldig. Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.", purpose="security", code=code)
    except sending.DeliveryError as e:
        return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
    return Response({"method": "code", "challenge": signing.dumps({"e": email, "h": _digest(email, code)}, salt=SALT_CHALLENGE)})


@api_view(["GET"])
@permission_classes([AllowAny])
@authentication_classes([])
@throttle_classes([CheckThrottle])
def calc_confirm(request, token):
    """The link in the e-mail: marks the address as confirmed (the form that waits picks it up) and shows a short page."""
    from django.core import signing
    from django.http import HttpResponse
    from django.utils import timezone

    from .models import SalesVerification

    page = lambda title, text, code=200: HttpResponse(f"<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>{title}</title><body style='font-family:system-ui;display:grid;place-items:center;min-height:90vh;margin:0;text-align:center;padding:1rem'><div><h1>{title}</h1><p>{text}</p></div>", status=code)  # noqa: E731
    try:
        n = signing.loads(token, salt=SALT_LINK, max_age=1800)["n"]
    except signing.BadSignature:
        return page("Link verlopen", "Deze link is niet meer geldig. Vraag in het formulier een nieuwe aan.", 400)
    row = SalesVerification.objects.filter(nonce=n).first()
    if not row:
        return page("Link verlopen", "Deze link is niet meer geldig. Vraag in het formulier een nieuwe aan.", 400)
    if not row.confirmed_at:
        row.confirmed_at = timezone.now()
        row.save(update_fields=["confirmed_at"])
    return page("Je e-mailadres is bevestigd", "Je kunt dit venster sluiten en terug naar het formulier gaan.")


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([CalcThrottle])
def calc_verify_status(request):
    """The form that waits for the link: {nonce, email} → {token} when it was opened, else {pending: true}."""
    from django.core import signing

    from .models import SalesVerification

    d = request.data if isinstance(request.data, dict) else {}
    row = SalesVerification.objects.filter(nonce=str(d.get("nonce") or ""), email=str(d.get("email") or "").strip().lower()).first()
    if not row:
        return Response({"detail": "Vraag eerst een link aan."}, status=status.HTTP_400_BAD_REQUEST)
    if not row.confirmed_at:
        return Response({"pending": True})
    return Response({"token": signing.dumps({"e": row.email}, salt=SALT_TOKEN)})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([CheckThrottle])
def calc_verify_check(request):
    """The code and the challenge → a token (valid an hour) that proves the address."""
    import hmac

    from django.core import signing

    d = request.data if isinstance(request.data, dict) else {}
    email, code = str(d.get("email") or "").strip().lower(), re.sub(r"[^A-Za-z0-9]", "", str(d.get("code") or "")).upper()
    try:
        ch = signing.loads(str(d.get("challenge") or ""), salt=SALT_CHALLENGE, max_age=600)
    except signing.SignatureExpired:
        return Response({"detail": "De code is verlopen. Vraag een nieuwe aan."}, status=status.HTTP_400_BAD_REQUEST)
    except signing.BadSignature:
        return Response({"detail": "Vraag eerst een code aan."}, status=status.HTTP_400_BAD_REQUEST)
    if ch.get("e") != email or not hmac.compare_digest(ch.get("h", ""), _digest(email, code)):
        return Response({"detail": "Deze code klopt niet."}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"token": signing.dumps({"e": email}, salt=SALT_TOKEN)})


def _random_code():
    import secrets

    return "".join(secrets.choice(CODE_CHARS) for _ in range(6))


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([CalcThrottle])
def calc_verify_screen(request):
    """Method "code on the screen": a random code of capitals and digits that the visitor reads from the pop-up and types over with the keyboard (no e-mail is sent; it stops robots).
    Returns the code (to be drawn in the pop-up) and the challenge that goes back with what was typed."""
    from django.core import signing

    if not _live() or not settings()["verify_email"] or settings()["verify_method"] != "screen":
        return Response({"detail": "Niet beschikbaar."}, status=status.HTTP_404_NOT_FOUND)
    email = str((request.data or {}).get("email") or "").strip().lower()
    if not EMAIL_RE.fullmatch(email):
        return Response({"detail": "Vul een geldig e-mailadres in."}, status=status.HTTP_400_BAD_REQUEST)
    code = _random_code()
    return Response({"method": "screen", "code": code, "challenge": signing.dumps({"e": email, "h": _digest(email, code)}, salt=SALT_CHALLENGE)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def admin_test(request):
    """Super admin → Prijzen → Sales: try a method of confirmation. {method: code|link|screen, email}. code: a mail with a code goes to the address; link: a mail with a link; screen: a code to draw."""
    import secrets

    from django.core import signing

    from apps.communication import sending

    from .models import SalesVerification

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    d = request.data if isinstance(request.data, dict) else {}
    method, email = d.get("method"), str(d.get("email") or "").strip().lower()
    if method not in ("code", "link", "screen") or not EMAIL_RE.fullmatch(email):
        return Response({"detail": "Kies een methode en vul een geldig e-mailadres in."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        if method == "screen":
            code = _random_code()
            return Response({"method": "screen", "code": code, "challenge": signing.dumps({"e": email, "h": _digest(email, code)}, salt=SALT_CHALLENGE)})
        if method == "link":
            nonce = secrets.token_urlsafe(24)
            SalesVerification.objects.create(nonce=nonce, email=email)
            link = request.build_absolute_uri("/api/sales/calculator/confirm/" + signing.dumps({"n": nonce}, salt=SALT_LINK) + "/")
            sending.send_email(email, "Test: bevestig je e-mailadres", f"Dit is een test van de bevestiging met een link. Open deze link:\n\n{link}")
            return Response({"method": "link", "nonce": nonce, "sent_to": email})
        code = _random_code()
        sending.send_email(email, "Test: je bevestigingscode", f"Dit is een test van de bevestiging met een code. Je code is: {code}", purpose="security", code=code)
    except sending.DeliveryError as e:
        return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
    return Response({"method": "code", "sent_to": email, "challenge": signing.dumps({"e": email, "h": _digest(email, code)}, salt=SALT_CHALLENGE)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def admin_test_check(request):
    """The typed code of a test: {email, challenge, code} → {ok}."""
    import hmac

    from django.core import signing

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    d = request.data if isinstance(request.data, dict) else {}
    email, code = str(d.get("email") or "").strip().lower(), re.sub(r"[^A-Za-z0-9]", "", str(d.get("code") or "")).upper()
    try:
        ch = signing.loads(str(d.get("challenge") or ""), salt=SALT_CHALLENGE, max_age=600)
    except signing.BadSignature:
        return Response({"ok": False, "detail": "De code is verlopen. Vraag een nieuwe aan."})
    return Response({"ok": ch.get("e") == email and hmac.compare_digest(ch.get("h", ""), _digest(email, code))})


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([CalcThrottle])
def pricelist(request):
    """The price list (public: it is also a system object on a page)."""
    from . import pricelist as pl

    return Response(pl.matrix())


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([CalcThrottle])
def pricelist_pdf(request):
    from django.http import HttpResponse

    from . import pricelist as pl

    lang = request.query_params.get("lang") or "nl"
    r = HttpResponse(pl.pdf(lang if lang in pl.T else "nl"), content_type="application/pdf")
    r["Content-Disposition"] = 'attachment; filename="easy2edit-prijslijst.pdf"'
    return r


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def pricelist_object(request):
    """Superadmin: make (or remove) the system object of the price list ({on}) or the ones of the standard installations ({on, installations: true})."""
    from apps.sysobjects.models import SystemObject

    from . import pricelist as pl
    from . import presets

    if not request.user.is_staff:
        return Response({"detail": "Alleen superadmins."}, status=status.HTTP_403_FORBIDDEN)
    on = bool(request.data.get("on"))
    if request.data.get("installations"):
        if on:
            for p in presets.PRESETS:
                SystemObject.objects.get_or_create(kind="installation", ref_id=1, ref_key=p["key"], defaults={"slug": f"installatie-{p['key']}"[:80]})
        else:
            SystemObject.objects.filter(kind="installation").delete()
    elif on:
        SystemObject.objects.get_or_create(kind="pricelist", ref_id=1, ref_key="", defaults={"slug": pl.SLUG})
    else:
        SystemObject.objects.filter(kind="pricelist").delete()
    return Response({"on": SystemObject.objects.filter(kind="pricelist").exists(), "installations": SystemObject.objects.filter(kind="installation").exists()})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pricelist_object_state(request):
    from apps.sysobjects.models import SystemObject

    return Response({"on": SystemObject.objects.filter(kind="pricelist").exists(), "installations": SystemObject.objects.filter(kind="installation").exists()})

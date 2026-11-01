# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Terms and conditions: the published versions, the draft of the superadmin and the signatures (e-mail code) of admins and superadmins."""
import hashlib
import hmac
import secrets

from django.conf import settings
from django.utils import timezone

from apps.accounts import access

from . import richtext, terms_text
from .models import Language, SystemSettings, TermsCode, TermsSignature, TermsVersion

CODE_MINUTES = 15
MAX_TRIES = 5
RESEND_SECONDS = 30
LIMIT = 60000  # characters of text per language


class TermsError(ValueError):
    pass


def is_local(request):
    host = (request.get_host() or "").split(":")[0].lower().strip("[]")
    return host in ("localhost", "127.0.0.1", "::1", "0.0.0.0") or host.endswith(".localhost") or host.endswith(".local")


def required(user):
    """Who must sign: superadmins and admins (anybody with edit rights in some module)."""
    return bool(user and user.is_authenticated and (user.is_staff or access.can_admin(user)))


def role(user):
    return "superadmin" if user.is_staff else "admin"


def langs():
    rows = list(Language.objects.filter(enabled=True).order_by("order").values("code", "name", "native_name"))
    have = {r["code"] for r in rows}
    return rows + [{"code": c, "name": n, "native_name": n} for c, n in (("nl", "Nederlands"), ("en", "English")) if c not in have]


def current():
    """The latest published version (version 1 is made from the standard text when there is none yet)."""
    v = TermsVersion.objects.first()
    if not v:
        v = TermsVersion.objects.create(version=1, texts=terms_text.DEFAULTS, published_by="system")
    return v


def pick(texts, lang):
    """The text in this language; without it: English, then Dutch, then anything."""
    for code in (lang, "en", "nl", *texts):
        t = texts.get(code) or {}
        if t.get("body"):
            return code, t.get("title") or "", t["body"]
    return lang, "", ""


def draft():
    d = (SystemSettings.objects.filter(pk=1).first().data or {}).get("terms_draft") if SystemSettings.objects.filter(pk=1).exists() else None
    return d if isinstance(d, dict) and d else None


def save_draft(texts):
    clean = {}
    for code, t in (texts or {}).items():
        if not isinstance(t, dict) or not str(code).isalpha() or len(str(code)) > 10:
            continue
        clean[code] = {"title": str(t.get("title") or "")[:200], "body": richtext.clean_small(t.get("body") or "", LIMIT)}
    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    obj.data = {**(obj.data or {}), "terms_draft": clean}
    obj.save()
    return clean


def publish(user):
    cur = current()
    texts = draft() or cur.texts
    if not any((t or {}).get("body") for t in texts.values()):
        raise TermsError("De voorwaarden hebben nog geen tekst.")
    v = TermsVersion.objects.create(version=cur.version + 1, texts=texts, published_by=user.email)
    obj, _ = SystemSettings.objects.get_or_create(pk=1)
    d = dict(obj.data or {})
    d.pop("terms_draft", None)
    obj.data = d
    obj.save()
    return v


def signed(user, version):
    return TermsSignature.objects.filter(user=user, version=version).exists()


def _hash(user, code):
    return hmac.new(settings.SECRET_KEY.encode(), f"{user.pk}:{code}".encode(), hashlib.sha256).hexdigest()


def send_code(user, request):
    """Mail a six-digit code. On a local server a superadmin gets the code back in the answer too (testing: no mailbox needed)."""
    from apps.communication import sending

    last = TermsCode.objects.filter(user=user).order_by("-created_at").first()
    if last and (timezone.now() - last.created_at).total_seconds() < RESEND_SECONDS:
        raise TermsError(f"Wacht even voordat je een nieuwe code vraagt ({RESEND_SECONDS} seconden).")
    code = f"{secrets.randbelow(10**6):06d}"
    TermsCode.objects.filter(user=user).delete()
    TermsCode.objects.create(user=user, code_hash=_hash(user, code), expires_at=timezone.now() + timezone.timedelta(minutes=CODE_MINUTES))
    local = user.is_staff and is_local(request)
    sent = True
    try:
        sending.send_email(user.email, "Je code voor het ondertekenen van de algemene voorwaarden",
                           f"Je code voor het ondertekenen van de algemene voorwaarden van easy2edit is: {code}\n\nDe code is {CODE_MINUTES} minuten geldig. Heb je dit niet zelf gevraagd, negeer dit bericht dan.", purpose="security", code=code)
    except Exception:  # noqa: BLE001 - on a local test server there is often no mail connection
        if not local:
            TermsCode.objects.filter(user=user).delete()
            raise TermsError("De e-mail met de code kon niet worden verstuurd. Controleer de e-mailkoppeling.")
        sent = False
    return {"sent": sent, "dev_code": code if local else None}


def sign(user, code, request, lang=""):
    tc = TermsCode.objects.filter(user=user).order_by("-created_at").first()
    if not tc or tc.expires_at < timezone.now():
        raise TermsError("De code is verlopen. Vraag een nieuwe code aan.")
    if tc.tries >= MAX_TRIES:
        raise TermsError("Te veel pogingen. Vraag een nieuwe code aan.")
    tc.tries += 1
    tc.save(update_fields=["tries"])
    if not hmac.compare_digest(tc.code_hash, _hash(user, str(code or "").strip())):
        raise TermsError("De code klopt niet.")
    tc.delete()
    v = current()
    ip = (request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or request.META.get("REMOTE_ADDR", ""))[:60]
    return TermsSignature.objects.create(user=user, version=v.version, role=role(user), name=(f"{user.first_name} {user.last_name}".strip() or user.email)[:200], email=user.email, lang=lang[:10], ip=ip)

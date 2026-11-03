# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Terms and conditions: the text for everybody, signing with an e-mail code (admins, superadmins) and the editing (superadmin)."""
import json
import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from . import richtext, terms

logger = logging.getLogger(__name__)


def _bad(msg, code=status.HTTP_400_BAD_REQUEST):
    return Response({"detail": msg}, status=code)


@api_view(["GET"])
@permission_classes([AllowAny])
def text(request):
    """The published terms in the asked language (fallback English, Dutch)."""
    v = terms.current()
    lang, title, body = terms.pick(v.texts, str(request.GET.get("lang") or "nl")[:10])
    return Response({"version": v.version, "lang": lang, "title": title, "body": body, "published_at": v.published_at})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def status_view(request):
    v = terms.current()
    need = terms.required(request.user)
    from apps.communication import sending

    mail = sending.email_integration() is not None
    return Response({"required": need, "version": v.version, "signed": terms.signed(request.user, v.version) if need else True, "local": bool(request.user.is_staff and (terms.is_local(request) or not mail)), "mail_ok": mail, "email": request.user.email})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def code(request):
    if not terms.required(request.user):
        return _bad("Alleen beheerders ondertekenen de voorwaarden.", status.HTTP_403_FORBIDDEN)
    try:
        return Response(terms.send_code(request.user, request))
    except terms.TermsError as e:
        return _bad(str(e))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sign(request):
    if not terms.required(request.user):
        return _bad("Alleen beheerders ondertekenen de voorwaarden.", status.HTTP_403_FORBIDDEN)
    try:
        if request.data.get("skip"):  # a superadmin: without the e-mail code
            s = terms.sign_skip(request.user, request, str(request.data.get("lang") or ""))
        else:
            s = terms.sign(request.user, request.data.get("code"), request, str(request.data.get("lang") or ""))
    except terms.TermsError as e:
        return _bad(str(e))
    logger.info("Terms version %s signed by %s (%s)", s.version, s.email, s.role)
    return Response({"signed": True, "version": s.version})


@api_view(["POST"])
@permission_classes([IsAdminUser])
def enable_mail(request):
    """A superadmin switches the e-mail link on (made from the environment of the server when it does not exist)."""
    ok = terms.enable_mail()
    return Response({"mail_ok": ok, "detail": "" if ok else "Er is nog geen e-mailkoppeling met instellingen. Maak er een bij API keys (Postmark of SMTP), of zet EASY2EDIT_POSTMARK_TOKEN in de omgeving van de server."})


def _admin_out():
    v = terms.current()
    d = terms.draft()
    from .models import TermsSignature

    sigs = list(TermsSignature.objects.filter(version=v.version).values("name", "email", "role", "signed_at", "method")[:50])
    return {"langs": terms.langs(), "version": v.version, "published_at": v.published_at, "published_by": v.published_by, "texts": d or v.texts, "has_draft": bool(d), "published_texts": v.texts, "signatures": sigs, "signed_count": TermsSignature.objects.filter(version=v.version).count()}


@api_view(["GET", "PUT"])
@permission_classes([IsAdminUser])
def admin(request):
    if request.method == "PUT":
        if not isinstance(request.data.get("texts"), dict):
            return _bad("Geen teksten ontvangen.")
        terms.save_draft(request.data["texts"])
    return Response(_admin_out())


@api_view(["POST"])
@permission_classes([IsAdminUser])
def publish(request):
    if request.data.get("texts") is not None:
        terms.save_draft(request.data["texts"])
    try:
        terms.publish(request.user)
    except terms.TermsError as e:
        return _bad(str(e))
    return Response(_admin_out())


@api_view(["POST"])
@permission_classes([IsAdminUser])
def reset_text(request):
    """Put the standard text (Dutch and English) back as the draft."""
    from . import terms_text

    terms.save_draft(terms_text.DEFAULTS)
    return Response(_admin_out())


@api_view(["POST"])
@permission_classes([IsAdminUser])
def translate(request):
    """Translate the text of one language into another with the AI (the result is put in the draft)."""
    from apps.integrations import ai

    from .models import Language

    src, dst = str(request.data.get("from") or "nl")[:10], str(request.data.get("to") or "")[:10]
    if not dst or src == dst:
        return _bad("Kies een andere taal om naartoe te vertalen.")
    if not ai.available():
        return _bad("Koppel eerst een AI-dienst bij API keys.")
    d = terms.draft() or terms.current().texts
    base = (d.get(src) or {})
    if not base.get("body"):
        return _bad("Er is geen tekst om te vertalen.")
    name = Language.objects.filter(code=dst).values_list("name", flat=True).first() or dst
    system = (f"You translate legal terms and conditions into {name} ({dst}). Keep the meaning and the legal tone exactly. Keep the HTML tags (p, strong, ul, li, a) and the structure unchanged: translate only the text. "
              'Answer with ONE JSON object only: {"title": "...", "body": "html:..."}.')
    try:
        from . import themeimport

        o = themeimport._parse_json(ai.claude(system, json.dumps({"title": base.get("title", ""), "body": base["body"]}, ensure_ascii=False), max_tokens=8000, timeout=170), need=("title", "body"))
    except Exception as e:  # noqa: BLE001
        return _bad(f"Vertalen is niet gelukt: {e}")
    body = str(o["body"])
    if not body.startswith(richtext.PREFIX):
        body = richtext.PREFIX + body
    d = {**d, dst: {"title": str(o["title"])[:200], "body": richtext.clean_small(body, terms.LIMIT)}}
    terms.save_draft(d)
    return Response(_admin_out())

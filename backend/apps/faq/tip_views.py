import re

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.access import level

from .models import HelpTip

KEY = re.compile(r"[a-z0-9-]{1,60}")


def _can(request):
    return request.user.is_authenticated and level(request.user, "pages") >= 2


@api_view(["GET"])
@permission_classes([AllowAny])
def tips(request):
    """The changed help texts of the edit mode: {key: {lang: text}} (for everyone who edits)."""
    if not request.user.is_authenticated:
        return Response({})
    return Response({t.key: t.texts for t in HelpTip.objects.all()})


@api_view(["PUT", "DELETE"])
@permission_classes([AllowAny])
def tip(request, key):
    if not _can(request):
        return Response({"detail": "Je hebt hier geen rechten voor."}, status=status.HTTP_403_FORBIDDEN)
    if not KEY.fullmatch(key):
        return Response({"detail": "Onbekend onderdeel."}, status=status.HTTP_400_BAD_REQUEST)
    if request.method == "DELETE":
        HelpTip.objects.filter(key=key).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    raw = request.data.get("texts")
    texts = {str(k)[:5]: str(v).strip()[:600] for k, v in (raw.items() if isinstance(raw, dict) else []) if re.fullmatch(r"[a-z]{2,5}", str(k)) and str(v).strip()}
    if not texts:
        HelpTip.objects.filter(key=key).delete()
        return Response({})
    HelpTip.objects.update_or_create(key=key, defaults={"texts": texts})
    return Response(texts)


DEFAULTS = {"nav_link": True, "header_icon": True, "page_scope": "public"}  # where the FAQ can be seen: link in the left menus, icon in the header, the page /faq (public) or /dashboard/faq (private)


def faq_settings():
    from apps.core.models import SystemSettings

    stored = (SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {}).get("faq") or {}
    out = {**DEFAULTS, **{k: stored[k] for k in DEFAULTS if k in stored}}
    out["page_scope"] = "private" if out["page_scope"] == "private" else "public"
    return {"nav_link": bool(out["nav_link"]), "header_icon": bool(out["header_icon"]), "page_scope": out["page_scope"]}


@api_view(["GET", "PUT"])
@permission_classes([AllowAny])
def settings_view(request):
    """Where the FAQ is shown (GET: everybody, the site needs it; PUT: whoever manages the pages)."""
    from apps.core.models import SystemSettings

    if request.method == "PUT":
        if not request.user.is_authenticated or level(request.user, "faq") < 3:
            return Response({"detail": "Je hebt hier geen rechten voor."}, status=status.HTTP_403_FORBIDDEN)
        cur = faq_settings()
        d = request.data
        new = {"nav_link": bool(d.get("nav_link", cur["nav_link"])), "header_icon": bool(d.get("header_icon", cur["header_icon"])), "page_scope": "private" if d.get("page_scope") == "private" else "public"}
        row, _ = SystemSettings.objects.get_or_create(pk=1)
        data = dict(row.data or {})
        data["faq"] = new
        row.data = data
        row.save()
    return Response(faq_settings())

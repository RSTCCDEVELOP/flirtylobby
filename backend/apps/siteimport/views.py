# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Site import API (module "siteimport": superadmins, or users who were given the module)."""
import logging

from django.core.files.storage import default_storage
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.permissions import has_level_for
from apps.core.modules import module_required
from apps.medialib.models import MediaItem
from apps.pages.models import Page

from . import importer
from .models import SiteImport

logger = logging.getLogger(__name__)
PERM = [has_level_for("siteimport", {"GET": "use"}, default="manage"), module_required("siteimport")]
ROLES = {"logo", "logo_dark", "favicon", "icon", "og_image"}  # brand slots (Logo's & beeld)
bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731


def _summary(imp):
    th = imp.theme or {}
    return {"id": imp.id, "name": imp.name, "slug": imp.slug, "status": imp.status, "source": imp.source, "kind": imp.kind, "created_at": imp.created_at,
            "folder": f"themes/{imp.slug}" if imp.slug else "",
            "theme": {"palette": th.get("palette", [])[:6], "primary": th.get("values", {}).get("primary"), "secondary": th.get("values", {}).get("secondary"),
                      "fonts": th.get("fonts", []), "dark": th.get("dark", False), "applied": imp.theme_applied,
                      "popup": th.get("popup"), "profile": th.get("profile")},
            "home": {"title": (imp.home or {}).get("title", ""), "exists": bool(imp.home), "applied": imp.home_applied},
            "pages": Page.objects.filter(source=imp.tag).count(), "images": MediaItem.objects.filter(source=imp.tag).count(), "notes": imp.notes}


def _detail(imp):
    out = {**_summary(imp)}
    if imp.status == "proposal":
        pr = imp.proposal or {}
        out["proposal"] = {**pr, "pages": [{**p, "i": n} for n, p in enumerate(pr.get("pages", []))],
                           "assets": [{**a, "url": default_storage.url(a["file"])} for a in pr.get("assets", [])],
                           "profile_options": PROFILE_OPTIONS, "popup_options": ["clean", "header", "glass", "minimal", "bold"]}
        # the pages' html stays on the server: the screen only needs a preview
        for p in out["proposal"]["pages"]:
            p.pop("html", None)
        out["proposal"]["home"] = {k: v for k, v in pr.get("home", {}).items() if k != "html"}
        return out
    items = {m.id: m for m in MediaItem.objects.filter(source=imp.tag)}
    out.update({"page_list": [{"id": p.id, "key": p.key, "title": next(iter(p.title.values()), p.key), "path": p.path, "in_menu": p.in_menu, "enabled": p.enabled} for p in Page.objects.filter(source=imp.tag)],
                "assets": [{"media": a["media"], "role": a["role"], "name": a["name"], "url": default_storage.url(items[a["media"]].key)} for a in imp.assets if a["media"] in items],
                "choices": {"popup": (imp.theme or {}).get("popup"), "popup_reason": (imp.theme or {}).get("popup_reason"), "profile": (imp.theme or {}).get("profile"), "profile_reason": (imp.theme or {}).get("profile_reason")}})
    return out


PROFILE_OPTIONS = ["normal", "dating", "sporters", "business", "webshop"]


@api_view(["GET", "POST"])
@permission_classes(PERM)
@parser_classes([JSONParser, MultiPartParser, FormParser])
def imports(request):
    if request.method == "GET":
        return Response({"imports": [_summary(i) for i in SiteImport.objects.all()], "folders": importer.list_folders()})
    d = request.data
    kind = d.get("kind")
    try:
        if kind == "url":
            imp = importer.import_url(d.get("url"), d.get("name"), request.user)
        elif kind == "folder":
            imp = importer.import_folder(str(d.get("folder") or ""), d.get("name"), request.user)
        elif kind == "zip" and request.FILES.get("file"):
            imp = importer.import_zip(request.FILES["file"], d.get("name"), request.user)
        else:
            return bad("Kies een website-adres, een map of een ZIP-bestand.")
    except importer.ImportError_ as e:
        return bad(str(e))
    except Exception as e:  # noqa: BLE001
        logger.exception("site import failed")
        return bad(f"Inlezen mislukt: {e}")
    logger.info("Site imported by %s: %s (%s)", request.user.email, imp.name, imp.source)
    return Response(_detail(imp), status=status.HTTP_201_CREATED)


@api_view(["GET", "DELETE"])
@permission_classes(PERM)
def one(request, pk):
    imp = SiteImport.objects.filter(pk=pk).first()
    if not imp:
        return bad("Niet gevonden.", status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        importer.remove_import(imp)
        logger.info("Site import %s removed by %s", pk, request.user.email)
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response(_detail(imp))


@api_view(["POST"])
@permission_classes(PERM)
@parser_classes([JSONParser])
def approve(request, pk):
    """The user checked the proposal: create the theme package, the pages and register the pictures."""
    imp = SiteImport.objects.filter(pk=pk).first()
    if not imp:
        return bad("Niet gevonden.", status.HTTP_404_NOT_FOUND)
    try:
        importer.approve(imp, request.data or {})
    except importer.ImportError_ as e:
        return bad(str(e))
    logger.info("Site import %s approved by %s", pk, request.user.email)
    return Response(_detail(imp))


@api_view(["POST"])
@permission_classes(PERM)
def theme(request, pk):
    imp = SiteImport.objects.filter(pk=pk).first()
    if not imp:
        return bad("Niet gevonden.", status.HTTP_404_NOT_FOUND)
    (importer.apply_theme if request.data.get("apply") else importer.revert_theme)(imp)
    return Response(_detail(imp))


@api_view(["POST"])
@permission_classes(PERM)
def home(request, pk):
    imp = SiteImport.objects.filter(pk=pk).first()
    if not imp:
        return bad("Niet gevonden.", status.HTTP_404_NOT_FOUND)
    try:
        (importer.apply_home if request.data.get("apply") else importer.revert_home)(imp)
    except importer.ImportError_ as e:
        return bad(str(e))
    return Response(_detail(imp))


@api_view(["POST"])
@permission_classes(PERM)
def asset(request, pk):
    """Use a picture of the import as logo / favicon / app icon / share image (Logo's & beeld)."""
    from apps.branding.models import SiteAsset

    imp = SiteImport.objects.filter(pk=pk).first()
    item = MediaItem.objects.filter(pk=request.data.get("media"), source=imp.tag).first() if imp else None
    role = request.data.get("role")
    if not item or role not in ROLES:
        return bad("Kies een afbeelding van deze import en een bestemming.")
    SiteAsset.objects.update_or_create(slot=role, defaults={"image": item.key})
    return Response({"ok": True})

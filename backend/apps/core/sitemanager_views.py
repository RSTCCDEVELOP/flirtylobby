# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The API of the site manager: the calls of the websites (register, ping) and the list for a superadmin+ (see sitemanager.py)."""
from django.http import Http404
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from . import sitemanager
from .models import EasySite


def _seen_ip(request):
    return request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR", "")


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def site_register(request):
    """A website reports itself for the first time. Only on the installation that is the easy2edit server; open to the world, so limited per address."""
    if not sitemanager.server_enabled():
        raise Http404
    ip = _seen_ip(request)
    if not sitemanager.rate_ok(ip):
        return Response({"detail": "Te veel aanmeldingen."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    try:
        site, key, callback = sitemanager.register(request.data if isinstance(request.data, dict) else {}, ip)
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except PermissionError as e:
        return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
    return Response({"key": key, "callback_key": callback, "url": site.url, "id": site.pk}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def site_ping(request):
    """A known website calls with its key (header X-Easy2edit-Key), for example at the login of an administrator: its record is updated."""
    if not sitemanager.server_enabled():
        raise Http404
    try:
        site, callback = sitemanager.ping(request.META.get("HTTP_X_EASY2EDIT_KEY", ""), request.data if isinstance(request.data, dict) else {}, _seen_ip(request))
    except PermissionError as e:
        blocked = EasySite.objects.filter(token_hash=sitemanager._hash(request.META.get("HTTP_X_EASY2EDIT_KEY", "")), status="blocked").first()
        if blocked:  # the website is told that it is blocked, with the message for its visitors: it goes offline itself (also when it could not be reached when it was blocked)
            return Response({"detail": str(e), "reason": "blocked", "message": blocked.block_message or sitemanager.BLOCK_MESSAGE}, status=status.HTTP_403_FORBIDDEN)
        return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
    return Response({"ok": True, "url": site.url, "status": site.status, **({"callback_key": callback} if callback else {})})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def site_component_request(request):
    """An approved website (with its key) sends a component request: merged with an open one or made here (see componentrequests.py)."""
    from . import componentrequests

    if not sitemanager.server_enabled():
        raise Http404
    site = sitemanager.site_for_key(request.META.get("HTTP_X_EASY2EDIT_KEY", ""))
    if not site:
        return Response({"detail": "Onbekende of geblokkeerde website."}, status=status.HTTP_403_FORBIDDEN)
    if not sitemanager.rate_ok(_seen_ip(request), 10):
        return Response({"detail": "Te veel aanvragen."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    try:
        return Response({"ok": True, **componentrequests.register_remote(site, request.data if isinstance(request.data, dict) else {})})
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


def _site_by_key(request):
    from . import siteowners  # noqa: F401

    return sitemanager.site_for_key(request.META.get("HTTP_X_EASY2EDIT_KEY", ""))


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def site_owner(request):
    """An approved website (with its key) gives its owner and company: they are found or made here, with the domain of the website added (see siteowners.py). Returns their ids."""
    from . import siteowners

    if not sitemanager.server_enabled():
        raise Http404
    site = _site_by_key(request)
    if not site:
        return Response({"detail": "Onbekende of geblokkeerde website."}, status=status.HTTP_403_FORBIDDEN)
    if not sitemanager.rate_ok(_seen_ip(request), 10):
        return Response({"detail": "Te veel aanvragen."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    try:
        return Response({"ok": True, **siteowners.register(site, request.data if isinstance(request.data, dict) else {})})
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def site_owner_remove(request):
    """A website (with its key) asks to remove its owner and company from here (at a reset)."""
    from . import siteowners

    if not sitemanager.server_enabled():
        raise Http404
    site = _site_by_key(request)
    if not site:
        return Response({"detail": "Onbekende of geblokkeerde website."}, status=status.HTTP_403_FORBIDDEN)
    try:
        return Response({"ok": True, **siteowners.remove(site, request.data if isinstance(request.data, dict) else {})})
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def site_disconnect(request):
    """A website disconnects itself (with its key): the server forgets its keys."""
    if not sitemanager.server_enabled():
        raise Http404
    try:
        sitemanager.disconnect_site(request.META.get("HTTP_X_EASY2EDIT_KEY", ""))
    except PermissionError as e:
        return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
    return Response({"ok": True})


def _approved(request):
    """The website that asks for the library or the default links: this installation must be the easy2edit server and the website must be known and approved.
    -> (site, None) or (None, the refusal; with "reason": "pending" when it only waits for approval)."""
    if not sitemanager.server_enabled():
        raise Http404
    site = sitemanager.site_for_key(request.META.get("HTTP_X_EASY2EDIT_KEY", ""))
    if site and site.status == "active":
        return site, None
    pending = bool(site and site.status == "pending")
    return None, Response({"detail": "Deze website wacht op goedkeuring." if pending else "Onbekende of geblokkeerde website.", "reason": "pending" if pending else "refused"}, status=status.HTTP_403_FORBIDDEN)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def source_list(request):
    """The library of this installation (the folder resource/) for the websites that use the easy2edit server as their source: ?kind=plugins|themas|languages|components|templates."""
    from . import resources

    site, refusal = _approved(request)
    if refusal:
        return refusal
    kind = request.query_params.get("kind")
    if kind not in resources.KINDS:
        return Response({"detail": "Onbekend onderdeel."}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"items": resources.local_catalog(kind, site=False)})  # only the library of the product, not what a superadmin made on this installation


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def source_file(request):
    """One zip of the library: ?kind=&file=name.zip."""
    import re

    from django.http import HttpResponse

    from . import resources

    site, refusal = _approved(request)
    if refusal:
        return refusal
    kind, file = request.query_params.get("kind"), str(request.query_params.get("file") or "")
    if kind not in resources.KINDS or not re.fullmatch(r"[A-Za-z0-9._+-]+\.zip", file):
        return Response({"detail": "Onbekend bestand."}, status=status.HTTP_400_BAD_REQUEST)
    folder = resources.root() / kind
    path = folder / file
    if not path.is_file() or path.resolve().parent != folder.resolve():
        raise Http404
    return HttpResponse(path.read_bytes(), content_type="application/zip")


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def default_links(request):
    """The API links that are marked "in every installation" (Admin -> API keys), with their keys: for approved websites only. The keys are not in the code (git): they come from here."""
    site, refusal = _approved(request)
    if refusal:
        return refusal
    from apps.integrations.models import Integration

    return Response({"links": [{"slug": o.slug, "provider": o.provider, "name": o.name, "superadmin_only": o.superadmin_only, "config": {k: v for k, v in (o.config or {}).items() if isinstance(v, str) and v.strip()}}
                               for o in Integration.objects.filter(in_installation=True).order_by("id")]})


# ── this website, asked by the easy2edit server (with the callback key) ─────
def _from_the_server(request):
    return sitemanager.callback_ok(request.META.get("HTTP_X_EASY2EDIT_CALLBACK", ""), _seen_ip(request))


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def remote_info(request):
    """What this website tells the easy2edit server: ?part=status|users|reseller|ai (numbers; no personal data of end users)."""
    from . import remote_info as info

    if not _from_the_server(request):
        return Response({"detail": "Niet toegestaan."}, status=status.HTTP_403_FORBIDDEN)
    part = request.query_params.get("part")
    if part not in info.PARTS:
        return Response({"detail": "Onbekend onderdeel."}, status=status.HTTP_400_BAD_REQUEST)
    return Response(info.build(part))


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def remote_state(request):
    """The easy2edit server takes this website offline (the maintenance page; administrators can still log in) or puts it online: {online: bool}."""
    from . import remote_info as info

    if not _from_the_server(request):
        return Response({"detail": "Niet toegestaan."}, status=status.HTTP_403_FORBIDDEN)
    return Response(info.set_online(bool(request.data.get("online")), str(request.data.get("message") or "")))


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def remote_action(request):
    """The easy2edit server tells this website to do something: {action: "plugin", name: "statistics", enabled} | {action: "energy_scan"}."""
    from . import remote_info as info

    if not _from_the_server(request):
        return Response({"detail": "Niet toegestaan."}, status=status.HTTP_403_FORBIDDEN)
    try:
        return Response(info.action(request.data if isinstance(request.data, dict) else {}))
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def remote_activate(request):
    """The easy2edit server asks this website to activate the connection: it exchanges a new callback key with its own server (with its own key). Harmless without a login: it only makes this website report
    to the server that is set in its own settings; limited per address."""
    from django.core.cache import cache

    ck = f"sitemgr-act:{_seen_ip(request)}"
    if cache.get(ck, 0) >= 10:
        return Response({"detail": "Te vaak."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    cache.set(ck, cache.get(ck, 0) + 1, 600)
    return Response(sitemanager.reactivate())


def _plus_only(request):
    if not request.user.is_superplus:
        return Response({"detail": "Alleen een superadmin+."}, status=status.HTTP_403_FORBIDDEN)
    return None


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def sites_admin(request):
    """Superadmin+: GET = this installation and (when it is the server) the list of websites. POST {action: "server", on} | {action: "sync"} (report this website now)."""
    if (deny := _plus_only(request)):
        return deny
    if request.method == "POST":
        action = request.data.get("action")
        if action == "server":
            sitemanager.set_server(bool(request.data.get("on")))
        elif action == "auto_approve":
            sitemanager.set_auto_approve(bool(request.data.get("on")))
        elif action == "check":  # a live check of the connection (this website as a client of the easy2edit server)
            return Response({"check": sitemanager.check(), "me": sitemanager.info()})
        elif action == "activate":  # exchange a new callback key with the easy2edit server
            result = sitemanager.reactivate()
            if not result["ok"]:
                return Response({"detail": f"Activeren is niet gelukt: {result['error']}", "info": sitemanager.info()}, status=status.HTTP_502_BAD_GATEWAY)
        elif action == "disconnect":
            sitemanager.disconnect()
        elif action == "connect":
            result = sitemanager.connect()
            if not result["ok"]:
                return Response({"detail": f"Verbinden is niet gelukt: {result['error']}", "info": sitemanager.info()}, status=status.HTTP_502_BAD_GATEWAY)
        elif action == "sync":
            result = sitemanager.report("sync", sitemanager.role_of(request.user))
            if not result["ok"]:
                return Response({"detail": f"Melden is niet gelukt: {result['error']}", **{"info": sitemanager.info()}}, status=status.HTTP_502_BAD_GATEWAY)
        else:
            return Response({"detail": "Onbekende actie."}, status=status.HTTP_400_BAD_REQUEST)
    me = sitemanager.info()
    return Response({"me": me, "sites": [sitemanager.public(s) for s in EasySite.objects.all()] if me["server"] else []})


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def site_admin(request, pk):
    """Superadmin+: change the name, address, notes or status (active | blocked) of a website in the list, or remove it from the list."""
    if (deny := _plus_only(request)):
        return deny
    site = EasySite.objects.filter(pk=pk).first()
    if not site:
        raise Http404
    if request.method == "DELETE":
        site.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    d = request.data if isinstance(request.data, dict) else {}
    if "name" in d:
        new_name = str(d["name"] or "").strip()[:150]
        if new_name != site.name:
            site.name_locked = True  # changed here: the website no longer overwrites it
        site.name = new_name
    if "notes" in d:
        site.notes = str(d["notes"] or "").strip()[:2000]
    offline = None
    if "status" in d:
        if d["status"] not in ("pending", "active", "blocked", "disconnected"):
            return Response({"detail": "Onbekende status."}, status=status.HTTP_400_BAD_REQUEST)
        offline = sitemanager.apply_status_change(site, d["status"], str(d.get("block_message") or ""))  # blocked: the website goes offline with a message
        site.status = d["status"]
    if "url" in d:
        url = sitemanager._clean_url(d["url"])
        if not url:
            return Response({"detail": "Gebruik een adres als https://naam.easy2edit.com (zonder pad)."}, status=status.HTTP_400_BAD_REQUEST)
        site.url, site.url_generated = url, False
    site.save()
    return Response({**sitemanager.public(site), "offline": offline})


def _site_or_404(pk):
    site = EasySite.objects.filter(pk=pk).first()
    if not site:
        raise Http404
    return site


def _remote_failed(e):
    return Response({"detail": str(e), "reason": e.reason}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def site_info(request, pk):
    """Superadmin+: information of a website, asked through its API: ?part=status|users|reseller|ai."""
    if (deny := _plus_only(request)):
        return deny
    try:
        return Response(sitemanager.site_info(_site_or_404(pk), str(request.query_params.get("part") or "")))
    except ValueError as e:
        if isinstance(e, sitemanager.RemoteError):
            return _remote_failed(e)
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def site_action(request, pk):
    """Superadmin+: tell a website to switch the plugin Statistics or to start a measurement of its energy use, through its API."""
    if (deny := _plus_only(request)):
        return deny
    try:
        return Response(sitemanager.site_action(_site_or_404(pk), request.data if isinstance(request.data, dict) else {}))
    except sitemanager.RemoteError as e:
        return _remote_failed(e)
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def site_activate(request, pk):
    """Superadmin+: activate the connection with a website through its API (a new callback key is exchanged)."""
    if (deny := _plus_only(request)):
        return deny
    try:
        return Response(sitemanager.activate_site(_site_or_404(pk)))
    except sitemanager.RemoteError as e:
        return _remote_failed(e)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def site_online(request, pk):
    """Superadmin+: take a website offline or put it online again, through its API: {online: bool}."""
    if (deny := _plus_only(request)):
        return deny
    try:
        return Response(sitemanager.set_site_online(_site_or_404(pk), bool(request.data.get("online")), str(request.data.get("message") or "")))
    except sitemanager.RemoteError as e:
        return _remote_failed(e)


# ── resellers ────────────────────────────────────────────────────────────────
def _reseller_guard(request):
    """Resellers are managed by a superadmin+ on the installation that is the easy2edit server only."""
    if (deny := _plus_only(request)):
        return deny
    if not sitemanager.server_enabled():
        return Response({"detail": "Alleen op de easy2edit-server."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _reseller_or_404(pk):
    from .models import Reseller

    r = Reseller.objects.filter(pk=pk).first()
    if not r:
        raise Http404
    return r


def _res_error(e):
    return Response({"detail": str(e), "errors": getattr(e, "errors", {})}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
def resellers_admin(request):
    """Superadmin+: the list of resellers (GET) or a new one (POST)."""
    from . import resellers
    from .models import Reseller

    if (deny := _reseller_guard(request)):
        return deny
    if request.method == "POST":
        try:
            r = resellers.save(None, request.data if isinstance(request.data, dict) else {})
        except resellers.ResellerError as e:
            return _res_error(e)
        return Response(resellers.brief(r), status=status.HTTP_201_CREATED)
    return Response({"resellers": [resellers.brief(r) for r in Reseller.objects.prefetch_related("sites", "logins")], "default_share": str(resellers.default_share()),
                     "sites": [{"id": s.pk, "name": s.name, "url": s.url, "reseller": s.reseller_id} for s in EasySite.objects.all()]})


@api_view(["GET", "PUT", "DELETE"])
def reseller_admin(request, pk):
    from . import resellers

    if (deny := _reseller_guard(request)):
        return deny
    r = _reseller_or_404(pk)
    if request.method == "DELETE":
        r.delete()
        resellers.sync_host()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.method == "PUT":
        try:
            r = resellers.save(r, request.data if isinstance(request.data, dict) else {}, site_url=_site_url_of(r))
        except resellers.ResellerError as e:
            return _res_error(e)
        resellers.sync_host()  # (an inactive reseller: its logins go from this site)
    return Response(resellers.brief(r))


def _site_url_of(r):
    s = r.sites.exclude(url="").first()
    return s.url if s else ""


@api_view(["POST"])
def reseller_logins(request, pk):
    """Superadmin+: a login for the reseller. POST {email, name, password (empty = made), send (e-mail with the password)} -> the login and the password (shown once)."""
    from . import resellers

    if (deny := _reseller_guard(request)):
        return deny
    r = _reseller_or_404(pk)
    d = request.data if isinstance(request.data, dict) else {}
    try:
        x, pw = resellers.add_login(r, d.get("email"), d, d.get("password"), bool(d.get("send")), _site_url_of(r))
    except resellers.ResellerError as e:
        return _res_error(e)
    return Response({"login": resellers.login_brief(x), "password": pw, "sent": getattr(x, "mail_sent", False)}, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
def reseller_login(request, pk, lid):
    """Superadmin+: switch a login on or off, give it a new password (PATCH {active, new_password: true|"text", send}) or remove it."""
    from . import resellers
    from .models import ResellerLogin

    if (deny := _reseller_guard(request)):
        return deny
    r = _reseller_or_404(pk)
    x = ResellerLogin.objects.filter(pk=lid, reseller=r).first()
    if not x:
        raise Http404
    if request.method == "DELETE":
        x.delete()
        resellers.sync_host()
        return Response(status=status.HTTP_204_NO_CONTENT)
    d = request.data if isinstance(request.data, dict) else {}
    pw = None
    try:
        resellers.change_login(x, d)
    except resellers.ResellerError as e:
        return _res_error(e)
    if d.get("new_password"):
        try:
            pw = resellers.set_password(x, "" if d["new_password"] is True else d["new_password"], bool(d.get("send")), _site_url_of(r))
        except resellers.ResellerError as e:
            return _res_error(e)
    return Response({"login": resellers.login_brief(x), "password": pw, "sent": bool(d.get("send")) and pw is not None})


@api_view(["PUT"])
def reseller_sites(request, pk):
    """Superadmin+: which websites belong to this reseller: PUT {site_ids: [..]} (the others of this reseller are let go)."""
    if (deny := _reseller_guard(request)):
        return deny
    r = _reseller_or_404(pk)
    ids = [int(x) for x in (request.data.get("site_ids") or []) if str(x).isdigit()] if isinstance(request.data, dict) else []
    EasySite.objects.filter(reseller=r).exclude(pk__in=ids).update(reseller=None)
    EasySite.objects.filter(pk__in=ids).update(reseller=r)
    from . import resellers

    return Response(resellers.brief(r))


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def resellers_public(request):
    """The public, searchable list of resellers (what may be public only): ?q="""
    from . import resellers

    return Response({"resellers": resellers.public_list(request.query_params.get("q", ""))})


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def reseller_accounts(request):
    """A website asks (with its key) who sells it and which logins its reseller has: they are made in that website."""
    from . import resellers

    if not sitemanager.server_enabled():
        raise Http404
    site = sitemanager.site_for_key(request.META.get("HTTP_X_EASY2EDIT_KEY", ""))
    if not site or site.status != "active":
        return Response({"detail": "Onbekende of niet goedgekeurde website."}, status=status.HTTP_403_FORBIDDEN)
    return Response(resellers.accounts_for(site))

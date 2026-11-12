# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The calculation and the measuring of the module Energie: page weight, requests and CO2 per page view, the scan of our own pages, and the collector that reads other sites."""
import gzip
import json
import logging
import random
import re
import ssl
import urllib.error
import urllib.request
from datetime import timedelta
from urllib.parse import urljoin, urlparse

from django.conf import settings as dj_settings
from django.db.models import F, Max, Sum
from django.db.models.functions import Greatest
from django.utils import timezone

from .models import EnergyDay, EnergyScan, EnergySettings, EnergySite

logger = logging.getLogger(__name__)

BENCH_BYTES = 2_300_000  # an average web page weighs about 2.3 MB (HTTP Archive): an indication to compare with
BENCH_REQUESTS = 70
RATINGS = [(0.095, "A+"), (0.186, "A"), (0.341, "B"), (0.493, "C"), (0.656, "D"), (0.846, "E")]  # grams CO2 per page view (the scale of Website Carbon); above: F
SKIP_PREFIX = ("/dashboard", "/login", "/admin", "/api", "/_next", "/registreren", "/wachtwoord")
DAYS = (7, 30, 90, 365)


def model(st=None):
    st = st or EnergySettings.load()
    return {"method": "Sustainable Web Design", "kwh_per_gb": float(st.kwh_per_gb), "g_per_kwh": float(st.g_per_kwh)}


def co2_g(nbytes, st=None):
    """Grams of CO2 for this amount of transferred data: bytes -> GB -> kWh over the whole chain (servers, network, device) -> grams."""
    st = st or EnergySettings.load()
    return (nbytes or 0) / 1e9 * float(st.kwh_per_gb) * float(st.g_per_kwh)


def kwh(nbytes, st=None):
    st = st or EnergySettings.load()
    return (nbytes or 0) / 1e9 * float(st.kwh_per_gb)


def rating(g):
    return next((r for lim, r in RATINGS if g <= lim), "F")


def clean_path(path):
    p = urlparse(str(path or "")).path or "/"
    p = re.sub(r"/{2,}", "/", p)
    if not p.startswith("/"):
        p = "/" + p
    return (p.rstrip("/") or "/")[:200]


# ── what the browsers of the visitors measured ──
def record(path, nbytes, nreq):
    """One page view: the page, the bytes that were transferred and the number of requests. Nothing about the person."""
    path = clean_path(path)
    if path.startswith(SKIP_PREFIX):
        return False
    try:
        nbytes, nreq = int(nbytes), int(nreq)
    except (TypeError, ValueError):
        return False
    if not (1_000 <= nbytes <= 200_000_000) or not (1 <= nreq <= 3000):
        return False
    row, _ = EnergyDay.objects.get_or_create(day=timezone.localdate(), path=path)
    EnergyDay.objects.filter(pk=row.pk).update(views=F("views") + 1, bytes_total=F("bytes_total") + nbytes, requests_total=F("requests_total") + nreq, bytes_max=Greatest(F("bytes_max"), nbytes))
    if random.random() < 0.002:
        prune()
    return True


def prune():
    st = EnergySettings.load()
    EnergyDay.objects.filter(day__lt=timezone.localdate() - timedelta(days=st.retention_days)).delete()
    for p in set(EnergyScan.objects.values_list("path", flat=True)):  # per page only the latest 30 scans
        old = list(EnergyScan.objects.filter(path=p).values_list("pk", flat=True)[30:])
        if old:
            EnergyScan.objects.filter(pk__in=old).delete()


def latest_scans():
    out, seen = [], set()
    for s in EnergyScan.objects.filter(ok=True)[:300]:
        if s.path not in seen:
            seen.add(s.path)
            out.append(s)
    return out


def summary(days=30, st=None):
    """The figures of this website over the last days: totals, the course per day, the pages, the scans, and the comparison with an average web page."""
    st = st or EnergySettings.load()
    days = days if days in DAYS else 30
    since = timezone.localdate() - timedelta(days=days - 1)
    qs = EnergyDay.objects.filter(day__gte=since)
    t = qs.aggregate(v=Sum("views"), b=Sum("bytes_total"), r=Sum("requests_total"), mx=Max("bytes_max"))
    views, b, r = t["v"] or 0, t["b"] or 0, t["r"] or 0
    series = [{"date": x["day"].isoformat(), "views": x["v"], "avg_bytes": round(x["b"] / x["v"]), "avg_requests": round(x["r"] / x["v"], 1), "avg_co2_g": round(co2_g(x["b"] / x["v"], st), 4), "co2_g": round(co2_g(x["b"], st), 3)}
              for x in qs.values("day").annotate(v=Sum("views"), b=Sum("bytes_total"), r=Sum("requests_total")).order_by("day") if x["v"]]
    pages = [{"path": x["path"], "views": x["v"], "avg_bytes": round(x["b"] / x["v"]), "avg_requests": round(x["r"] / x["v"], 1), "avg_co2_g": round(co2_g(x["b"] / x["v"], st), 4), "max_bytes": x["mx"]}
             for x in qs.values("path").annotate(v=Sum("views"), b=Sum("bytes_total"), r=Sum("requests_total"), mx=Max("bytes_max")).order_by("-v")[:25] if x["v"]]
    scans = [{"path": s.path, "bytes": s.bytes, "requests": s.requests, "co2_g": round(co2_g(s.bytes, st), 4), "breakdown": s.breakdown, "at": s.created_at.isoformat()} for s in latest_scans()]
    if views:
        source, avg_b, avg_r = "visitors", b / views, r / views
    elif scans:
        source, avg_b, avg_r = "scan", sum(s["bytes"] for s in scans) / len(scans), sum(s["requests"] for s in scans) / len(scans)
    else:
        source, avg_b, avg_r = "none", 0, 0
    g = co2_g(avg_b, st)
    bench_g = co2_g(BENCH_BYTES, st)
    return {
        "period_days": days, "source": source,
        "summary": {"views": views, "avg_page_bytes": round(avg_b), "avg_requests": round(avg_r, 1), "avg_co2_g": round(g, 4), "rating": rating(g) if avg_b else "", "heaviest_page_bytes": t["mx"] or 0,
                    "total_gb": round(b / 1e9, 4), "total_kwh": round(kwh(b, st), 4), "total_co2_kg": round(co2_g(b, st) / 1000, 4), "pages_measured": len({p["path"] for p in pages}) or len(scans)},
        "benchmark": {"page_bytes": BENCH_BYTES, "requests": BENCH_REQUESTS, "co2_g": round(bench_g, 4), "label": "Gemiddelde webpagina (indicatie, HTTP Archive)", "vs_pct": round((avg_b / BENCH_BYTES - 1) * 100) if avg_b else 0},
        "series": series, "pages": pages, "scans": scans, "model": model(st),
    }


def own_name():
    from apps.core import system

    return system.site_name()


def public_payload(days=30):
    """What the API gives to other websites: only totals and per page figures. Nothing about visitors."""
    from apps.core import system

    d = summary(days)
    return {"site": {"name": own_name(), "url": system.get().get("frontend_url", "")}, "generated_at": timezone.now().isoformat(), "version": 1, **d}


# ── our own scan: all the files that a page loads ──
def _trusted_origin(origin):
    from apps.core import system

    origin = (origin or "").rstrip("/")
    if not origin:
        return False
    if origin in set(getattr(dj_settings, "CORS_ALLOWED_ORIGINS", [])) | system.allowed_origins():
        return True
    return any(re.match(rx, origin) for rx in getattr(dj_settings, "CORS_ALLOWED_ORIGIN_REGEXES", []))


def site_base(request_origin=""):
    """The address of the website: the one in Basisgegevens, else the (trusted) address that the admin works from."""
    from apps.core import system

    fe = (system.get().get("frontend_url") or "").rstrip("/")
    if fe:
        return fe
    return request_origin.rstrip("/") if _trusted_origin(request_origin) else ""


def _fetch(url, limit=4_000_000, timeout=15):
    req = urllib.request.Request(url, headers={"Accept-Encoding": "gzip", "User-Agent": "Easy2edit-EnergyScan/1.0"})
    ctx = ssl._create_unverified_context() if (urlparse(url).hostname or "") in ("localhost", "127.0.0.1") else None  # only for a local test site with its own certificate
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as res:
        body = res.read(limit + 1)
        return body, (res.headers.get("Content-Type") or "").split(";")[0].strip().lower(), (res.headers.get("Content-Encoding") or "").lower()


def _text(body, enc):
    try:
        return (gzip.decompress(body) if "gzip" in enc else body).decode("utf-8", "replace")
    except Exception:  # noqa: BLE001
        return body.decode("utf-8", "replace")


def _kind(url, ctype):
    u = urlparse(url).path.lower()
    if "html" in ctype:
        return "html"
    if "javascript" in ctype or u.endswith((".js", ".mjs")):
        return "script"
    if "css" in ctype or u.endswith(".css"):
        return "style"
    if ctype.startswith("image/") or u.endswith((".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg", ".ico")) or "/_next/image" in url:
        return "image"
    if "font" in ctype or u.endswith((".woff", ".woff2", ".ttf", ".otf")):
        return "font"
    return "other"


def _assets(html, base_url):
    found = []
    for m in re.finditer(r"<script\b[^>]*\bsrc=[\"']([^\"']+)", html, re.I):
        found.append(m.group(1))
    for m in re.finditer(r"<link\b[^>]*>", html, re.I):
        tag = m.group(0)
        h = re.search(r"\bhref=[\"']([^\"']+)", tag, re.I)
        if h and re.search(r"rel=[\"']?[^\"'>]*(stylesheet|preload|modulepreload|icon)", tag, re.I):
            found.append(h.group(1))
    for m in re.finditer(r"<(?:img|source)\b[^>]*>", html, re.I):
        tag = m.group(0)
        s = re.search(r"\bsrc=[\"']([^\"']+)", tag, re.I) or re.search(r"\bsrcset=[\"']\s*([^\s\"',]+)", tag, re.I)
        if s:
            found.append(s.group(1))
    out, seen = [], set()
    for f in found:
        if f.startswith(("data:", "javascript:", "#", "mailto:")):
            continue
        u = urljoin(base_url, f.replace("&amp;", "&"))
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def scan_page(base, path):
    """Opens the page like a browser (compressed, as the visitor gets it) and adds up the page and the files of our own site that it loads."""
    path = clean_path(path)
    url = base.rstrip("/") + ("" if path == "/" else path)
    host = urlparse(base).netloc
    breakdown = {"html": 0, "script": 0, "style": 0, "image": 0, "font": 0, "other": 0}
    try:
        body, ctype, enc = _fetch(url, timeout=40)
        breakdown["html"] += len(body)
        html = _text(body, enc)
    except Exception as e:  # noqa: BLE001
        return EnergyScan.objects.create(path=path, ok=False, error=f"De pagina kon niet worden opgehaald: {str(e)[:200]}")
    requests, todo, done = 1, [u for u in _assets(html, url) if urlparse(u).netloc == host][:120], set()
    while todo and requests < 160:
        u = todo.pop(0)
        if u in done:
            continue
        done.add(u)
        try:
            b, ct, en = _fetch(u)
        except Exception:  # noqa: BLE001
            requests += 1
            continue
        requests += 1
        k = _kind(u, ct)
        breakdown[k] += len(b)
        if k == "style":  # the fonts and pictures that a stylesheet loads
            css = _text(b, en)
            for m in list(re.finditer(r"url\(\s*[\"']?([^)\"']+)", css))[:30]:
                ref = urljoin(u, m.group(1))
                if not ref.startswith("data:") and urlparse(ref).netloc == host and ref not in done and ref not in todo:
                    todo.append(ref)
    total = sum(breakdown.values())
    return EnergyScan.objects.create(path=path, bytes=total, requests=requests, breakdown=breakdown)


def scan(base, paths=None):
    st = EnergySettings.load()
    paths = [clean_path(p) for p in (paths or st.scan_paths or ["/"])][:20]
    out = [scan_page(base, p) for p in paths]
    prune()
    return out


# ── the collector: other sites ──
def _api_url(url):
    u = (url or "").strip()
    if not re.match(r"^https?://", u):
        u = "https://" + u
    u = u.rstrip("/")
    return u if "/api/energy/" in u else u + "/api/energy/public/"


def fetch_site(site, days=30):
    """Reads the API of a site and keeps the answer. Never raises: the result (ok or the reason) is saved with the site."""
    from apps.core.webtoolkit import ImportError_, check_public

    site.last_fetched = timezone.now()
    try:
        url = _api_url(site.url) + f"?days={days}"
        check_public(url)
        req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "Easy2edit-Energy/1.0", **({"X-Energy-Key": site.api_key} if site.api_key else {})})
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read(3_000_000))
        if not isinstance(data, dict) or "summary" not in data:
            raise ValueError("Dit is niet het antwoord van de energie-API.")
        site.data = {k: data.get(k) for k in ("site", "generated_at", "period_days", "source", "summary", "benchmark", "series", "pages", "scans", "model")}
        site.last_ok, site.last_error = True, ""
    except urllib.error.HTTPError as e:
        site.last_ok, site.last_error = False, {401: "De sleutel klopt niet.", 403: "De API van deze website staat uit of vraagt een sleutel.", 404: "Geen energie-API gevonden op dit adres."}.get(e.code, f"De website antwoordt met een fout (HTTP {e.code}).")
    except ImportError_ as e:
        site.last_ok, site.last_error = False, str(e)
    except Exception as e:  # noqa: BLE001
        site.last_ok, site.last_error = False, f"Geen verbinding of een onverwacht antwoord: {str(e)[:160]}"
    site.save()
    return site


def refresh_all(days=30):
    return [fetch_site(s, days) for s in EnergySite.objects.filter(enabled=True)]


def _site_row(name, url, d, own=False, **extra):
    s = (d or {}).get("summary") or {}
    return {"name": name, "url": url, "own": own, "summary": {k: s.get(k) for k in ("views", "avg_page_bytes", "avg_requests", "avg_co2_g", "rating", "total_kwh", "total_co2_kg", "pages_measured")}, "source": (d or {}).get("source", ""), **extra}


def network(public=False):
    """The total picture: this website and every connected website together (views-weighted averages, merged course per day)."""
    from apps.core import system

    own = summary(30)
    rows = [(_site_row(own_name(), system.get().get("frontend_url", ""), own, own=True, ok=True, error="", fetched=timezone.now().isoformat()), own)]
    for s in EnergySite.objects.filter(enabled=True):
        ok = bool(s.last_ok and s.data)
        row = _site_row(s.name, (s.data.get("site") or {}).get("url") or s.url, s.data if ok else {}, id=s.pk, ok=ok, error="" if public else s.last_error, fetched=s.last_fetched.isoformat() if s.last_fetched else None)
        if public and not ok:
            continue
        rows.append((row, s.data if ok else {}))
    used = [(r, d) for r, d in rows if r["ok"] and (r["summary"].get("avg_page_bytes") or 0) > 0]
    views = sum(r["summary"].get("views") or 0 for r, _ in used)
    w = lambda r: (r["summary"].get("views") or 0) if views else 1  # noqa: E731
    wsum = sum(w(r) for r, _ in used) or 1
    avg_b = sum((r["summary"]["avg_page_bytes"] or 0) * w(r) for r, _ in used) / wsum
    avg_r = sum((r["summary"].get("avg_requests") or 0) * w(r) for r, _ in used) / wsum
    st = EnergySettings.load()
    g = co2_g(avg_b, st)
    days = {}
    for r, d in used:
        for x in (d.get("series") or []):
            a = days.setdefault(x["date"], {"date": x["date"], "views": 0, "b": 0.0, "r": 0.0, "co2": 0.0})
            v = x.get("views") or 0
            a["views"] += v
            a["b"] += (x.get("avg_bytes") or 0) * v
            a["r"] += (x.get("avg_requests") or 0) * v
            a["co2"] += (x.get("co2_g") or 0)
    series = [{"date": k, "views": a["views"], "avg_bytes": round(a["b"] / a["views"]) if a["views"] else 0, "avg_requests": round(a["r"] / a["views"], 1) if a["views"] else 0, "avg_co2_g": round(a["co2"] / a["views"], 4) if a["views"] else 0, "co2_g": round(a["co2"], 3)} for k, a in sorted(days.items())]
    return {
        "title": st.network_title or "Alle websites samen", "generated_at": timezone.now().isoformat(), "version": 1,
        "totals": {"sites": len(rows), "sites_ok": len([1 for r, _ in rows if r["ok"]]), "views": views, "avg_page_bytes": round(avg_b), "avg_requests": round(avg_r, 1), "avg_co2_g": round(g, 4), "rating": rating(g) if avg_b else "",
                   "total_kwh": round(sum(r["summary"].get("total_kwh") or 0 for r, _ in used), 4), "total_co2_kg": round(sum(r["summary"].get("total_co2_kg") or 0 for r, _ in used), 4)},
        "benchmark": {"page_bytes": BENCH_BYTES, "requests": BENCH_REQUESTS, "co2_g": round(co2_g(BENCH_BYTES, st), 4), "vs_pct": round((avg_b / BENCH_BYTES - 1) * 100) if avg_b else 0},
        "sites": [r for r, _ in rows], "series": series,
    }

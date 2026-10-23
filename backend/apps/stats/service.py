# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Statistics: modules and plugins write counters (record), the pages of Statistieken read them (series, top, total).
Nothing here may ever break the caller: recording is wrapped so a problem is only logged."""
import hashlib
import logging
import re
from datetime import timedelta
from urllib.parse import urlparse

from django.conf import settings
from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone

from .models import StatDay, StatVisitor

logger = logging.getLogger(__name__)

# the visitors that are programs: (name, kind) by a part of the user agent; kind "search" (search engines), "ai" (AI assistants and crawlers for AI) or "other" (SEO tools, scrapers)
BOTS = [
    ("Googlebot", "search"), ("Bingbot", "search"), ("bingbot", "search"), ("DuckDuckBot", "search"), ("Baiduspider", "search"), ("YandexBot", "search"), ("Applebot", "search"), ("Slurp", "search"), ("Qwantify", "search"), ("SeznamBot", "search"),
    ("GPTBot", "ai"), ("ChatGPT-User", "ai"), ("OAI-SearchBot", "ai"), ("ClaudeBot", "ai"), ("Claude-Web", "ai"), ("Claude-User", "ai"), ("anthropic-ai", "ai"), ("PerplexityBot", "ai"), ("Perplexity-User", "ai"), ("Google-Extended", "ai"),
    ("CCBot", "ai"), ("Bytespider", "ai"), ("Amazonbot", "ai"), ("cohere-ai", "ai"), ("Meta-ExternalAgent", "ai"), ("FacebookBot", "ai"), ("DuckAssistBot", "ai"), ("MistralAI-User", "ai"), ("YouBot", "ai"),
    ("AhrefsBot", "other"), ("SemrushBot", "other"), ("MJ12bot", "other"), ("DotBot", "other"), ("PetalBot", "other"), ("Screaming Frog", "other"), ("facebookexternalhit", "other"), ("Twitterbot", "other"), ("LinkedInBot", "other"), ("WhatsApp", "other"),
    ("UptimeRobot", "other"), ("python-requests", "other"), ("curl/", "other"), ("Go-http-client", "other"),
]
_GENERIC_BOT = re.compile(r"bot|crawl|spider|slurp|fetch|scrap", re.I)

# where visitors come from: (name, kind) by a part of the host of the referrer
REFERRERS = [
    ("google.", "search", "Google"), ("bing.com", "search", "Bing"), ("duckduckgo.com", "search", "DuckDuckGo"), ("ecosia.org", "search", "Ecosia"), ("yahoo.", "search", "Yahoo"), ("baidu.com", "search", "Baidu"), ("yandex.", "search", "Yandex"), ("startpage.com", "search", "Startpage"),
    ("chatgpt.com", "ai", "ChatGPT"), ("chat.openai.com", "ai", "ChatGPT"), ("perplexity.ai", "ai", "Perplexity"), ("claude.ai", "ai", "Claude"), ("gemini.google.com", "ai", "Gemini"), ("copilot.microsoft.com", "ai", "Copilot"), ("you.com", "ai", "You.com"),
    ("facebook.com", "social", "Facebook"), ("instagram.com", "social", "Instagram"), ("linkedin.com", "social", "LinkedIn"), ("t.co", "social", "X"), ("twitter.com", "social", "X"), ("x.com", "social", "X"), ("pinterest.", "social", "Pinterest"), ("youtube.com", "social", "YouTube"), ("tiktok.com", "social", "TikTok"), ("whatsapp.com", "social", "WhatsApp"),
]


def today():
    return timezone.localdate()


def enabled():
    try:
        from apps.core import modules

        return modules.enabled("stats")
    except Exception:  # noqa: BLE001
        return True


def record(source, event, key="", n=1, day=None):
    """Count something: record("users", "login", key="42"). Safe to call from anywhere."""
    if not enabled():
        return
    try:
        day = day or today()
        key = str(key or "")[:200]
        with transaction.atomic():
            row, made = StatDay.objects.get_or_create(day=day, source=source[:60], event=event[:40], key=key, defaults={"count": n})
            if not made:
                StatDay.objects.filter(pk=row.pk).update(count=F("count") + n)
    except Exception:  # noqa: BLE001
        logger.warning("Statistics: %s/%s could not be recorded", source, event, exc_info=True)


def bot_of(ua):
    """(name, kind) of a program that visits, or None for a person."""
    ua = ua or ""
    for name, kind in BOTS:
        if name.lower() in ua.lower():
            return name, kind
    if _GENERIC_BOT.search(ua):
        return "Overige bot", "other"
    return None


def referrer_of(ref, own_host=""):
    """(kind, name) of the page a visitor came from, "direct" when there is none."""
    if not ref:
        return "direct", "Direct"
    host = (urlparse(ref).netloc or "").lower().split(":")[0]
    if not host or (own_host and own_host in host):
        return "direct", "Direct"
    for part, kind, name in REFERRERS:
        if part in host:
            return kind, name
    return "other", host[:60]


def _visitor_hash(request):
    ip = (request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or request.META.get("REMOTE_ADDR", ""))
    raw = f"{ip}|{request.META.get('HTTP_USER_AGENT', '')}|{today()}|{settings.SECRET_KEY}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def record_hit(request, path, referrer="", lang=""):
    """A page of the website was opened by a person (called by the site): page view, unique visitor, where from."""
    path = ("/" + str(path or "/").split("?")[0].split("#")[0].strip("/"))[:200] if str(path or "/").strip("/") else "/"
    if bot_of(request.META.get("HTTP_USER_AGENT", "")):
        return record_bot(request, path)
    record("seo", "page_view", path)
    try:
        _, made = StatVisitor.objects.get_or_create(day=today(), hash=_visitor_hash(request))
        if made:
            record("seo", "visitor")
    except Exception:  # noqa: BLE001
        pass
    kind, name = referrer_of(referrer, request.get_host().split(":")[0])
    record("seo", "referral", f"{kind}:{name}")
    if kind == "search":  # a click from a search engine
        record("seo", "search_click", name)
        record("seo", "landing", path)
    elif kind == "ai":  # a click from an AI assistant
        record("seo", "ai_click", name)
        record("seo", "landing", path)
    if lang:
        record("seo", "language", str(lang)[:5])


def record_bot(request, path, ua=None):
    """A program (search engine, AI crawler, tool) asked for a page or a file."""
    found = bot_of(ua if ua is not None else request.META.get("HTTP_USER_AGENT", ""))
    if not found:
        return False
    record("seo", "bot_visit", f"{found[1]}:{found[0]}")
    record("seo", f"bot_{found[1]}")
    if path:
        record("seo", "bot_page", str(path)[:200])
    return True


# ── reading ──
def _days(n):
    n = max(1, min(int(n or 30), 365))
    end = today()
    return [end - timedelta(days=i) for i in range(n - 1, -1, -1)]


def series(source, event, days=30, key=None):
    """[{x: "2026-10-01", y: 12}] for every day of the period (zeros included)."""
    ds = _days(days)
    qs = StatDay.objects.filter(source=source, event=event, day__gte=ds[0], day__lte=ds[-1])
    if key is not None:
        qs = qs.filter(key=key)
    got = dict(qs.values_list("day").annotate(n=Sum("count")))
    return [{"x": d.isoformat(), "y": int(got.get(d, 0))} for d in ds]


def total(source, event, days=30, key=None):
    ds = _days(days)
    qs = StatDay.objects.filter(source=source, event=event, day__gte=ds[0], day__lte=ds[-1])
    if key is not None:
        qs = qs.filter(key=key)
    return int(qs.aggregate(n=Sum("count"))["n"] or 0)


def top(source, event, days=30, limit=10, prefix=None):
    """[{label, value}] the keys with the highest counts."""
    ds = _days(days)
    qs = StatDay.objects.filter(source=source, event=event, day__gte=ds[0], day__lte=ds[-1])
    if prefix:
        qs = qs.filter(key__startswith=prefix)
    rows = qs.values("key").annotate(n=Sum("count")).order_by("-n")[:limit]
    cut = len(prefix) if prefix else 0
    return [{"label": r["key"][cut:] or "—", "value": int(r["n"])} for r in rows]


def record_file(request, event):
    """robots.txt, sitemap.xml or llms.txt was asked for: by which program (or by a person)."""
    found = bot_of(request.META.get("HTTP_USER_AGENT", ""))
    record("seo", event, f"{found[1]}:{found[0]}" if found else "mens")
    if found:
        record("seo", "bot_visit", f"{found[1]}:{found[0]}")
        record("seo", f"bot_{found[1]}")

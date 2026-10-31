# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""One place to call Claude through the Anthropic link (Admin -> API keys): used by the donation texts and the fake-users tool."""

"""Monitoring of every call to the AI (see ai.py): who asked, from where, how many tokens, how long and what it cost, with the margin of the superadmin on top."""
import contextvars
import sys
import time
from datetime import timedelta
from decimal import Decimal

_request = contextvars.ContextVar("ai_request", default=None)  # the request that is being handled (the middleware sets it)
_actor = contextvars.ContextVar("ai_actor", default=None)  # a user id that was set by hand (work in the background)

PROVIDERS = [("anthropic", "Claude"), ("openai", "OpenAI"), ("gemini", "Gemini")]
# Purchase prices per million tokens in USD, per part of the model name (the longest part that is in the name wins). These are estimates: check them with the price list of the supplier.
CATALOG = {
    "anthropic": {"haiku": {"in": 1, "out": 5}, "sonnet": {"in": 3, "out": 15}, "opus": {"in": 15, "out": 75}},
    "openai": {"gpt-4o-mini": {"in": 0.15, "out": 0.6}, "gpt-4o": {"in": 2.5, "out": 10}, "gpt-4.1-nano": {"in": 0.1, "out": 0.4}, "gpt-4.1-mini": {"in": 0.4, "out": 1.6}, "gpt-4.1": {"in": 2, "out": 8},
               "gpt-5-nano": {"in": 0.05, "out": 0.4}, "gpt-5-mini": {"in": 0.25, "out": 2}, "gpt-5": {"in": 1.25, "out": 10}, "o4-mini": {"in": 1.1, "out": 4.4}, "o3-mini": {"in": 1.1, "out": 4.4}, "o3": {"in": 2, "out": 8}},
    "gemini": {"gemini-2.5-flash-lite": {"in": 0.1, "out": 0.4}, "gemini-2.5-flash": {"in": 0.3, "out": 2.5}, "gemini-2.5-pro": {"in": 1.25, "out": 10}, "gemini-2.0-flash-lite": {"in": 0.075, "out": 0.3}, "gemini-2.0-flash": {"in": 0.1, "out": 0.4}},
}
DEFAULT_PRICES = CATALOG["anthropic"]
SOURCES = [  # the first part of the module that asked, and how the superadmin reads it
    ("siteimport_lib", "Site importeren"), ("apps.pages", "Pagina's en teksten"), ("apps.faq", "FAQ en help vertalen"), ("apps.core.pricing", "Prijzen"), ("apps.core.marketing", "Marketing"),
    ("apps.core.resources", "Thema's en bibliotheek"), ("apps.core.views", "Vormgeving en thema's"), ("apps.accounts.fakeusers", "Testgebruikers"), ("apps.plugins", "Plugins"),
    ("plugin_translate", "Plugins vertalen"), ("apps.integrations", "AI-instellingen (koers en prijzen)"), ("django.core.management", "Beheeropdracht (terminal)"), ("apps.core", "Systeem"),
]
SYMBOL = {"EUR": "€", "USD": "$", "GBP": "£"}
GROUP_NAMES = {"user": "Gebruikers", "admin": "Admins", "super": "Superadmins", "system": "Systeem (zonder inlog)", "site": "Website"}
_names = {"t": 0, "v": None}


def group_names():
    """The names of the groups; the group "site" has the name of the website (the costs of superadmins and the system, when they are for the account of the customer)."""
    if time.time() - _names["t"] > 30 or _names["v"] is None:
        try:
            from apps.core import system

            site = (system.site_name() or "").strip()
        except Exception:  # noqa: BLE001
            site = ""
        _names.update(t=time.time(), v={**GROUP_NAMES, "site": site or GROUP_NAMES["site"]})
    return _names["v"]


class NoCredit(ValueError):
    """The user has no AI credit left (and credit is required)."""


def tenant():
    from .models import AiTenant

    return AiTenant.objects.first() or AiTenant.objects.create()


def tenant_links():
    """The own AI link and the own Stripe link of an admin: enabled, with a key, and NOT marked as a superadmin link. (None, None) when they are not there."""
    from .models import Integration

    a = Integration.objects.filter(provider="anthropic", enabled=True, superadmin_only=False).order_by("id").first()
    s = Integration.objects.filter(provider="stripe", enabled=True, superadmin_only=False).order_by("id").first()
    return (a if a and (a.config.get("api_key") or "").strip() else None), (s if s and (s.config.get("secret_key") or "").strip() else None)


def tenant_active():
    if not tenant().enabled:
        return False
    a, s = tenant_links()
    return bool(a and s)


def uses_tenant(user):
    """Do this person's AI calls and payments run on the own links of the admin? Users and admins do, when that system is on; superadmins never."""
    return user is not None and group_of(user) in ("user", "admin") and tenant_active()


class Cfg:
    """The credit settings that count for one person: those of the admin's own system or those of the superadmin."""

    def __init__(self, st, user):
        t = tenant() if uses_tenant(user) else None
        src = t or st
        self.tenant = t is not None
        self.credit_required = bool(src.credit_required)
        self.topup_min, self.topup_max, self.topup_step = src.topup_min, src.topup_max, src.topup_step
        self.margins = (float(t.margin_in), float(t.margin_out)) if t else None
        self.currency = st.currency


def subject(user):
    """Who must have bought credit: users and admins (not superadmins and not the system); in the own system of an admin only his users."""
    if user is None:
        return False
    g = group_of(user)
    return g == "user" if uses_tenant(user) else g in ("user", "admin")


def estimate(settings, model, texts, max_tokens, images=0, group="user", margins=None):
    """What an AI call will cost the user, estimated before it is made: the tokens in from the length of the texts (and pictures), the tokens out from half of what may be asked."""
    tin = int(sum(len(str(t or "")) for t in texts) / 3.5) + 1500 * int(images or 0) + 20
    tout = int(max(50, int(max_tokens or 1000) * 0.5))
    return cost_of(settings, model, tin, tout, provider_of(model), group, True, margins)[1], tin, tout


def gate(model="", texts=(), max_tokens=1000, images=0):
    """Called before every AI call, by whoever asks: when credit is required, a user (or admin) first needs enough credit for THIS call (estimated beforehand). If not, nothing is sent to the AI."""
    from .models import AiAccount, AiSettings

    st = AiSettings.load()
    user = current_user()
    cfg = Cfg(st, user)
    if not cfg.credit_required or not subject(user):
        return
    acc = AiAccount.objects.filter(user=user).first()
    bal = float(acc.balance) if acc else 0.0
    need, _, _ = estimate(st, model, texts, max_tokens, images, group_of(user), cfg.margins)
    sym = SYMBOL.get(st.currency, st.currency + " ")
    if bal <= 0:
        raise NoCredit("Je hebt nog geen AI-tegoed (of het is op). Koop eerst tegoed bij Dashboard → AI voordat je AI kunt gebruiken.")
    if bal < need:
        raise NoCredit(f"Je AI-tegoed ({sym}{bal:.2f}) is niet genoeg voor deze opdracht (geschat {sym}{need:.2f}). Koop meer tegoed bij Dashboard → AI.")


def credit(user, amount, kind, note="", ref="", by=""):
    """Put money on (or take it from) the credit of a user: one line in the ledger. Returns the new balance."""
    from django.db import transaction

    from .models import AiAccount, AiLedger

    with transaction.atomic():
        acc, _ = AiAccount.objects.get_or_create(user=user)
        acc = AiAccount.objects.select_for_update().get(pk=acc.pk)
        acc.balance = acc.balance + Decimal(str(amount))
        acc.save(update_fields=["balance", "updated_at"])
        AiLedger.objects.create(user=user, kind=kind, amount=Decimal(str(amount)), balance_after=acc.balance, note=note[:200], payment_ref=ref[:40], by=by[:254])
    return acc.balance


def pay_link(user=None):
    """How AI credit is paid: always through an Easy2edit link of the superadmin, never the Stripe of the website's own shop. Returns {"key", "name", "via"} (via: "link" = a Stripe link that
    is marked as a superadmin link, "license" = the Stripe account of the licence) or None."""
    from .models import Integration

    try:  # in the sandbox payments are simulated: never a real payment (also not on your own computer with live keys)
        from apps.sandbox import service as sandbox

        if sandbox.active("payments"):
            return None
    except Exception:  # noqa: BLE001
        pass
    if uses_tenant(user):  # the own system of an admin: paid through his own Stripe link
        _, s = tenant_links()
        k = (s.config.get("secret_key") or "").strip()
        return {"key": k, "name": s.name, "via": "tenant", "mode": "test" if k.startswith(("sk_test", "rk_test")) else "live"}
    i = Integration.objects.filter(provider="stripe", enabled=True, superadmin_only=True).order_by("id").first()
    key = (i.config.get("secret_key") or "").strip() if i else ""
    if key:
        return {"key": key, "name": i.name, "via": "link", "mode": "test" if key.startswith(("sk_test", "rk_test")) else "live"}
    try:
        from apps.core import license_stripe

        if license_stripe.active():
            k = license_stripe.config().get("secret_key") or ""
            return {"key": k, "name": "Licentie", "via": "license", "mode": "test" if k.startswith(("sk_test", "rk_test")) else "live"}
    except Exception:  # noqa: BLE001
        pass
    return None


def reconcile(user):
    """Open purchases of this user at Stripe that were paid but not yet booked (someone closed the page before coming back): checked now, so the credit always arrives."""
    from django.utils import timezone as tz

    from .models import AiTopup

    link = pay_link(user)
    if not link:
        return 0
    from apps.core import license_stripe

    n = 0
    for t in AiTopup.objects.filter(user=user, status="open", via="stripe", created_at__gte=tz.now() - timedelta(days=3)).exclude(session_id="")[:5]:
        try:
            paid, _ = license_stripe.session_paid(t.session_id, key=link["key"])
        except Exception:  # noqa: BLE001
            continue
        if paid and settle_topup(t.payment_ref, True, "Stripe"):
            n += 1
    return n


def settle_topup(ref, paid, via=""):
    """A purchase of credit is paid (or failed): the credit is added to the credit of the user, once (a repeated message from the payment does nothing). Returns the topup or None."""
    from django.db import transaction

    from .models import AiTopup

    with transaction.atomic():
        t = AiTopup.objects.select_for_update().filter(payment_ref=ref, status="open").first()
        if not t:
            return None
        t.status = "paid" if paid else "failed"
        t.save(update_fields=["status"])
        if paid:
            credit(t.user, t.amount, "topup", "Tegoed gekocht" + (f" ({via})" if via else ""), ref)
        return t


def payment_changed(payment):
    """A payment of the payment engine changed (the sandbox calls this): a paid purchase of AI credit is added to the credit of the user."""
    if payment.status in ("paid", "failed", "canceled", "expired"):
        settle_topup(payment.ref, payment.status == "paid", "betaling")


def proposal(settings, user):  # settings: the superadmin's; the own system of an admin counts for his users
    """What to offer when someone buys credit: the slider (minimum, maximum, step) and a suggestion, from what this user used in the last 30 days."""
    from django.db.models import Sum
    from django.utils import timezone as tz

    from .models import AiUsage

    used = float(AiUsage.objects.filter(user=user, billable=True, created_at__gte=tz.now() - timedelta(days=30)).aggregate(v=Sum("charged"))["v"] or 0)
    cfg = Cfg(settings, user)
    lo, hi, step = float(cfg.topup_min), float(cfg.topup_max), max(float(cfg.topup_step), 0.5)
    top = 25 if used <= 20 else 50 if used <= 60 else 100  # the slider ends higher for someone who uses more
    top = max(lo + step, min(hi, float(top)))
    suggest = min(top, max(lo, -(-used * 1.25 // step) * step))
    return {"min": lo, "max": top, "step": step, "suggest": suggest, "used_month": round(used, 2)}


def set_request(req):
    return _request.set(req)


def clear_request(token):
    _request.reset(token)


def run_as(user_id, fn, *a, **kw):
    """Run fn (work in the background, a thread) so that its AI calls are counted for this user."""
    token = _actor.set(user_id)
    try:
        return fn(*a, **kw)
    finally:
        _actor.reset(token)


def current_user():
    """The user for whom an AI call is made now, or None."""
    from apps.accounts.models import User

    uid = _actor.get()
    if uid:
        return User.objects.filter(pk=uid).first()
    req = _request.get()
    u = getattr(req, "user", None) if req is not None else None
    return u if u is not None and getattr(u, "is_authenticated", False) else None


def current_user_id():
    u = current_user()
    return u.pk if u else None


def group_of(user):
    """gebruiker / admin / superadmin: a superadmin is_staff; an admin has rights in the admin area (roles); the rest are users."""
    if user is None:
        return "system"
    if user.is_staff or user.is_superuser:
        return "super"
    try:
        return "admin" if user.permission_keys() else "user"
    except Exception:  # noqa: BLE001
        return "user"


def source_name(module):
    for prefix, name in SOURCES:
        if module == prefix or module.startswith(prefix + ".") or module.startswith(prefix):
            return name
    return module[:80]


def where():
    """Which part of the system asked: the first piece of code outside the AI helpers."""
    f = sys._getframe(2)
    while f:
        mod = f.f_globals.get("__name__", "")
        if not (mod in ("apps.integrations.ai", "apps.integrations.aiusage") or mod.endswith("themeimport") or mod.startswith(("rest_framework", "django.views", "django.core.handlers", "django.utils", "functools", "threading", "concurrent"))):
            return source_name(mod), mod
        f = f.f_back
    return "Onbekend", ""


def provider_of(model):
    m = (model or "").lower()
    return "gemini" if "gemini" in m else "openai" if m.startswith(("gpt", "o1", "o3", "o4", "chatgpt")) else "anthropic"


def own_prices(settings):
    """The prices the superadmin changed, per provider: {"anthropic": {"sonnet": {"in", "out"}}, ...} (an older flat list belongs to Claude)."""
    pr = settings.prices or {}
    return pr if any(k in pr for k, _ in PROVIDERS) else ({"anthropic": pr} if pr else {})


def table_for(settings, provider):
    return {**CATALOG.get(provider, {}), **own_prices(settings).get(provider, {})}


def price_of(settings, provider, model):
    """(in, out, where the price comes from: "eigen" when changed, "standaard" or "geen") for a model; the longest part of the name that matches wins."""
    own, default = own_prices(settings).get(provider, {}), CATALOG.get(provider, {})
    name = (model or "").lower()
    hits = sorted((k for k in {**default, **own} if k and k in name), key=len, reverse=True)
    if not hits:
        return 0.0, 0.0, "geen"
    k = hits[0]
    p = own.get(k) or default.get(k)
    return float(p.get("in") or 0), float(p.get("out") or 0), "eigen" if k in own else "standaard"


def prices_for(settings, model, provider=None):
    pin, pout, _ = price_of(settings, provider or provider_of(model), model)
    return pin, pout


def margins_of(settings, group):
    """(margin in %, margin out %) of a group: users, admins and the reseller (= superadmin; also the group of the site and the system); an older setting is the default."""
    key = "user" if group == "user" else "admin" if group == "admin" else "super"
    m = (settings.margins or {}).get(key) or {}
    return float(m.get("in", settings.margin_in) or 0), float(m.get("out", settings.margin_out) or 0)


def cost_of(settings, model, tin, tout, provider=None, group="user", billable=True, margins=None):
    """(what it costs us in the purchase currency, what is charged in the selling currency: with the margin and at the rate)."""
    pin, pout = prices_for(settings, model, provider)
    base_in, base_out = tin / 1e6 * pin, tout / 1e6 * pout
    mi, mo = (margins or margins_of(settings, group)) if billable else (0.0, 0.0)  # a cost of the reseller himself has no margin
    rate = float(settings.rate or 1) if settings.cost_currency != settings.currency else 1.0
    return base_in + base_out, (base_in * (1 + mi / 100) + base_out * (1 + mo / 100)) * rate


def record(model, usage, started, ok=True, error="", web=False, images=0, system="", provider=None):
    """Write one row. Never raises: monitoring may never break an AI call."""
    try:
        from .models import AiSettings, AiUsage

        user = current_user()
        name, mod = where()
        tin, tout = int((usage or {}).get("input_tokens") or 0), int((usage or {}).get("output_tokens") or 0)
        st = AiSettings.load()
        provider = provider or provider_of(model)
        grp, billable, owner, margins = group_of(user), True, "system", None
        cfg = Cfg(st, user)
        if cfg.tenant:  # the own system of an admin: his AI link, his Stripe, his margin; not a cost or a revenue of the reseller
            owner, margins = "tenant", cfg.margins
        elif grp in ("super", "system"):  # of the reseller or the system: for the customer when the switch is on (booked on the group of the site), else a cost of the reseller
            if st.bill_internal:
                grp = "site"
            else:
                billable = False
        cost, charged = cost_of(st, model, tin, tout, provider, grp, billable, margins)
        row = AiUsage.objects.create(user=user, user_label=(user.email if user else "")[:254], group=grp, billable=billable, owner=owner, source=name, purpose=" ".join(str(system or "").split()[:6])[:80], provider=provider, model=(model or "")[:60],
                               tokens_in=tin, tokens_out=tout, duration_ms=int((time.time() - started) * 1000), ok=ok, error=str(error)[:120], web=bool(web), images=int(images or 0),
                               cost=Decimal(str(round(cost, 6))), rate=(st.rate if st.cost_currency != st.currency else 1), charged=Decimal(str(round(charged, 6))))
        if cfg.credit_required and billable and subject(user) and charged > 0:
            credit(user, -Decimal(str(round(charged, 6))), "usage", row.source)  # the use is paid from the credit
    except Exception:  # noqa: BLE001
        import logging

        logging.getLogger(__name__).exception("AI use could not be recorded")


def since(period):
    now = time.time()
    from django.utils import timezone

    t = timezone.now()
    return {"day": t - timedelta(days=1), "week": t - timedelta(days=7), "month": t - timedelta(days=30), "quarter": t - timedelta(days=90), "year": t - timedelta(days=365)}.get(period, t - timedelta(days=30))

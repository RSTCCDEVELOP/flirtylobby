import logging
from decimal import Decimal, InvalidOperation

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import has_level, has_level_any, has_level_for
from apps.core.modules import module_required
from apps.shop.service import unique_slug

from . import service
from .models import INTERVALS, Donation, DonationCampaign, Plan, Subscription

logger = logging.getLogger(__name__)
bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731
ADMIN_SUBS = [has_level_for("subscriptions", {"list": "use", "retrieve": "use", "destroy": "manage"}, default="edit"), module_required("subscriptions")]
ADMIN_DON = [has_level_for("donations", {"list": "use", "retrieve": "use", "destroy": "manage"}, default="edit"), module_required("donations")]


# ── serializers ──────────────────────────────────────────────────────────────
class PlanSerializer(serializers.ModelSerializer):
    subscribers = serializers.SerializerMethodField()
    grants_text = serializers.SerializerMethodField()
    recurring = serializers.BooleanField(read_only=True)

    class Meta:
        model = Plan
        fields = ["id", "slug", "name", "description", "price", "vat_rate", "interval", "duration_days", "trial_days", "grants", "grants_text", "highlight", "active", "order", "recurring", "subscribers"]
        read_only_fields = ["slug"]

    def get_subscribers(self, p):
        return p.subscriptions.filter(status__in=service.LIVE).count()

    def get_grants_text(self, p):
        return service.describe(p.grants)

    def validate_grants(self, v):
        try:
            return service.clean_grants(v)
        except ValueError as e:
            raise serializers.ValidationError(str(e))

    def validate(self, d):
        if d.get("price") is not None and d["price"] < 0:
            raise serializers.ValidationError({"price": "Een prijs kan niet negatief zijn."})
        return d

    def create(self, data):
        data["slug"] = unique_slug(Plan, data["name"])
        return super().create(data)


class CampaignSerializer(serializers.ModelSerializer):
    raised = serializers.SerializerMethodField()
    count = serializers.SerializerMethodField()
    grants_text = serializers.SerializerMethodField()

    class Meta:
        model = DonationCampaign
        fields = ["id", "slug", "name", "description", "recipient", "recipient_user", "min_amount", "max_amount", "step", "default_amount", "goal", "allow_message",
                  "allow_anonymous", "grants", "grants_text", "grant_days", "min_for_grants", "active", "order", "raised", "count"]
        read_only_fields = ["slug"]

    def get_raised(self, c):
        return str(service.raised(c)["total"])

    def get_count(self, c):
        return service.raised(c)["count"]

    def get_grants_text(self, c):
        return service.describe(c.grants)

    def validate_grants(self, v):
        try:
            return service.clean_grants(v)
        except ValueError as e:
            raise serializers.ValidationError(str(e))

    def validate(self, d):
        g = lambda k: d.get(k, getattr(self.instance, k, None))  # noqa: E731
        if g("min_amount") <= 0 or g("max_amount") < g("min_amount"):
            raise serializers.ValidationError({"max_amount": "Het maximum moet gelijk of hoger zijn dan het minimum (en het minimum meer dan 0)."})
        if g("step") <= 0:
            raise serializers.ValidationError({"step": "De stap moet groter zijn dan 0."})
        if not g("min_amount") <= g("default_amount") <= g("max_amount"):
            raise serializers.ValidationError({"default_amount": "Het standaardbedrag moet tussen minimum en maximum liggen."})
        return d

    def create(self, data):
        data["slug"] = unique_slug(DonationCampaign, data["name"])
        return super().create(data)


def _sub_row(s, with_user=False):
    now = timezone.now()
    row = {"id": s.id, "plan": s.plan_id, "plan_name": s.plan.name, "interval": s.plan.interval, "recurring": s.plan.recurring, "status": s.status,
           "status_label": s.get_status_display(), "price": str(s.price), "started_at": s.started_at, "period_end": s.period_end, "cancel_at_period_end": s.cancel_at_period_end,
           "periods": s.periods, "manual": s.manual, "days_left": max(0, (s.period_end - now).days) if s.period_end else None}
    open_o = service.open_orders(s).order_by("-id").first()
    row["open_order"] = {"number": open_o.number, "total": str(open_o.total)} if open_o else None
    if with_user:
        row["user"] = {"id": s.user_id, "name": s.user.get_full_name() or s.user.username, "email": s.user.email}
    return row


# ── admin: subscriptions ─────────────────────────────────────────────────────
class PlanViewSet(viewsets.ModelViewSet):
    queryset = Plan.objects.all()
    serializer_class = PlanSerializer
    permission_classes = ADMIN_SUBS

    def destroy(self, request, *args, **kwargs):
        p = self.get_object()
        if p.subscriptions.exists():
            return bad("Er zijn abonnementen op dit plan. Zet het uit (niet meer te koop) in plaats van het te verwijderen.")
        return super().destroy(request, *args, **kwargs)


class SubscriptionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = ADMIN_SUBS

    def get_queryset(self):
        qs = Subscription.objects.select_related("plan", "user")
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("plan"):
            qs = qs.filter(plan_id=p["plan"])
        if q := p.get("q"):
            qs = qs.filter(Q(user__email__icontains=q) | Q(user__username__icontains=q) | Q(user__first_name__icontains=q) | Q(user__last_name__icontains=q))
        return qs

    def list(self, request, *args, **kwargs):
        return Response([_sub_row(s, True) for s in self.get_queryset()[:300]])

    def retrieve(self, request, *args, **kwargs):
        return Response(_sub_row(self.get_object(), True))

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        s = service.cancel(self.get_object(), now_=bool(request.data.get("now")))
        return Response(_sub_row(s, True))

    @action(detail=True, methods=["post"])
    def extend(self, request, pk=None):
        """Give extra days (a gift, or after a complaint)."""
        s = self.get_object()
        try:
            days = max(1, min(3650, int(request.data.get("days"))))
        except (TypeError, ValueError):
            return bad("Geef het aantal dagen op.")
        from datetime import timedelta

        base = s.period_end if s.period_end and s.period_end > timezone.now() else timezone.now()
        s.period_end = base + timedelta(days=days)
        if s.status in ("expired", "past_due", "pending"):
            s.status = "active"
        s.started_at = s.started_at or timezone.now()
        s.save()
        return Response(_sub_row(s, True))


@api_view(["POST"])
@permission_classes([has_level("subscriptions", "manage"), module_required("subscriptions")])
def give(request):
    """Give a member a plan without an order (manual / free)."""
    from django.contrib.auth import get_user_model
    from datetime import timedelta

    user = get_user_model().objects.filter(email__iexact=str(request.data.get("email") or "").strip()).first()
    plan = Plan.objects.filter(pk=request.data.get("plan")).first()
    if not user or not plan:
        return bad("Geen lid gevonden met dit e-mailadres, of het abonnement bestaat niet.")
    try:
        days = int(request.data.get("days") or 0)
    except (TypeError, ValueError):
        return bad("Geef het aantal dagen als getal op.")
    now = timezone.now()
    s = Subscription.objects.create(user=user, plan=plan, price=0, manual=True, status="active", started_at=now, period_start=now,
                                    period_end=now + timedelta(days=days) if days else None, periods=1)
    logger.info("Subscription %s given to %s by %s", s.pk, user.pk, request.user.email)
    return Response(_sub_row(s, True), status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT"])
@permission_classes([has_level_for("subscriptions", {"GET": "use"}, default="manage"), module_required("subscriptions")])
def settings_admin(request):
    if request.method == "PUT":
        try:
            service.save_settings(request.data)
        except ValueError as e:
            return bad(str(e))
    return Response(service.settings())


def _either_module():
    """The donation screens use the same option lists, so one of the two modules being on is enough."""
    from rest_framework.permissions import BasePermission

    class _Either(BasePermission):
        message = "Deze module is uitgeschakeld."

        def has_permission(self, request, view):
            from apps.core import modules

            return modules.enabled("subscriptions") or modules.enabled("donations")

    return _Either


@api_view(["GET"])
@permission_classes([has_level_any(("subscriptions", "use"), ("donations", "use")), _either_module()])
def options(request):
    from apps.pages.models import Page
    from apps.shop.models import Product

    return Response({
        "grant_types": [{"type": k, "label": v["label"], "ref": v["ref"], "value": bool(v.get("value")), "help": v["help"]} for k, v in service.GRANT_TYPES.items()],
        "pages": [{"key": p.key, "title": p.title.get("nl") or next(iter(p.title.values()), p.key)} for p in Page.objects.filter(kind="content")],
        "products": [{"id": p.id, "name": p.name} for p in Product.objects.filter(active=True)],
        "intervals": [{"value": v, "label": l} for v, l in INTERVALS],
        "currency": __import__("apps.shop.service", fromlist=["settings"]).settings()["currency"],
    })


@api_view(["GET"])
@permission_classes([has_level("subscriptions", "use"), module_required("subscriptions")])
def stats(request):
    live = Subscription.objects.filter(status__in=("trial", "active", "past_due", "canceled"))
    mrr = Decimal("0")
    months = {"week": Decimal("4.345"), "month": Decimal(1), "quarter": Decimal(1) / 3, "year": Decimal(1) / 12}
    for s in live.exclude(plan__interval="once").select_related("plan"):
        mrr += s.price * months[s.plan.interval]
    return Response({"active": live.count(), "pending": Subscription.objects.filter(status="pending").count(), "past_due": Subscription.objects.filter(status="past_due").count(),
                     "mrr": str(service.money(mrr)), "plans": Plan.objects.filter(active=True).count()})


# ── admin: donations ─────────────────────────────────────────────────────────
class CampaignViewSet(viewsets.ModelViewSet):
    queryset = DonationCampaign.objects.all()
    serializer_class = CampaignSerializer
    permission_classes = ADMIN_DON

    def destroy(self, request, *args, **kwargs):
        if self.get_object().donations.exists():
            return bad("Er zijn donaties voor deze actie. Zet de actie uit in plaats van hem te verwijderen.")
        return super().destroy(request, *args, **kwargs)


@api_view(["GET"])
@permission_classes([has_level("donations", "use"), module_required("donations")])
def donations_admin(request):
    qs = Donation.objects.select_related("campaign", "user")
    p = request.query_params
    if p.get("campaign"):
        qs = qs.filter(campaign_id=p["campaign"])
    if p.get("status"):
        qs = qs.filter(status=p["status"])
    paid = Donation.objects.filter(status="paid")
    agg = paid.aggregate(total=Sum("amount"), n=Count("id"))
    return Response({
        "total": str(agg["total"] or 0), "count": agg["n"],
        "items": [{"id": d.id, "campaign": d.campaign.name, "amount": str(d.amount), "status": d.status, "status_label": d.get_status_display(), "name": d.name or "-", "email": d.email,
                   "message": d.message, "anonymous": d.anonymous, "user": d.user_id, "created_at": d.created_at, "paid_at": d.paid_at} for d in qs[:300]]})


# ── public ───────────────────────────────────────────────────────────────────
def _plan_public(p, mine):
    return {"id": p.id, "slug": p.slug, "name": p.name, "description": p.description, "price": str(p.price), "interval": p.interval, "interval_label": service.interval_label(p),
            "recurring": p.recurring, "duration_days": p.duration_days, "trial_days": p.trial_days, "highlight": p.highlight, "grants": service.describe(p.grants),
            "mine": mine.get(p.id)}


@api_view(["GET"])
@permission_classes([AllowAny, module_required("subscriptions")])
def plans_public(request):
    mine = {}
    if request.user.is_authenticated:
        for s in Subscription.objects.filter(user=request.user, status__in=("pending", *service.LIVE)):
            mine[s.plan_id] = s.status
    cfg = service.settings()
    return Response({"plans": [_plan_public(p, mine) for p in Plan.objects.filter(active=True)], "intro": cfg["intro"], "site_message": cfg["site_message"], "site_gate": cfg["gates"]["site"],
                     "currency": __import__("apps.shop.service", fromlist=["settings"]).settings()["currency"]})


@api_view(["POST"])
@permission_classes([IsAuthenticated, module_required("subscriptions")])
def subscribe(request):
    plan = Plan.objects.filter(pk=request.data.get("plan")).first()
    if not plan:
        return bad("Dit abonnement bestaat niet.", 404)
    try:
        sub, path = service.subscribe(request.user, plan, str(request.data.get("return_base") or ""))
    except service.SubError as e:
        return bad(str(e))
    except Exception as e:  # noqa: BLE001  e.g. payments not linked
        return bad(str(e), 503)
    return Response({"subscription": _sub_row(sub), "checkout_path": path}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """The member's subscriptions and what they give. Also settles repeats that are due."""
    on = service.modules.enabled("subscriptions")
    if on:
        service.process_due(request.user)
    ent = service.entitlements(request.user)
    gates = service.settings()["gates"] if on else {}
    return Response({
        "enabled": on,
        "subscriptions": [_sub_row(s) for s in Subscription.objects.filter(user=request.user).select_related("plan").exclude(status__in=("expired",) if False else ())][:50] if on else [],
        "entitlements": {k: (sorted(v) if isinstance(v, set) else v) for k, v in ent.items()},
        "gates": gates, "site_locked": bool(on and gates.get("site") and not ent["site"]), "locked_pages": sorted(service.locked_pages()) if on else [],
        "likes_left": service.likes_left(request.user) if on else None,
        "donations": request.user.donations.filter(status="paid").count() if service.modules.enabled("donations") else 0})


@api_view(["POST"])
@permission_classes([IsAuthenticated, module_required("subscriptions")])
def me_action(request, pk, act):
    sub = Subscription.objects.filter(pk=pk, user=request.user).select_related("plan").first()
    if not sub:
        return bad("Niet gevonden.", 404)
    if act == "cancel":
        service.cancel(sub)
    elif act == "resume":
        service.resume(sub)
    elif act == "pay":
        try:
            path, order = service.pay_open(sub, str(request.data.get("return_base") or ""))
        except service.SubError as e:
            return bad(str(e))
        sub.refresh_from_db()
        return Response({"subscription": _sub_row(sub), "checkout_path": path})
    else:
        return bad("Onbekende actie.")
    sub.refresh_from_db()
    return Response({"subscription": _sub_row(sub)})


@api_view(["GET"])
@permission_classes([AllowAny])
def access(request):
    """Does the visitor have access to a page or a piece of content? (used by the Paywall component)"""
    if not service.modules.enabled("subscriptions"):
        return Response({"ok": True})
    ent = service.entitlements(request.user)
    page, content = request.query_params.get("page"), request.query_params.get("content")
    locked = service.locked_pages()
    if page:
        return Response({"ok": page not in locked or ent["full"] or page in ent["pages"], "locked": page in locked})
    if content:
        listed = any(g.get("type") == "content" and g.get("ref") == content for grants in Plan.objects.values_list("grants", flat=True) for g in grants or [])
        return Response({"ok": not listed or ent["full"] or content in ent["content"], "locked": listed})
    return bad("Geef een pagina of content op.")


def _campaign_public(c, detail=False):
    r = service.raised(c)
    out = {"id": c.id, "slug": c.slug, "name": c.name, "description": c.description, "recipient": c.recipient or "de makers", "min": str(c.min_amount), "max": str(c.max_amount),
           "step": str(c.step), "default": str(c.default_amount), "goal": str(c.goal) if c.goal else None, "raised": str(r["total"]), "count": r["count"],
           "allow_message": c.allow_message, "allow_anonymous": c.allow_anonymous, "grants": service.describe(c.grants), "grant_days": c.grant_days,
           "min_for_grants": str(c.min_for_grants)}
    if detail:
        out["recent"] = [{"name": "Anoniem" if d.anonymous else (d.name or "Iemand"), "amount": str(d.amount), "message": d.message, "at": d.paid_at}
                         for d in c.donations.filter(status="paid").order_by("-paid_at")[:8]]
    return out


@api_view(["GET"])
@permission_classes([AllowAny, module_required("donations")])
def campaigns_public(request):
    return Response({"campaigns": [_campaign_public(c, True) for c in DonationCampaign.objects.filter(active=True)],
                     "currency": __import__("apps.shop.service", fromlist=["settings"]).settings()["currency"]})


@api_view(["POST"])
@permission_classes([AllowAny, module_required("donations")])
def donate(request):
    c = DonationCampaign.objects.filter(pk=request.data.get("campaign")).first()
    if not c:
        return bad("Deze actie bestaat niet.", 404)
    b = request.data
    try:
        amount = Decimal(str(b.get("amount")))
    except InvalidOperation:
        return bad("Ongeldig bedrag.")
    try:
        d, path = service.donate(c, amount, request.user if request.user.is_authenticated else None, str(b.get("name") or "")[:120], str(b.get("email") or "")[:254].strip(),
                                 str(b.get("message") or "")[:300], bool(b.get("anonymous")), str(b.get("return_base") or ""))
    except service.SubError as e:
        return bad(str(e))
    except Exception as e:  # noqa: BLE001
        return bad(str(e), 503)
    d.refresh_from_db()
    return Response({"status": d.status, "amount": str(d.amount), "checkout_path": path}, status=status.HTTP_201_CREATED)

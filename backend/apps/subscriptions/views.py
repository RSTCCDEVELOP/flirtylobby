import logging
import re
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
from .models import INTERVALS, ActionItem, Donation, DonationCampaign, Plan, Subscription

logger = logging.getLogger(__name__)
bad = lambda msg, code=status.HTTP_400_BAD_REQUEST: Response({"detail": msg}, status=code)  # noqa: E731
ADMIN_SUBS = [has_level_for("subscriptions", {"list": "use", "retrieve": "use", "destroy": "manage"}, default="edit"), module_required("subscriptions")]
ADMIN_DON = [has_level_for("donations", {"list": "use", "retrieve": "use", "destroy": "manage"}, default="edit"), module_required("donations")]


# ── per-language texts, button look ──────────────────────────────────────────
ICONS = ["none", "heart", "gift", "coffee", "star", "rocket", "smile", "card"]
VARIANTS = ["primary", "outline", "soft", "gradient"]


def lang_codes():
    from apps.core.models import Language

    return set(Language.objects.values_list("code", flat=True))


def clean_texts(raw, max_len):
    """{lang: text} for known languages only."""
    codes = lang_codes()
    if not isinstance(raw, dict):
        return {}
    return {k: str(v).strip()[:max_len] for k, v in raw.items() if k in codes and str(v).strip()}


def clean_button(raw):
    import re

    b = raw if isinstance(raw, dict) else {}
    color = str(b.get("color") or "")
    return {"as_button": bool(b.get("as_button")), "labels": clean_texts(b.get("labels"), 40),
            "icon": b.get("icon") if b.get("icon") in ICONS else "heart", "variant": b.get("variant") if b.get("variant") in VARIANTS else "primary",
            "size": b.get("size") if b.get("size") in ("sm", "md", "lg") else "md", "radius": b.get("radius") if b.get("radius") in ("default", "pill", "square") else "default",
            "color": color if re.fullmatch(r"#[0-9a-fA-F]{6}", color) else ""}


def _dt(value):
    """'2026-12-31T23:59' (site time) or ISO with offset -> aware datetime string, or None."""
    from datetime import datetime

    from django.utils import timezone

    if not value:
        return None
    try:
        d = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if timezone.is_naive(d):
        d = timezone.make_aware(d)
    return d.isoformat()


def clean_actions(raw):
    """What a donor may use: type + choice (like a plan's grants), from/until moments, how many times (0 = unlimited), this login only, minimum amount."""
    from decimal import Decimal, InvalidOperation

    out = []
    for a in raw or []:
        try:
            g = service.clean_grants([{"type": a.get("type"), "ref": a.get("ref"), "value": a.get("value")}])
        except ValueError as e:
            raise serializers.ValidationError(str(e))
        if not g:
            continue
        frm, until = _dt(a.get("from")), _dt(a.get("until"))
        if frm and until and until <= frm:
            raise serializers.ValidationError("De einddatum moet na de begindatum liggen.")
        try:
            uses = max(0, min(100000, int(a.get("uses") or 0)))
            minimum = max(Decimal("0"), Decimal(str(a.get("min_amount") or 0)))
        except (ValueError, InvalidOperation):
            raise serializers.ValidationError("Aantal keer en minimumbedrag moeten getallen zijn.")
        valid_for = a.get("valid_for") if a.get("valid_for") in service.VALID_FOR else ""
        out.append({**g[0], "from": frm, "until": until, "valid_for": valid_for, "uses": uses, "session_only": bool(a.get("session_only")), "min_amount": str(minimum)})
    return out[:30]


def actions_local(actions):
    """The moments back as local time ('YYYY-MM-DDTHH:MM') for the form."""
    from datetime import datetime

    from django.utils import timezone

    def loc(s):
        return timezone.localtime(datetime.fromisoformat(s)).strftime("%Y-%m-%dT%H:%M") if s else ""

    return [{**a, "from": loc(a.get("from")), "until": loc(a.get("until"))} for a in actions or []]


def clean_popup(raw):
    """{titles, texts, media}: texts per known language, the picture must be an image of the media library."""
    from apps.medialib.models import MediaItem

    p = raw if isinstance(raw, dict) else {}
    media = p.get("media")
    if not (isinstance(media, int) and MediaItem.objects.filter(pk=media, kind="image").exists()):
        media = None
    pl = p.get("placement") if re.fullmatch(r"(left|center|right):(s|m|l|full|[1-9][0-9]{0,3}px|[1-9][0-9]{0,2}%)", str(p.get("placement") or "")) else "center:full"  # how the picture sits: align:size
    return {"titles": clean_texts(p.get("titles"), 120), "texts": clean_texts(p.get("texts"), 1500), "media": media, "placement": pl}


def popup_public(p):
    from django.core.files.storage import default_storage

    from apps.medialib.models import MediaItem

    p = p or {}
    item = MediaItem.objects.filter(pk=p.get("media")).first() if p.get("media") else None
    return {"titles": p.get("titles") or {}, "texts": p.get("texts") or {}, "image": default_storage.url(item.key) if item else None, "media": p.get("media"), "placement": p.get("placement") or "center:full"}


def _text(d, default):
    """Text for the default language, else any, else the fallback."""
    from apps.core.models import Language

    dl = Language.objects.filter(is_default=True).values_list("code", flat=True).first()
    return d.get(dl) or next(iter(d.values()), "") or default


# ── serializers ──────────────────────────────────────────────────────────────
class PlanSerializer(serializers.ModelSerializer):
    subscribers = serializers.SerializerMethodField()
    grants_text = serializers.SerializerMethodField()
    recurring = serializers.BooleanField(read_only=True)

    class Meta:
        model = Plan
        fields = ["id", "slug", "name", "description", "price", "vat_rate", "interval", "duration_days", "trial_days", "grants", "grants_text", "highlight", "active", "order", "recurring", "subscribers", "system_object", "button"]
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

    def validate_button(self, v):
        return clean_button(v)

    def validate(self, d):
        if d.get("price") is not None and d["price"] < 0:
            raise serializers.ValidationError({"price": "Een prijs kan niet negatief zijn."})
        return d

    def create(self, data):
        data["slug"] = unique_slug(Plan, data["name"])
        obj = super().create(data)
        __import__("apps.sysobjects.service", fromlist=["sync"]).sync()
        return obj

    def update(self, inst, data):
        obj = super().update(inst, data)
        __import__("apps.sysobjects.service", fromlist=["sync"]).sync()
        return obj


class CampaignSerializer(serializers.ModelSerializer):
    raised = serializers.SerializerMethodField()
    count = serializers.SerializerMethodField()
    grants_text = serializers.SerializerMethodField()

    class Meta:
        model = DonationCampaign
        fields = ["id", "slug", "name", "description", "recipient", "recipient_user", "min_amount", "max_amount", "step", "default_amount", "goal", "allow_message",
                  "allow_anonymous", "grants", "grants_text", "grant_days", "min_for_grants", "active", "order", "raised", "count", "names", "descriptions", "recipients", "button", "system_object", "info", "thanks", "actions"]
        read_only_fields = ["slug"]
        extra_kwargs = {"name": {"required": False, "allow_blank": True}}

    def to_representation(self, c):
        data = super().to_representation(c)
        data["actions"] = actions_local(data.get("actions"))
        for k in ("info", "thanks"):  # the picture's address, to show it in the form
            data[k] = {**(data.get(k) or {}), "image_url": popup_public(getattr(c, k)).get("image")}
        return data

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

    def validate_names(self, v):
        return clean_texts(v, 120)

    def validate_descriptions(self, v):
        return clean_texts(v, 1000)

    def validate_recipients(self, v):
        return clean_texts(v, 120)

    def validate_button(self, v):
        return clean_button(v)

    def validate_actions(self, v):
        return clean_actions(v)

    def validate_info(self, v):
        return clean_popup(v)

    def validate_thanks(self, v):
        return clean_popup(v)

    def validate(self, d):
        names = d.get("names", getattr(self.instance, "names", {}))
        if not (d.get("name") or "").strip():
            d["name"] = _text(names, getattr(self.instance, "name", "")) or ""
        if not d["name"]:
            raise serializers.ValidationError({"name": "Geef de actie een naam (in minstens één taal)."})
        if "descriptions" in d and not d.get("description"):
            d["description"] = _text(d["descriptions"], "")
        if "recipients" in d and not d.get("recipient"):
            d["recipient"] = _text(d["recipients"], "")
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
        obj = super().create(data)
        __import__("apps.sysobjects.service", fromlist=["sync"]).sync()
        return obj

    def update(self, inst, data):
        obj = super().update(inst, data)
        __import__("apps.sysobjects.service", fromlist=["sync"]).sync()
        return obj


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


def _settings_perm():
    from rest_framework.permissions import BasePermission

    class _P(BasePermission):
        message = "Je hebt hier geen rechten voor."

        def has_permission(self, request, view):
            from apps.accounts.access import level
            from apps.core import modules

            need = 1 if request.method == "GET" else 3
            return (modules.enabled("subscriptions") and level(request.user, "subscriptions") >= need) or (modules.enabled("donations") and level(request.user, "donations") >= need)

    return _P


@api_view(["GET", "PUT"])
@permission_classes([_settings_perm()])
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
    from apps.shop import catalog

    return Response({
        "grant_types": [{"type": k, "label": v["label"], "ref": v["ref"], "value": bool(v.get("value")), "help": v["help"], "themes": v.get("themes")} for k, v in service.GRANT_TYPES.items()], "theme": service.profile_theme(),
        "pages": [{"key": p.key, "title": p.title.get("nl") or next(iter(p.title.values()), p.key)} for p in Page.objects.filter(kind="content")],
        "products": catalog.active(),
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
        r = super().destroy(request, *args, **kwargs)
        __import__("apps.sysobjects.service", fromlist=["sync"]).sync()
        return r


def _claude(system, prompt, max_tokens=2500):
    """One call to Claude through the Anthropic link (see apps.integrations.ai)."""
    from apps.integrations import ai

    return ai.claude(system, prompt, max_tokens, 60)


@api_view(["POST"])
@permission_classes([has_level("donations", "edit"), module_required("donations")])
def campaign_ai(request):
    """'Genereer met AI': the prompt (the description field) becomes a complete donation action: texts in every language, amounts, button."""
    import json
    import re

    from apps.core.models import Language
    from apps.sandbox import service as sandbox

    prompt = str(request.data.get("prompt") or "").strip()[:2000]
    if len(prompt) < 5:
        return bad("Beschrijf eerst in het veld Omschrijving waar de donatie-actie over gaat.")
    langs = [l for l in Language.objects.filter(enabled=True).values("code", "name")] or [{"code": "nl", "name": "Nederlands"}]
    codes = [l["code"] for l in langs]
    if sandbox.active("integrations"):  # simulated: no call to Claude, but the form can be tried out
        words = prompt.split()
        title = " ".join(words[:4]).capitalize()
        out = {"names": {c: title for c in codes}, "descriptions": {c: prompt[:300] for c in codes}, "recipients": {c: "" for c in codes}, "min_amount": 2, "max_amount": 100,
               "step": 1, "default_amount": 10, "goal": 500, "allow_message": True, "allow_anonymous": True, "button_labels": {c: "Doneer" for c in codes}, "button_icon": "heart", "simulated": True}
    else:
        system = ("Je helpt bij het maken van een donatie-actie voor een website. Antwoord ALLEEN met één JSON-object, zonder uitleg of markdown. "
                  f"Talen (code: naam): {', '.join(f'{l['code']}: {l['name']}' for l in langs)}. Vertaal natuurlijk en kort, in de toon van de omschrijving. Velden: "
                  "names {taalcode: titel, max 60 tekens}, descriptions {taalcode: omschrijving, max 300 tekens}, recipients {taalcode: voor wie, bv. 'de makers'}, "
                  "button_labels {taalcode: knoptekst, max 20 tekens, bv. 'Doneer'}, button_icon (een van: heart, gift, coffee, star, rocket, smile, card), "
                  "min_amount, max_amount, step, default_amount, goal (getallen in euro, redelijk gekozen bij het doel; goal mag null zijn), allow_message en allow_anonymous (true/false).")
        cur = request.data.get("current")
        try:
            raw = _claude(system, f"Omschrijving van de actie:\n{prompt}" + (f"\n\nHuidige gegevens (verbeter of vul aan):\n{json.dumps(cur, ensure_ascii=False)[:1500]}" if cur else ""))
            m = re.search(r"\{.*\}", raw, re.S)
            out = json.loads(m.group(0)) if m else None
        except (ValueError, json.JSONDecodeError) as e:
            return bad(str(e) if isinstance(e, ValueError) and not isinstance(e, json.JSONDecodeError) else "Claude gaf een antwoord dat niet te lezen was. Probeer het nog eens.", 502)
        if not isinstance(out, dict):
            return bad("Claude gaf een antwoord dat niet te lezen was. Probeer het nog eens.", 502)

    def num(k, lo, hi, default):
        try:
            return max(lo, min(hi, round(float(out.get(k)), 2)))
        except (TypeError, ValueError):
            return default

    mn = num("min_amount", 0.5, 100000, 2)
    mx = max(mn, num("max_amount", 0.5, 100000, 100))
    step = num("step", 0.01, 10000, 1)
    res = {"names": clean_texts(out.get("names"), 120), "descriptions": clean_texts(out.get("descriptions"), 1000), "recipients": clean_texts(out.get("recipients"), 120),
           "min_amount": mn, "max_amount": mx, "step": step, "default_amount": min(max(num("default_amount", mn, mx, mn), mn), mx), "goal": (num("goal", 1, 10000000, 0) or None),
           "allow_message": bool(out.get("allow_message", True)), "allow_anonymous": bool(out.get("allow_anonymous", True)),
           "button": {"labels": clean_texts(out.get("button_labels"), 40), "icon": out.get("button_icon") if out.get("button_icon") in ICONS else "heart"}, "simulated": bool(out.get("simulated"))}
    return Response(res)


@api_view(["POST"])
@permission_classes([has_level("donations", "edit"), module_required("donations")])
def campaign_ai_text(request):
    """'Genereer met AI' for the info popup and the thank-you popup: a title and a text per language."""
    import json
    import re

    from apps.core.models import Language
    from apps.sandbox import service as sandbox

    section = request.data.get("section")
    if section not in ("info", "thanks"):
        return bad("Onbekend onderdeel.")
    ctx = request.data.get("context") or {}
    extra = str(request.data.get("prompt") or "").strip()[:1000]
    langs = [l for l in Language.objects.filter(enabled=True).values("code", "name")] or [{"code": "nl", "name": "Nederlands"}]
    codes = [l["code"] for l in langs]
    about = "; ".join(f"{k}: {v}" for k, v in (ctx.get("names") or {}).items() if v)[:600]
    desc = "; ".join(f"{k}: {v}" for k, v in (ctx.get("descriptions") or {}).items() if v)[:900]
    if sandbox.active("integrations"):
        out = {"titles": {c: ("Steun ons" if section == "info" else "Bedankt!") for c in codes}, "texts": {c: (extra or desc or about)[:300] for c in codes}, "simulated": True}
    else:
        goal = ("een informatie-popup die getoond wordt voordat iemand een bedrag kiest: leg warm en duidelijk uit waarvoor de donatie is en wat het oplevert"
                if section == "info" else "een bedankt-popup die getoond wordt nadat iemand heeft gedoneerd: oprecht, persoonlijk en kort")
        system = (f"Je schrijft teksten voor {goal}. Antwoord ALLEEN met één JSON-object zonder uitleg of markdown: "
                  f"{{\"titles\": {{taalcode: titel, max 60 tekens}}, \"texts\": {{taalcode: tekst, max 400 tekens}}}}. "
                  f"Talen (code: naam): {', '.join(f'{l['code']}: {l['name']}' for l in langs)}. Schrijf natuurlijk in elke taal, geen letterlijke vertaling nodig.")
        try:
            raw = _claude(system, f"Donatie-actie: {about}\nOmschrijving: {desc}" + (f"\nExtra wens: {extra}" if extra else ""), 2000)
            m = re.search(r"\{.*\}", raw, re.S)
            out = json.loads(m.group(0)) if m else None
        except ValueError as e:
            return bad(str(e) if not isinstance(e, json.JSONDecodeError) else "Claude gaf een antwoord dat niet te lezen was. Probeer het nog eens.", 502)
        if not isinstance(out, dict):
            return bad("Claude gaf een antwoord dat niet te lezen was. Probeer het nog eens.", 502)
    return Response({"titles": clean_texts(out.get("titles"), 120), "texts": clean_texts(out.get("texts"), 1500), "simulated": bool(out.get("simulated"))})


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
            "mine": mine.get(p.id), "button": p.button or {}}


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
    on = service.either_on()
    if service.modules.enabled("subscriptions"):
        service.process_due(request.user)
    ent = service.entitlements(request.user)
    gates = service.settings()["gates"] if on else {}
    return Response({
        "enabled": on,
        "subscriptions": [_sub_row(s) for s in Subscription.objects.filter(user=request.user).select_related("plan")][:50] if service.modules.enabled("subscriptions") else [],
        "entitlements": {k: (sorted(v) if isinstance(v, set) else v) for k, v in ent.items()},
        "gates": gates, "site_locked": bool(on and gates.get("site") and not ent["site"]), "locked_pages": sorted(service.locked_pages()) if on else [],
        "likes_left": service.likes_left(request.user) if on else None,
        "donations": request.user.donations.filter(status="paid").count() if service.modules.enabled("donations") else 0,
        "rewards": service.my_rewards(request.user) if service.modules.enabled("donations") else []})


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
    if not service.either_on():
        return Response({"ok": True})
    ent = service.entitlements(request.user)
    page, content = request.query_params.get("page"), request.query_params.get("content")
    key = request.query_params.get("key")
    if key:  # a part of the site (video_chat, chat…): may this member use it? (no use is taken here)
        ok = service.can(request.user, key)
        return Response({"ok": ok, "message": "" if ok else service.GATE_MESSAGE.get(key, "Hiervoor heb je een abonnement of donatie nodig.")})
    locked = service.locked_pages()
    if page:
        ok = page not in locked or ent["full"] or page in ent["pages"]
        if ok and page in locked:
            service.charge(request.user, "page", page)  # a donor action with a limited number of uses pays one per visit
        return Response({"ok": ok, "locked": page in locked})
    if content:
        listed = any(g.get("type") == "content" and g.get("ref") == content for grants in list(Plan.objects.values_list("grants", flat=True)) + list(DonationCampaign.objects.values_list("actions", flat=True)) for g in grants or [])
        row = ActionItem.objects.filter(kind="content", ref=content, gated=True).first()
        listed = listed or bool(row)
        ok = not listed or ent["full"] or content in ent["content"] or bool(row and service.evaluate(request.user, row, ent)[0])
        if ok and listed:
            service.charge(request.user, "content", content)
        return Response({"ok": ok, "locked": listed})
    return bad("Geef een pagina of content op.")


def _campaign_public(c, detail=False):
    r = service.raised(c)
    out = {"id": c.id, "slug": c.slug, "name": c.name, "description": c.description, "recipient": c.recipient or "de makers", "min": str(c.min_amount), "max": str(c.max_amount),
           "step": str(c.step), "default": str(c.default_amount), "goal": str(c.goal) if c.goal else None, "raised": str(r["total"]), "count": r["count"],
           "allow_message": c.allow_message, "allow_anonymous": c.allow_anonymous, "grants": service.describe(c.grants), "grant_days": c.grant_days,
           "min_for_grants": str(c.min_for_grants), "names": c.names, "descriptions": c.descriptions, "recipients": c.recipients, "button": c.button or {},
           "info": popup_public(c.info), "thanks": popup_public(c.thanks)}
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
                                 str(b.get("message") or "")[:300], bool(b.get("anonymous")), str(b.get("return_base") or ""), str(b.get("return_path") or ""))
    except service.SubError as e:
        return bad(str(e))
    except Exception as e:  # noqa: BLE001
        return bad(str(e), 503)
    d.refresh_from_db()
    return Response({"status": d.status, "amount": str(d.amount), "checkout_path": path}, status=status.HTTP_201_CREATED)


# ── admin: Actions (everything that can be paid for or earned with a donation) ──
def _clean_conditions(raw):
    from decimal import Decimal, InvalidOperation

    out = []
    for c in raw or []:
        t = c.get("type")
        if t not in service.CONDITION_TYPES:
            raise ValueError("Onbekende voorwaarde.")
        row = {"type": t}
        try:
            if t in ("plan", "donation_campaign", "role"):
                row["ref"] = int(c.get("ref") or 0)
                if not row["ref"]:
                    raise ValueError("Kies bij elke voorwaarde ook een keuze (abonnement, actie of rol).")
            if t in ("donation_total", "donation_campaign"):
                row["amount"] = str(max(Decimal("0"), Decimal(str(c.get("amount") or 0))))
                row["days"] = max(0, min(3650, int(c.get("days") or 0)))
            if t in ("member_days", "profile_complete"):
                row["value"] = max(0, min(100000, int(c.get("value") or 0)))
        except (InvalidOperation, TypeError):
            raise ValueError("Bedrag, dagen en aantallen moeten getallen zijn.")
        out.append(row)
    return out[:10]


def _rule_out(i):
    r = i.rule or {}
    loc = actions_local([{"from": r.get("from"), "until": r.get("until")}])[0]  # the moments as local time for the form
    return {"valid_for": r.get("valid_for", ""), "from": loc["from"], "until": loc["until"], "uses": int(r.get("uses") or 0), "session_only": bool(r.get("session_only")), "min_amount": str(r.get("min_amount") or "0")}


def _clean_rule(raw):
    """"Geldig tot": how long and how often a donor may use the item after a donation."""
    from decimal import Decimal, InvalidOperation

    raw = raw if isinstance(raw, dict) else {}
    frm, until = _dt(raw.get("from")), _dt(raw.get("until"))
    if frm and until and until <= frm:
        raise ValueError("De einddatum moet na de begindatum liggen.")
    try:
        uses = max(0, min(100000, int(raw.get("uses") or 0)))
        minimum = max(Decimal("0"), Decimal(str(raw.get("min_amount") or 0)))
    except (ValueError, InvalidOperation):
        raise ValueError("Aantal keer en minimumbedrag moeten getallen zijn.")
    return {"valid_for": raw.get("valid_for") if raw.get("valid_for") in service.VALID_FOR else "", "from": frm, "until": until, "uses": uses, "session_only": bool(raw.get("session_only")), "min_amount": str(minimum)}


def _grant_of(i):
    """The donor action that gives this item: (type, ref). Built-in: its own key; own items: page / content / service with their reference."""
    if i.kind == "builtin":
        return (i.key, "") if i.key in service.GRANT_TYPES else None
    return (i.kind, i.ref) if i.kind in ("page", "content", "service", "game") else None


def _linked(i):
    """Ids of the donation setups (Admin -> Donaties) that give this item to a donor."""
    g = _grant_of(i)
    if not g:
        return []
    return [c.id for c in DonationCampaign.objects.all() if any(a.get("type") == g[0] and str(a.get("ref") or "") == str(g[1]) for a in c.actions or [])]


def _linked_plans(i):
    """Ids of the subscriptions that give this item (an item can be in several subscriptions, a subscription can hold several items)."""
    g = _grant_of(i)
    if not g:
        return []
    return [p.id for p in Plan.objects.all() if any(a.get("type") == g[0] and str(a.get("ref") or "") == str(g[1]) for a in p.grants or [])]


def _set_plan_links(i, ids):
    g = _grant_of(i)
    if not g:
        return
    want = {int(x) for x in ids if str(x).isdigit()}
    for p in Plan.objects.all():
        grants = list(p.grants or [])
        has = [a for a in grants if a.get("type") == g[0] and str(a.get("ref") or "") == str(g[1])]
        if p.id in want and not has:
            grants.append({"type": g[0], "ref": g[1] if i.kind != "builtin" else "", "value": 0})
        elif p.id not in want and has:
            grants = [a for a in grants if a not in has]
        else:
            continue
        p.grants = grants
        p.save(update_fields=["grants"])


def _set_links(i, ids):
    """Link the item to exactly these donation setups: an action is added to (or taken from) the setup."""
    g = _grant_of(i)
    if not g:
        return
    want = {int(x) for x in ids if str(x).isdigit()}
    for c in DonationCampaign.objects.all():
        acts = list(c.actions or [])
        has = [a for a in acts if a.get("type") == g[0] and str(a.get("ref") or "") == str(g[1])]
        if c.id in want and not has:
            acts.append({"type": g[0], "ref": g[1] if i.kind != "builtin" else "", "value": 0, "from": None, "until": None, "valid_for": "", "uses": 0, "session_only": False, "min_amount": "0"})
        elif c.id not in want and has:
            acts = [a for a in acts if a not in has]
        else:
            continue
        c.actions = acts
        c.save(update_fields=["actions"])


def _item_row(i):
    spec = service.CATALOG_BY_KEY.get(i.key)
    name = spec[1] if spec else (i.name or i.key)
    return {"key": i.key, "kind": i.kind, "ref": i.ref, "name": name, "description": spec[3] if spec else i.description, "group": spec[2] if spec else ("Games" if i.kind == "game" else "Eigen onderdelen"),
            "themes": (spec[4] if spec and len(spec) > 4 else None), "donations": _linked(i), "plans": _linked_plans(i), "rule": _rule_out(i), "suggest": service.SUGGEST.get(i.key, ""), "builtin": bool(spec), "gated": i.gated, "mode": i.mode, "share": i.share, "pair": i.key in service.PAIR_KEYS, "conditions": i.conditions or [], "order": i.order}


@api_view(["GET", "POST"])
@permission_classes([_settings_perm()])
def actions_admin(request):
    """The list of everything that can be paid for or earned, with its conditions. POST adds an own item (page, piece of content or service)."""
    from apps.pages.models import Page
    from apps.shop import catalog

    if request.method == "POST":
        kind, ref = request.data.get("kind"), str(request.data.get("ref") or "").strip()[:80]
        if kind == "page" and not Page.objects.filter(key=ref, kind="content").exists():
            return bad("Kies een bestaande eigen pagina.")
        if kind == "service" and not catalog.exists(ref):
            return bad("Kies een bestaand product.")
        if kind == "content" and not ref:
            return bad("Geef de sleutel van de content op.")
        if kind not in ("page", "content", "service"):
            return bad("Kies pagina, content of dienst.")
        key = f"{kind}:{ref}"
        if ActionItem.objects.filter(key=key).exists():
            return bad("Dit onderdeel staat al in de lijst.")
        ActionItem.objects.create(key=key, kind=kind, ref=ref, name=str(request.data.get("name") or "")[:120], description=str(request.data.get("description") or "")[:300], gated=True, order=100 + ActionItem.objects.count())
    service.ensure_items()
    from apps.accounts.models import Role

    return Response({
        "items": [_item_row(i) for i in ActionItem.objects.all()],
        "options": {"theme": service.profile_theme(), "plans": [{"id": p.id, "name": p.name} for p in Plan.objects.all()], "campaigns": [{"id": c.id, "name": c.name} for c in DonationCampaign.objects.all()],
                    "roles": [{"id": r.id, "name": r.name} for r in Role.objects.all()], "condition_types": [{"type": k, "label": v} for k, v in service.CONDITION_TYPES.items()],
                    "pages": [{"key": p.key, "title": p.title.get("nl") or next(iter(p.title.values()), p.key)} for p in Page.objects.filter(kind="content")],
                    "products": catalog.active()}})


@api_view(["PATCH", "DELETE"])
@permission_classes([_settings_perm()])
def action_one(request, key):
    item = ActionItem.objects.filter(key=key).first()
    if not item:
        return bad("Niet gevonden.", 404)
    if request.method == "DELETE":
        if item.kind in ("builtin", "game"):
            return bad("Dit onderdeel kun je niet verwijderen; zet het open voor iedereen.")
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    d = request.data
    was_gated = item.gated
    if "gated" in d:
        item.gated = bool(d["gated"])
    if isinstance(d.get("plans"), list):
        _set_plan_links(item, d["plans"])
    elif item.gated and not was_gated and Plan.objects.count() == 1 and not _linked_plans(item):  # first time it is gated: with only one subscription, that one is used
        _set_plan_links(item, [Plan.objects.first().id])
    if isinstance(d.get("donations"), list):
        _set_links(item, d["donations"])
    elif item.gated and not was_gated and __import__("apps.core.modules", fromlist=["x"]).enabled("donations"):  # first time it is gated: with only one donation setup, that one is used
        camps = list(DonationCampaign.objects.all())
        if len(camps) == 1 and not _linked(item):
            _set_links(item, [camps[0].id])
    if "rule" in d:
        try:
            item.rule = _clean_rule(d["rule"])
        except ValueError as e:
            return bad(str(e))
    elif item.gated and not was_gated and not item.rule and service.SUGGEST.get(item.key):
        item.rule = {"valid_for": service.SUGGEST[item.key], "from": None, "until": None, "uses": 0, "session_only": False, "min_amount": "0"}  # our proposal, until the admin changes it
    if d.get("mode") in ("any", "all"):
        item.mode = d["mode"]
    if "share" in d and item.key in service.PAIR_KEYS:
        item.share = bool(d["share"])
    if "conditions" in d:
        try:
            item.conditions = _clean_conditions(d["conditions"])
        except ValueError as e:
            return bad(str(e))
    if item.kind != "builtin":
        item.name = str(d.get("name", item.name))[:120]
        item.description = str(d.get("description", item.description))[:300]
    item.save()
    return Response(_item_row(item))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_donations(request):
    """The member's own donations, newest first."""
    rows = Donation.objects.filter(user=request.user).select_related("campaign").order_by("-id")[:100]
    return Response([{"id": d.id, "campaign": d.campaign.names.get("nl") if getattr(d.campaign, "names", None) else d.campaign.name, "amount": str(d.amount), "status": d.status, "status_label": d.get_status_display(),
                      "paid_at": d.paid_at, "created_at": d.created_at} for d in rows])


@api_view(["GET"])
@permission_classes([_settings_perm()])
def actions_check(request):
    """For one member: which items can he use now, and which conditions passed or failed. For support questions."""
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.filter(email__iexact=str(request.query_params.get("email") or "").strip()).first()
    if not user:
        return bad("Geen lid gevonden met dit e-mailadres.", 404)
    service.ensure_items()
    ent = service.entitlements(user)
    out = []
    for i in ActionItem.objects.all():
        ok, res = service.evaluate(user, i, ent) if i.gated else (True, [])
        out.append({"key": i.key, "gated": i.gated, "ok": ok, "conditions": [{"type": t, "ok": p, "reason": r} for t, p, r in res]})
    return Response({"user": {"name": user.get_full_name() or user.username, "email": user.email}, "items": out})

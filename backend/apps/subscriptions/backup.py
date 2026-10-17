"""Plans, donation actions and the gates: carried along in the settings backup (members' subscriptions and donations are data, not settings)."""
from apps.core.settings_backup import register

from . import service
from .models import DonationCampaign, Plan

PLAN = ["slug", "name", "description", "price", "vat_rate", "interval", "duration_days", "trial_days", "grants", "highlight", "active", "order"]
CAMP = ["slug", "name", "description", "recipient", "min_amount", "max_amount", "step", "default_amount", "goal", "allow_message", "allow_anonymous", "grants",
        "grant_days", "min_for_grants", "active", "order"]


def _export(opts):
    return {"settings": service.settings(),
            "plans": [{k: str(getattr(p, k)) if k in ("price", "vat_rate") else getattr(p, k) for k in PLAN} for p in Plan.objects.all()],
            "campaigns": [{k: (str(getattr(c, k)) if getattr(c, k) is not None and k in ("min_amount", "max_amount", "step", "default_amount", "goal", "min_for_grants") else getattr(c, k)) for k in CAMP} for c in DonationCampaign.objects.all()]}


def _apply(data, ctx):
    data = data or {}
    if data.get("settings"):
        service.save_settings(data["settings"])
    n = 0
    for row, model, keys in [(r, Plan, PLAN) for r in data.get("plans", [])] + [(r, DonationCampaign, CAMP) for r in data.get("campaigns", [])]:
        if not row.get("slug"):
            continue
        try:
            grants = service.clean_grants(row.get("grants"))
        except ValueError:
            grants = []  # a page or product that does not exist here: the plan arrives without that grant
        vals = {k: row[k] for k in keys if k in row and k not in ("slug", "grants")}
        model.objects.update_or_create(slug=row["slug"], defaults={**vals, "grants": grants})
        n += 1
    return f"{n} abonnement(en) en donatie-acties geladen."


register("subscriptions", "Abonnementen en donaties", _export, _apply, description="Abonnementen, donatie-acties en welke onderdelen een abonnement vragen.", order=72)

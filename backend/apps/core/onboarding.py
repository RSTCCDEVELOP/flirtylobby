# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Where the onboarding stands (for a superadmin): the screens of a new installation in order (colour, licence, terms, questions, installation, AI credit, design wizard) and which one is next.
Nothing is stored per step: every step looks at what is really there (the flags of the first questions, the licence, the signature of the terms, the installation, the AI explanation), so after
every login the onboarding goes on where it was left. The only thing stored is that the last step, the design wizard, was started (`onboarding_complete`): then it is complete.
An installation that was set up before this existed has all of these already and counts as complete."""
from .models import SystemSettings

COMPLETE_KEY = "onboarding_complete"
STARTED_KEY = "onboarding_started"  # the onboarding was looked at on a new installation (an older installation counts as complete)

# key, what the person sees (Dutch source text)
STEPS = [
    ("welcome", "Kleur kiezen"),
    ("licence", "Licentie regelen"),
    ("terms", "Voorwaarden accepteren met de e-mailcode"),
    ("manual", "Handleiding"),
    ("install", "Standaard installatie"),
    ("ai", "AI-tegoed uitleggen en instellen"),
    ("trees", "Bomen planten met easy2edit (kies aan of uit)"),
    ("design", "Website ontwerpen: de wizard starten"),
]


def _data():
    return dict(SystemSettings.objects.filter(pk=1).values_list("data", flat=True).first() or {})


def mark_complete():
    """The design wizard was started: the onboarding is complete."""
    from . import reset

    row, _ = SystemSettings.objects.get_or_create(pk=1)
    row.data = {**(row.data or {}), COMPLETE_KEY: True}
    row.save()
    reset.clear_replay()


def clear_complete():
    row = SystemSettings.objects.filter(pk=1).first()
    if row and (row.data or {}).get(COMPLETE_KEY):
        row.data = {k: v for k, v in row.data.items() if k != COMPLETE_KEY}
        row.save()


def status(user):
    """{complete, next, next_label, steps: [{key, label, done}]}. Only a superadmin has an onboarding to finish (the rest of the people never see it)."""
    from . import presets, reset, system, terms

    if not (user and user.is_authenticated and user.is_staff):
        return {"complete": True, "next": "", "next_label": "", "steps": []}
    d = _data()
    replay = reset.replay_pending()
    if d.get(COMPLETE_KEY) and not replay:  # the design wizard was started: done, whatever was skipped on the way
        return {"complete": True, "next": "", "next_label": "", "steps": [{"key": k, "label": lb, "done": True} for k, lb in STEPS]}
    has_lic = bool(system.license_info()["has"]) and not system.setup_missing()
    ai_done = True
    try:
        from . import modules
        from apps.integrations.models import AiAccount

        if modules.enabled("ai"):
            acc = AiAccount.objects.filter(user=user).first()
            ai_done = bool(acc and acc.welcomed)  # (no account yet: the explanation was not shown yet)
    except Exception:  # noqa: BLE001
        ai_done = True
    try:  # the step only exists while the module is there (an installation without it skips it)
        from . import modules as _m

        trees_possible = _m.enabled("ecologi") or _m.enabled("ecologi_admin")
    except Exception:  # noqa: BLE001
        trees_possible = False
    done = {
        "welcome": bool(d.get("welcome_asked")) and not replay,
        "licence": has_lic and not (replay and not reset.replay_form_done()),
        "terms": bool(terms.signed(user, terms.current().version)),
        "manual": bool(d.get("manual_asked")) and not replay,
        "install": bool(presets.active()) and not replay,
        "ai": ai_done,
        "trees": (bool(d.get("trees_asked")) and not replay) or not trees_possible,
        "design": bool(d.get(COMPLETE_KEY)) and not replay,
    }
    if not replay and not d.get(STARTED_KEY):
        # the first time the onboarding is looked at: a new installation (the colour question is still to be answered) starts it; an installation that was set up long before this
        # (it has answered that question) never had it and counts as complete
        row, _ = SystemSettings.objects.get_or_create(pk=1)
        if d.get("welcome_asked"):
            row.data = {**(row.data or {}), STARTED_KEY: True, COMPLETE_KEY: True}
            row.save()
            return {"complete": True, "next": "", "next_label": "", "steps": [{"key": k, "label": lb, "done": True} for k, lb in STEPS]}
        row.data = {**(row.data or {}), STARTED_KEY: True}
        row.save()
    steps = [{"key": k, "label": lb, "done": done[k]} for k, lb in STEPS]
    nxt = next((s for s in steps if not s["done"]), None)
    return {"complete": nxt is None, "next": nxt["key"] if nxt else "", "next_label": nxt["label"] if nxt else "", "steps": steps}

# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Links that are always on ("Altijd aan bij opstarten", set by a superadmin on the link): they are needed to finish the installation (mail, payment, sms ...).
At every start, and again at the first login after an installation, such a link that has its key is switched on, and the module API keys with it. No password and no
person is needed for that: the keys come from the environment of the server (EASY2EDIT_..._KEY) or from the easy2edit server (default_links), never from a person.
A link that is always on cannot be switched off in the screen: first take "Altijd aan" off."""
import logging

logger = logging.getLogger(__name__)


def _has_key(obj):
    from apps.core.syslinks import SECRETS

    return any(str(v).strip() for k, v in (obj.config or {}).items() if k in SECRETS)


def retest_sms():
    """At every start the SMS links that are on are tested again (read-only: the balance), so what is offered (SMS is only offered for a link that passed its online test and has credit) is up to date."""
    from django.utils import timezone

    from apps.sandbox import service as sandbox

    from .models import Integration
    from .providers import PROVIDERS

    if sandbox.active("integrations"):
        return []
    done = []
    for obj in Integration.objects.filter(enabled=True, provider__in=("spryng", "seven", "bird")):
        try:
            ok, msg = PROVIDERS[obj.provider]["test"](obj.config)
        except Exception as e:  # noqa: BLE001
            ok, msg = False, f"Geen verbinding: {e}"
        Integration.objects.filter(pk=obj.pk).update(last_test_ok=ok, last_test_message=msg[:300], last_test_at=timezone.now())
        done.append((obj.slug, ok))
    return done


def ensure_always_on():
    """Switch on every always-on link that has a key. Returns the slugs that were switched on."""
    from apps.core import modules
    from apps.core.models import ModuleState

    from .models import Integration

    on = []
    for obj in Integration.objects.filter(always_on=True, enabled=False):
        if _has_key(obj):
            Integration.objects.filter(pk=obj.pk).update(enabled=True)
            on.append(obj.slug)
    if Integration.objects.filter(always_on=True).exists():
        ModuleState.objects.update_or_create(key="integrations", defaults={"enabled": True})  # the links are only used while the module API keys is on
        modules.invalidate()
    if on:
        logger.info("Links switched on (always on): %s", ", ".join(on))
    return on

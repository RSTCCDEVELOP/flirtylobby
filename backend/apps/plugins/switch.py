# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Switching a plugin on or off, with what belongs to it (the plugins it needs, the plugins that need it, the licence prices, the menu). Used by the plugin screen and by the easy2edit server (Site manager)."""
from . import installer, runtime
from .models import Plugin


class SwitchError(ValueError):
    pass


ALWAYS_ON = ("siteimport",)  # Website ontwerpen: how a website gets its pages; it is always there


def set_enabled(p, want, with_requires=False):
    """Switch the plugin on or off. Raises SwitchError with a message that can be shown. -> the plugin (fresh from the database)."""
    if want:
        installer.repair_chain(p)
        p = Plugin.objects.get(pk=p.pk)
        todo, absent = runtime.requirement_chain(p)
        if absent:
            raise SwitchError("Deze plugin heeft nog niet geïnstalleerde plugins nodig: " + ", ".join(absent) + ". Installeer die eerst.")
        if todo and not with_requires:
            raise SwitchError("Zet eerst ook aan: " + ", ".join(x.title for x in todo) + ".")
        for dep in todo:  # the plugins this one needs, the ones they need first
            err = runtime.load(dep)
            if err:
                Plugin.objects.filter(pk=dep.pk).update(error=err, enabled=False)
                raise SwitchError(f"{dep.title} kon niet worden gestart: {err}")
            Plugin.objects.filter(pk=dep.pk).update(enabled=True, error="")
    if not want and p.name in ALWAYS_ON:
        raise SwitchError("Website ontwerpen is een vast onderdeel en kan niet worden uitgezet.")
    if not want and (need := runtime.dependents(p.name)):
        names = dict(Plugin.objects.filter(name__in=need).values_list("name", "title"))
        raise SwitchError("Eerst deze plugins uitzetten: " + ", ".join(names.get(n, n) for n in need) + ". Zij hebben deze plugin nodig.")
    if want:
        err = runtime.load(p)
        if err:
            Plugin.objects.filter(pk=p.pk).update(error=err, enabled=False)
            raise SwitchError(f"De plugin kon niet worden gestart: {err}")
        Plugin.objects.filter(pk=p.pk).update(enabled=True, error="")
        try:  # the price list of the licence follows the plugins in use
            from apps.core import pricing

            pricing.apply_to_license()
        except Exception:  # noqa: BLE001
            pass  # (the licence prices follow the next time they are saved)
    else:
        runtime.unload(p.name)
        Plugin.objects.filter(pk=p.pk).update(enabled=False)
    p.refresh_from_db()
    from apps.core import modules

    modules.invalidate()
    installer.sync_menu_page(p)  # (a plugin that is off has no item in the menu)
    return p

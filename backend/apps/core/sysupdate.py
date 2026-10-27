# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""After an update of Easy2edit (a new build): the site is checked and brought up to date, step by step, with a window that shows the progress.

The steps never remove content: first a copy of the pages, designs and texts is kept (in the site folder), then the database, the plugins, the themes, the languages and the pages are checked."""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

STEPS = [
    ("backup", "Kopie van pagina's, ontwerpen en teksten bewaren"),
    ("database", "Database controleren en bijwerken"),
    ("plugins", "Plugins controleren en bijwerken"),
    ("themas", "Thema's controleren en bijwerken"),
    ("languages", "Talen controleren"),
    ("pages", "Pagina's en menu controleren"),
    ("finish", "Afronden"),
]


def build():
    return int(getattr(settings, "SYSTEM_BUILD", 0) or 0)


def status(user):
    """{needed, build, checked, steps}: needed = this build has not been checked on this site yet (and the site has content)."""
    from . import presets

    d = presets._data()
    checked = d.get("checked_build")
    needed = False
    if checked is None:
        from apps.pages.models import PageLayout

        if PageLayout.objects.exists():
            needed = True  # a site from before this check: it is checked once
        else:
            d["checked_build"] = build()  # a new site: nothing to bring up to date
            presets._save_data(d)
    else:
        needed = int(checked) < build()
    return {"needed": needed, "build": build(), "checked": checked, "version": getattr(settings, "SYSTEM_VERSION", ""), "steps": [{"key": k, "label": l} for k, l in STEPS]}


def _library(kind, user):
    from . import resources

    try:
        done = resources.update_all(kind, user)
    except resources.ResourceError as e:
        return {"ok": True, "message": f"Overgeslagen: {e}"}
    return {"ok": True, "message": ("Bijgewerkt: " + ", ".join(done)) if done else "Alles is al actueel."}


def run(step, user):
    """Do one step. Returns {ok, message}; a step that fails does not stop the others."""
    try:
        if step == "backup":
            from . import sitecontent

            n = sitecontent.snapshot(keep_copy=True)
            return {"ok": True, "message": f"Bewaard in de sitemap: {n['pages']} pagina's, {n['layouts']} ontwerpen, {n['blocks']} teksten."}
        if step == "database":
            from django.core.management import call_command

            call_command("migrate", "--noinput", verbosity=0)
            return {"ok": True, "message": "De database is actueel."}
        if step in ("plugins", "themas", "languages"):
            if step == "languages":
                from . import resources

                bad = [r["name"] for r in resources.overview(user)["languages"] if r["state"] == "update" and r.get("installed_version")]
                return _library("languages", user) if bad else {"ok": True, "message": "Alle talen zijn aanwezig."}
            r = _library(step, user)
            if step == "plugins":
                from apps.plugins import runtime

                runtime.ensure_loaded(True)  # (the plugins that were updated run again)
            return r
        if step == "pages":
            from apps.pages import layout as page_layout
            from apps.pages import service as pages_service
            from apps.pages.models import PageLayout

            pages_service.ensure_defaults()
            fixed, problems = 0, []
            for lay in PageLayout.objects.all():
                try:
                    clean = page_layout.clean(lay.data or {})
                except ValueError as e:
                    problems.append(f"{lay.key}: {e}")
                    continue
                for keep in ("auto",):  # what the check does not know stays as it was (the mark of a page that was made by itself)
                    if keep in (lay.data or {}) and keep not in clean:
                        clean[keep] = lay.data[keep]
                if clean != (lay.data or {}):
                    PageLayout.objects.filter(pk=lay.pk).update(data=clean)
                    fixed += 1
            msg = f"{PageLayout.objects.count()} pagina's gecontroleerd" + (f", {fixed} bijgewerkt" if fixed else "") + "."
            if problems:
                return {"ok": False, "message": msg + " Niet in orde: " + "; ".join(problems[:3])}
            return {"ok": True, "message": msg}
        if step == "finish":
            from . import presets

            d = presets._data()
            d["checked_build"] = build()
            presets._save_data(d)
            return {"ok": True, "message": f"Build {build()} is gecontroleerd."}
    except Exception as e:  # noqa: BLE001
        logger.exception("Update step %s failed", step)
        return {"ok": False, "message": str(e)[:300]}
    return {"ok": False, "message": "Onbekende stap."}

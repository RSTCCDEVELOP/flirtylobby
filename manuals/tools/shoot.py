# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Makes (or renews) the screenshots of the manual, in English, with a temporary superadmin that is removed again. The site must run (backend and frontend).
    cd backend && SHOTS_ARGS="--refresh" python manage.py shell -c "exec(open('../manuals/tools/shoot.py').read())"      (SHOTS_ARGS: --refresh, --only id,id)
English is switched on for a moment (when it was off) and put back afterwards."""
import os
import subprocess
from pathlib import Path

from django.conf import settings
from rest_framework.authtoken.models import Token

from apps.accounts.models import User
from apps.core import modules
from apps.core.models import Language, ModuleState
from apps.plugins import runtime
from apps.plugins.models import Plugin

ROOT = Path(settings.BASE_DIR).parent
EMAIL = "manual-shots@example.com"
User.objects.filter(email=EMAIL).delete()
u = User.objects.create(email=EMAIL, first_name="Alex", last_name="Admin", is_active=True, is_staff=True, is_superuser=True)
u.set_unusable_password()
u.save()
# no screen of "set up two-step verification" or "confirm your e-mail" over the pictures
User.objects.filter(pk=u.pk).update(otp_active=True, email_verified=True)
tok = Token.objects.create(user=u).key
# since build 157 admins and superadmins must sign the terms of easy2edit before the screens show: the temporary superadmin gets a signature (it goes away with the user, nothing is sent)
from apps.core import terms as _terms
from apps.core.models import TermsSignature
_cur = _terms.current()
if _cur:
    TermsSignature.objects.create(user=u, version=_cur.version if hasattr(_cur, "version") else _cur["version"], role="superadmin", name="Alex Admin", email=EMAIL, lang="en", method="skipped")
try:  # the notices that come on their own would sit in every picture: the explanation of the AI credit is "seen" for this temporary user
    from apps.integrations.models import AiAccount
    AiAccount.objects.update_or_create(user=u, defaults={"welcomed": True})
except Exception:  # noqa: BLE001
    pass
en = Language.objects.filter(code="en").first()
was = (en.enabled if en else None)
# for the pictures every module and plugin is switched on for a moment (a site with a small installation would show nothing of most pages): the state of this site is put back afterwards
prev_modules = list(ModuleState.objects.values_list("key", "enabled"))
prev_plugins = list(Plugin.objects.values_list("pk", "enabled"))
try:
    for m in modules.MODULES:
        if not m.get("core") and not m.get("plugin"):
            ModuleState.objects.update_or_create(key=m["key"], defaults={"enabled": True})
    Plugin.objects.update(enabled=True)
    runtime.ensure_loaded(True)
    modules.invalidate()
    if en and not en.enabled:
        Language.objects.filter(pk=en.pk).update(enabled=True)
    # the pages about trees need the Ecologi link and the tile for the administrator: made for a moment (only when there is none) and put back
    from apps.ecologi.models import EcologiSettings
    from apps.ecologi.service import PROVIDER as _ECO
    from apps.integrations.models import Integration as _Int
    _eco_made = None
    if not _Int.objects.filter(provider=_ECO, enabled=True).exists():
        _eco_made = _Int.objects.create(provider=_ECO, name="Ecologi", enabled=True)
    _eco_set = EcologiSettings.load()
    _eco_prev = _eco_set.admin_enabled
    if not _eco_prev:
        EcologiSettings.objects.filter(pk=_eco_set.pk).update(admin_enabled=True)
    showcase_demo = dict(runtime.providers("demo")).get("showcase")  # the Showcase pictures need projects: its demo content is made for a moment (only when there is none) and removed again
    made_demo = bool(showcase_demo) and not any(showcase_demo.counts().values()) and bool(showcase_demo.create())
    for lang in os.environ.get("SHOTS_LANGS", "en,nl").split(","):  # the pictures of the English manual are in English, those of the Dutch manual in Dutch
        r = subprocess.run(["node", str(ROOT / "manuals" / "tools" / "screenshots.mjs"), "--lang", lang, "--mode", os.environ.get("SHOTS_MODE", "both"), *os.environ.get("SHOTS_ARGS", "").split()], env={**os.environ, "E2E_TOKEN": tok}, capture_output=True, text=True, timeout=1500)
        print(lang, r.stdout[-2500:], r.stderr[-1200:])
finally:
    try:
        if _eco_made is not None:
            _eco_made.delete()
        if not _eco_prev:
            EcologiSettings.objects.filter(pk=_eco_set.pk).update(admin_enabled=False)
    except NameError:
        pass
    try:
        if made_demo:
            showcase_demo.remove()
    except NameError:
        pass
    from apps.core.models import SiteDesignJob

    SiteDesignJob.objects.filter(user=u).delete()  # the design that the picture of the wizard started
    ModuleState.objects.all().delete()
    ModuleState.objects.bulk_create([ModuleState(key=k, enabled=v) for k, v in prev_modules])
    for pk, on in prev_plugins:
        Plugin.objects.filter(pk=pk).update(enabled=on)
    runtime.ensure_loaded(True)
    modules.invalidate()
    if en is not None and was is False:
        Language.objects.filter(pk=en.pk).update(enabled=False)
    User.objects.filter(email=EMAIL).delete()
    print("temporary superadmin removed; modules, plugins and English put back as they were")

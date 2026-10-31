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
tok = Token.objects.create(user=u).key
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
    r = subprocess.run(["node", str(ROOT / "manuals" / "tools" / "screenshots.mjs"), *os.environ.get("SHOTS_ARGS", "").split()], env={**os.environ, "E2E_TOKEN": tok}, capture_output=True, text=True, timeout=1500)
    print(r.stdout[-3000:], r.stderr[-1500:])
finally:
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

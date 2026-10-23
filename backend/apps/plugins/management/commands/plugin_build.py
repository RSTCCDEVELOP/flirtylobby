# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import json
import zipfile

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.plugins import installer, manifest as mf, signing
from .plugin_translate import fill


class Command(BaseCommand):
    help = "Build a plugin for this version of the system: sets system_version, checks the languages, signs it with the developer key and makes the zip in resource/plugins/ (only the latest version of a plugin stays)."

    def add_arguments(self, parser):
        parser.add_argument("name", nargs="?")
        parser.add_argument("--all", action="store_true")
        parser.add_argument("--allow-missing", action="store_true", help="build even when languages are incomplete")

    def handle(self, *a, **o):
        names = [d.name for d in sorted(installer.root().iterdir()) if d.is_dir() and not d.name.startswith(".")] if o["all"] else [o["name"]]
        if not names or names == [None]:
            raise CommandError("Geef de naam van een plugin, of --all.")
        for name in names:
            self.build(name, o["allow_missing"])

    def build(self, name, allow_missing):
        folder = installer.plugin_dir(name)
        mpath = folder / "plugin.json"
        if not mpath.is_file():
            raise CommandError(f"{name}: plugin.json ontbreekt.")
        raw = json.loads(mpath.read_text())
        raw["system_version"] = settings.SYSTEM_VERSION  # this build is for this version of the system
        try:
            man = mf.parse(json.dumps(raw))
        except mf.ManifestError as e:
            raise CommandError(f"{name}: {e}")
        mpath.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n")
        missing = fill(folder, True, self.stdout)
        short = {c: len(k) for c, k in missing.items() if k}
        if short and not allow_missing:
            raise CommandError(f"{name}: niet in alle talen vertaald (ontbrekend per taal: {short}). Draai plugin_translate of vul lang/<code>.json aan.")
        signing.sign(folder)
        dist = settings.RESOURCE_DIR / "plugins"
        dist.mkdir(parents=True, exist_ok=True)
        zpath = dist / f"{name}-{man['version']}.zip"
        for old in dist.glob(f"{name}-*.zip"):  # only the latest version of a plugin in the library
            if old != zpath and old.name[len(name) + 1:-4].replace(".", "").isdigit():
                old.unlink()
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
            for rel in signing.files(folder) + [signing.SIG_FILE]:
                z.write(folder / rel, rel)
        self.stdout.write(self.style.SUCCESS(f"{name} {man['version']} voor systeem {settings.SYSTEM_VERSION}: ondertekend, {len(installer.languages())} talen, {zpath}"))

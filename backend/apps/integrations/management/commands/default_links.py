# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The API links that go with every installation (backend/apps/integrations/default_links.json)."""
from django.core.management.base import BaseCommand

from apps.integrations import default_links


class Command(BaseCommand):
    help = "capture: write the links that are marked 'in every installation' to the file. apply: make the links that are missing (--force: also switch them on)."

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["capture", "apply"])
        parser.add_argument("--force", action="store_true")

    def handle(self, *args, **o):
        if o["action"] == "capture":
            return self.stdout.write("default_links: " + (", ".join(default_links.capture()) or "niets gemarkeerd"))
        res = default_links.apply(force=o["force"])
        from apps.integrations import activation

        on = activation.ensure_always_on()  # the links that are always on: switched on at every start, no password needed
        if on:
            self.stdout.write("default_links: altijd aan: " + ", ".join(on))
        tested = activation.retest_sms()  # SMS is only offered for a link that passed its online test now
        if tested:
            self.stdout.write("default_links: sms getest: " + ", ".join(f"{s}={'ok' if ok else 'fout'}" for s, ok in tested))
        self.stdout.write("default_links: " + (", ".join(f"{r['key']}={'ok' if r['ok'] else 'fout'}" for r in res) or "niets te doen"))

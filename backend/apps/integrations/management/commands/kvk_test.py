# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""A test call to the KVK Handelsregister: a search and the profile of the first company found.
`manage.py kvk_test`                 -> the KVK test environment with its public test key (made-up companies, free)
`manage.py kvk_test --live "naam"`   -> the link of Admin -> API keys (production or test, as set there); the profile costs a few cents"""
import json

from django.core.management.base import BaseCommand, CommandError

from apps.integrations import kvk


class Command(BaseCommand):
    help = "Test call to the KVK Handelsregister (search + company profile)."

    def add_arguments(self, parser):
        parser.add_argument("query", nargs="?", default="test", help="name, 8-digit KVK number or postcode with house number (1234AB 12)")
        parser.add_argument("--live", action="store_true", help="use the link of Admin -> API keys instead of the public test key")

    def handle(self, *a, **o):
        cfg = kvk.settings() if o["live"] else {"api_key": kvk.TEST_KEY, "omgeving": "test"}
        if not cfg:
            raise CommandError("Geen KVK-koppeling ingeschakeld (Admin -> API keys).")
        self.stdout.write(f"Omgeving: {cfg['omgeving']}  |  zoeken: {o['query']!r}")
        try:
            found = kvk.search(o["query"], cfg=cfg)
        except ValueError as e:
            raise CommandError(str(e))
        self.stdout.write(self.style.SUCCESS(f"{len(found)} resultaten"))
        for r in found:
            self.stdout.write(f"  {r['kvk']}  {r['naam']}  ({r['plaats'] or '-'}, {r['type']})")
        if not found:
            return
        try:
            prof = kvk.profile(found[0]["kvk"], cfg=cfg)
        except ValueError as e:
            raise CommandError(str(e))
        self.stdout.write(self.style.SUCCESS(f"Profiel van {found[0]['kvk']}:"))
        self.stdout.write(json.dumps(prof["fields"], ensure_ascii=False, indent=2))

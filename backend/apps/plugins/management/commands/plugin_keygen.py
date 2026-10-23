# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.core.management.base import BaseCommand, CommandError
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519

from apps.plugins import signing


class Command(BaseCommand):
    help = "Make the developer's signing key for plugins. The private key stays on your machine (outside the repository); the public key goes into the system."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="replace an existing key (all plugins must be signed again)")

    def handle(self, *a, **o):
        kp = signing.private_key_path()
        if kp.exists() and not o["force"]:
            raise CommandError(f"Er is al een sleutel: {kp}. Gebruik --force om hem te vervangen (alle plugins moeten dan opnieuw worden ondertekend).")
        key = ed25519.Ed25519PrivateKey.generate()
        kp.parent.mkdir(parents=True, exist_ok=True)
        kp.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
        kp.chmod(0o600)
        signing.PUBLIC_KEY.write_bytes(key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
        self.stdout.write(self.style.SUCCESS(f"Privésleutel: {kp}  (bewaar een kopie; zonder deze sleutel kun je geen plugins meer ondertekenen)\nPublieke sleutel: {signing.PUBLIC_KEY}  (hoort bij de code van het systeem)"))

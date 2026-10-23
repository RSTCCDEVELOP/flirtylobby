# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = "apps.core"

    def ready(self):
        from corsheaders.signals import check_request_enabled

        def allow_configured(sender, request, **kwargs):
            """The website address and extra addresses from Systeem -> Basisgegevens may use the API without changing the environment."""
            origin = request.META.get("HTTP_ORIGIN")
            if not origin:
                return False
            try:
                from . import system

                return origin in system.allowed_origins()
            except Exception:  # noqa: BLE001  e.g. before the first migration
                return False

        check_request_enabled.connect(allow_configured)

        from apps.sandbox import service as sandbox

        from . import views

        if views.on_license_payment not in sandbox.HOOKS:
            sandbox.HOOKS.append(views.on_license_payment)  # a paid licence renewal
        from apps import commerce

        if commerce.payment_changed not in sandbox.HOOKS:
            sandbox.HOOKS.append(commerce.payment_changed)  # a payment changed: the plugin Orders updates its order

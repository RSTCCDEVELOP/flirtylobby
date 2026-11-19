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
        from django.contrib.auth.signals import user_logged_in

        from . import sitemanager

        from . import everyone

        everyone.connect()  # a new user goes into the standard group "Everyone" (when it exists)

        user_logged_in.connect(sitemanager.on_login, dispatch_uid="easy2edit-sitemanager-login")  # an administrator logs in: the website reports itself to the easy2edit server (in the background)

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

        try:  # the content of the website is kept as a file in the site folder (a moment after every change)
            from . import sitecontent

            sitecontent.connect()
        except Exception:  # noqa: BLE001
            pass

        from django.db.models.signals import post_migrate

        def system_links(sender, **kwargs):
            """After every migration (every deployment): the e-mail, payment and AI links of the superadmin are there and on."""
            if getattr(sender, "name", "") != "apps.core":
                return
            try:
                from . import syslinks

                syslinks.ensure_from_env()
            except Exception:  # noqa: BLE001  e.g. the integrations tables do not exist yet
                pass

        post_migrate.connect(system_links, dispatch_uid="core.system_links")

        try:  # a licence that has ended: one reminder e-mail a day to the administrator (checked every hour by the background controller)
            from . import background, licence_reminder

            background.register("licence-reminder", licence_reminder.run, every=3600, first=180)
            background.start()
        except Exception:  # noqa: BLE001
            pass

        from apps.sandbox import service as sandbox

        from . import views

        if views.on_license_payment not in sandbox.HOOKS:
            sandbox.HOOKS.append(views.on_license_payment)  # a paid licence renewal
        from apps import commerce

        if commerce.payment_changed not in sandbox.HOOKS:
            sandbox.HOOKS.append(commerce.payment_changed)  # a payment changed: the plugin Orders updates its order

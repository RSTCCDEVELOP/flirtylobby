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

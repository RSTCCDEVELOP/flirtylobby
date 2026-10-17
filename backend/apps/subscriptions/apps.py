from django.apps import AppConfig


class SubscriptionsConfig(AppConfig):
    name = "apps.subscriptions"

    def ready(self):
        from apps.sandbox import service as sandbox

        from . import service

        if service.on_payment not in sandbox.HOOKS:
            sandbox.HOOKS.append(service.on_payment)

from django.apps import AppConfig


class ShopConfig(AppConfig):
    name = "apps.shop"

    def ready(self):
        # a (simulated) payment changed: update the order that belongs to it
        from apps.sandbox import service

        from .service import on_payment

        service.HOOKS.append(on_payment)

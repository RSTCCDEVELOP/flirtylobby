# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.apps import AppConfig


class IntegrationsConfig(AppConfig):
    name = "apps.integrations"

    def ready(self):
        from apps.sandbox import service as sandbox

        from . import aiusage

        if aiusage.payment_changed not in sandbox.HOOKS:
            sandbox.HOOKS.append(aiusage.payment_changed)  # a paid purchase of AI credit is added to the credit

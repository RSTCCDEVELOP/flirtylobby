# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.apps import AppConfig


class AuditlogConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.auditlog"
    label = "auditlog"

    def ready(self):
        from django.contrib.auth.signals import user_logged_in

        from . import service

        user_logged_in.connect(service.on_login, dispatch_uid="easy2edit-auditlog-login")  # every login (also the ones with a code) is written in the log

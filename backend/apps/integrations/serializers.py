# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import re

from rest_framework import serializers

from . import providers
from .models import Integration

MASK = "••••"
REMOVE = "__remove__"  # sent by the form to clear a stored secret (an empty field means "unchanged")


def mask(value):
    return MASK + str(value)[-4:] if value else ""


class IntegrationSerializer(serializers.ModelSerializer):
    config = serializers.DictField(child=serializers.CharField(allow_blank=True), required=False)
    provider_label = serializers.SerializerMethodField()

    class Meta:
        model = Integration
        fields = ["id", "name", "slug", "provider", "provider_label", "enabled", "superadmin_only", "config",
                  "last_test_ok", "last_test_at", "last_test_message"]
        read_only_fields = ["last_test_ok", "last_test_at", "last_test_message"]

    def validate_superadmin_only(self, value):
        """Only a superadmin may make a link a superadmin link (or take that off)."""
        req = self.context.get("request")
        if req is not None and not req.user.is_staff:
            if self.instance is not None:
                return self.instance.superadmin_only
            return False
        return value

    def get_provider_label(self, obj):
        return providers.PROVIDERS.get(obj.provider, {}).get("label", obj.provider)

    def validate_slug(self, value):
        if not re.fullmatch(r"[a-z0-9-]+", value):
            raise serializers.ValidationError("Alleen kleine letters, cijfers en streepjes.")
        return value

    def validate_provider(self, value):
        if value not in providers.PROVIDERS:
            raise serializers.ValidationError("Onbekende koppeling.")
        return value

    def to_representation(self, obj):
        data = super().to_representation(obj)
        spec = providers.PROVIDERS.get(obj.provider)
        stored = obj.config
        # Secrets never leave the server: only a masked hint
        data["config"] = {
            fl["key"]: mask(stored.get(fl["key"])) if fl["secret"] else stored.get(fl["key"], fl["default"])
            for fl in (spec["fields"] if spec else [])
        }
        return data

    def _merge(self, provider, old, incoming):
        spec = providers.PROVIDERS[provider]
        new = {}
        for fl in spec["fields"]:
            v = incoming.get(fl["key"], old.get(fl["key"], ""))
            if fl["secret"] and v == REMOVE:
                v = ""  # the admin pressed "Verwijderen" on this key
            elif fl["secret"] and (not v or v.startswith(MASK)):
                v = old.get(fl["key"], "")  # untouched secret: keep stored value
            new[fl["key"]] = v
        return new

    def create(self, validated):
        config = validated.pop("config", {})
        obj = Integration(**validated)
        obj.config = self._merge(obj.provider, {}, config)
        obj.save()
        return obj

    def update(self, instance, validated):
        config = validated.pop("config", None)
        for k, v in validated.items():
            setattr(instance, k, v)
        if config is not None:
            merged = self._merge(instance.provider, instance.config, config)
            if instance.provider == "s3" and (merged.get("encryption_key") or "") != (instance.config.get("encryption_key") or ""):
                from apps.medialib import filecrypt

                filecrypt.rewrap_all(merged.get("encryption_key") or "")  # encrypted files stay readable after the change
            instance.config = merged
            instance.last_test_ok = None  # settings changed: needs a new test
            instance.last_test_message = ""
        instance.save()
        return instance

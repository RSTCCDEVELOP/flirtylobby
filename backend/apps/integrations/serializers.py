# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

import re

from rest_framework import serializers

from . import lock, providers
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
        fields = ["id", "name", "slug", "provider", "provider_label", "enabled", "superadmin_only", "in_installation", "always_on", "locked", "lock_password", "config",
                  "last_test_ok", "last_test_at", "last_test_message"]
        read_only_fields = ["last_test_ok", "last_test_at", "last_test_message"]
        extra_kwargs = {"lock_password": {"write_only": True, "required": False, "allow_blank": True}}

    def validate_superadmin_only(self, value):
        """Only a superadmin may make a link a superadmin link (or take that off)."""
        req = self.context.get("request")
        if req is not None and not req.user.is_staff:
            if self.instance is not None:
                return self.instance.superadmin_only
            return False
        return value

    def validate_in_installation(self, value):
        """Only a superadmin may say that a link goes with every installation."""
        req = self.context.get("request")
        if req is not None and not req.user.is_staff:
            return self.instance.in_installation if self.instance is not None else False
        return value

    def validate_always_on(self, value):
        """Only a superadmin+ may say that a link is always on (or take that off): it is what keeps the installation working."""
        req = self.context.get("request")
        if req is not None and not getattr(req.user, "is_superplus", False):
            return self.instance.always_on if self.instance is not None else False
        return value

    def _is_plus(self):
        req = self.context.get("request")
        return req is None or bool(getattr(req.user, "is_superplus", False))

    def validate_locked(self, value):
        """Only a superadmin+ says that a link has to be opened with a password first."""
        if not self._is_plus():
            return self.instance.locked if self.instance is not None else False
        return value

    def validate_lock_password(self, value):
        if value and not self._is_plus():
            raise serializers.ValidationError("Alleen een superadmin+ kan het wachtwoord instellen.")
        if value and len(value) < 8:
            raise serializers.ValidationError("Kies een wachtwoord van minstens 8 tekens.")
        return value

    def validate(self, attrs):
        inst = self.instance
        locked = attrs.get("locked", inst.locked if inst is not None else False)
        if locked and not attrs.get("lock_password") and not (inst is not None and inst.lock_password):
            raise serializers.ValidationError({"lock_password": "Kies een wachtwoord om de koppeling mee te openen."})
        if inst is not None and attrs.get("enabled") is False and attrs.get("always_on", inst.always_on):
            raise serializers.ValidationError({"enabled": "Deze koppeling staat altijd aan (nodig voor de installatie). Zet eerst Altijd aan uit."})
        return super().validate(attrs)

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
        req = self.context.get("request")
        data["locked"] = bool(obj.locked)
        data["unlocked"] = bool(req is not None and lock.is_open(req.user, obj))
        if obj.locked and not data["unlocked"]:  # a closed card: nothing of the link is shown until it is opened with its password
            return {k: data[k] for k in ("id", "name", "slug", "provider", "provider_label", "enabled", "superadmin_only", "in_installation", "always_on", "locked", "unlocked")} | {
                "config": {}, "last_test_ok": data.get("last_test_ok"), "last_test_at": None, "last_test_message": ""}
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

    def _lock(self, validated, obj=None):
        """The typed password is kept as a hash; a link that is no longer locked loses its password."""
        raw = validated.pop("lock_password", "")
        if raw:
            validated["lock_password"] = lock.hash_password(raw)
        if validated.get("locked") is False:
            validated["lock_password"] = ""

    def create(self, validated):
        config = validated.pop("config", {})
        self._lock(validated)
        obj = Integration(**validated)
        obj.config = self._merge(obj.provider, {}, config)
        obj.save()
        return obj

    def update(self, instance, validated):
        config = validated.pop("config", None)
        self._lock(validated, instance)
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

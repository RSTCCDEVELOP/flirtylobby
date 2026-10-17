import re

from rest_framework import serializers

from .models import CommAddress

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^\+[1-9]\d{7,14}$")


class CommAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommAddress
        fields = ["id", "kind", "label", "value", "purpose", "enabled", "is_default"]

    def validate(self, attrs):
        kind = attrs.get("kind") or (self.instance.kind if self.instance else None)
        value = (attrs.get("value") or (self.instance.value if self.instance else "")).strip().replace(" ", "")
        if kind == "mobile":
            if not PHONE_RE.match(value):
                raise serializers.ValidationError({"value": "Gebruik een nummer met landcode, bv. +31612345678."})
        elif not EMAIL_RE.match(value):
            raise serializers.ValidationError({"value": "Ongeldig e-mailadres."})
        attrs["value"] = value.lower() if kind != "mobile" else value
        return attrs

    def _clear_other_defaults(self, obj):
        if obj.is_default:
            CommAddress.objects.filter(kind=obj.kind).exclude(pk=obj.pk).update(is_default=False)

    def create(self, validated):
        # the first address of a kind becomes its default
        if not CommAddress.objects.filter(kind=validated["kind"]).exists():
            validated["is_default"] = True
        obj = super().create(validated)
        self._clear_other_defaults(obj)
        return obj

    def update(self, instance, validated):
        validated.pop("kind", None)  # a kind cannot change
        obj = super().update(instance, validated)
        self._clear_other_defaults(obj)
        return obj

# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.security.words import validate_no_forbidden_words

from .models import Role, User, UserGroup
from .perms import KEYS

PROFILE_FIELDS = ["first_name", "last_name", "display_name", "birth_date", "gender", "phone", "address", "postal_code", "city", "country", "function", "short", "description", "link", "link_external"]
WORD_FIELDS = ["first_name", "last_name", "display_name", "address", "city", "function", "role", "short", "description"]
WORD_KWARGS = {f: {"validators": [validate_no_forbidden_words]} for f in WORD_FIELDS}


class UserSerializer(serializers.ModelSerializer):
    """Full user, used by the (staff only) users module. """

    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])
    roles = serializers.PrimaryKeyRelatedField(many=True, queryset=Role.objects.all(), required=False)
    user_groups = serializers.PrimaryKeyRelatedField(many=True, queryset=UserGroup.objects.all(), required=False)
    is_fake = serializers.SerializerMethodField()

    def get_is_fake(self, u):
        return u.username.startswith("fake_")

    class Meta:
        model = User
        fields = ["id", "is_fake", "email", "role", "roles", "user_groups", "is_active", "is_staff", "last_login", "date_joined", "password", "otp_active", "twofa_method", "twofa_required", "image", "show_public", "verification"] + PROFILE_FIELDS
        read_only_fields = ["is_fake", "last_login", "date_joined", "otp_active", "twofa_method", "image"]
        extra_kwargs = {"email": {"required": True}, **WORD_KWARGS}

    def validate_description(self, value):  # the small editor: a few safe tags only
        from apps.core.richtext import clean_small

        return clean_small(value)

    def validate_email(self, value):
        value = value.lower()
        qs = User.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Dit e-mailadres is al in gebruik.")
        return value

    def validate(self, attrs):
        # users.manage without being a beheerder must not be able to escalate privileges
        actor = self.context["request"].user
        if not actor.is_staff:
            if attrs.get("is_staff"):
                raise serializers.ValidationError({"is_staff": "Alleen superadmins kunnen superadmins aanmaken."})
            if self.instance and self.instance.is_staff:
                raise serializers.ValidationError("Je mag superadmins niet wijzigen.")
            mine = actor.permission_keys()
            for r in attrs.get("roles", []):
                if not r.keys() <= mine:
                    raise serializers.ValidationError({"roles": f"Je mag de rol '{r.name}' niet toekennen (meer rechten dan jijzelf)."})
            for g in attrs.get("user_groups", []):
                if any(not r.keys() <= mine for r in g.roles.all()):
                    raise serializers.ValidationError({"user_groups": f"Je mag de groep '{g.name}' niet toekennen (meer rechten dan jijzelf)."})
        return attrs

    def create(self, validated_data):
        roles = validated_data.pop("roles", [])
        groups = validated_data.pop("user_groups", [])
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "Wachtwoord is verplicht."})
        user = User(username=validated_data["email"], **validated_data)
        user.set_password(password)
        user.save()
        user.roles.set(roles)
        user.user_groups.set(groups)
        return user

    def update(self, instance, validated_data):
        roles = validated_data.pop("roles", None)
        groups = validated_data.pop("user_groups", None)
        password = validated_data.pop("password", None)
        if "email" in validated_data:
            instance.username = validated_data["email"]
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if password:
            instance.set_password(password)
        instance.save()
        if roles is not None:
            instance.roles.set(roles)
        if groups is not None:
            instance.user_groups.set(groups)
        return instance


class ProfileSerializer(serializers.ModelSerializer):
    """What a user may change about themselves."""

    twofa = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    module_levels = serializers.SerializerMethodField()

    def get_module_levels(self, obj):
        from .access import levels

        return levels(obj)

    def get_permissions(self, obj):
        return sorted(obj.permission_keys())

    def get_roles(self, obj):
        return [{"id": r.id, "name": r.name} for r in obj.all_roles()]

    def get_twofa(self, obj):
        from apps.security.twofa import state

        return state(obj)

    def validate_phone(self, value):
        import re

        from apps.security.twofa import PHONE_RE

        value = re.sub(r"[ \-()]", "", value or "")
        if value and not PHONE_RE.match(value):
            raise serializers.ValidationError("Geef een telefoonnummer met landcode, bv. +31612345678.")
        u = self.instance
        if u and u.otp_active and u.twofa_method == "sms" and value != u.phone:
            raise serializers.ValidationError("Dit nummer is je 2-stapsverificatie-nummer. Wijzig het via je beveiligingsinstellingen.")
        return value

    def validate_country(self, value):
        from apps.security.countries import COUNTRY_CODES

        value = (value or "").strip().upper()
        if value and value not in COUNTRY_CODES:
            raise serializers.ValidationError("Onbekend land.")
        return value

    def validate_postal_code(self, value):
        value = (value or "").strip().upper()
        if len(value) > 12 or not all(ch.isalnum() or ch in " -" for ch in value):
            raise serializers.ValidationError("Ongeldige postcode.")
        return value

    def validate_gender(self, value):
        from apps.plugins import facade

        genders = facade.mod("community", "service").genders() if facade.mod("community", "service") else ("m", "f", "x")
        if value not in ("", *genders) and value != getattr(self.instance, "gender", None):
            raise serializers.ValidationError("Ongeldig geslacht.")
        return value

    def validate_birth_date(self, value):
        from datetime import date

        if value and (value > date.today() or value.year < 1900):
            raise serializers.ValidationError("Ongeldige geboortedatum.")
        from apps.security.service import underage_message

        if msg := underage_message(value):
            raise serializers.ValidationError(msg)
        return value

    def update(self, instance, validated):
        user = super().update(instance, validated)
        prof = getattr(user, "profile", None)  # keep the dating profile in step
        if prof and ("gender" in validated or "birth_date" in validated):
            prof.gender, prof.birth_date = user.gender, user.birth_date
            prof.save(update_fields=["gender", "birth_date"])
        if prof and ("city" in validated or "country" in validated) and (prof.city, prof.country) != (user.city, user.country):
            from apps.plugins import facade

            geocode = facade.mod("community", "geocode")

            prof.city, prof.country = user.city, user.country  # the community profile uses the same place (distance search)
            try:
                c = geocode.geocode(prof.city, prof.country) if geocode else None
            except Exception:  # noqa: BLE001 - never fail a profile save on a lookup
                c = None
            prof.lat, prof.lon = c if c else (None, None)
            prof.save(update_fields=["city", "country", "lat", "lon"])
        return user

    class Meta:
        model = User
        fields = ["id", "email", "role", "is_staff", "twofa", "email_verified", "permissions", "roles", "module_levels", "image", "show_public", "verification"] + PROFILE_FIELDS
        read_only_fields = ["id", "email", "role", "is_staff", "twofa", "email_verified", "permissions", "roles", "module_levels", "image", "show_public", "verification"]
        extra_kwargs = WORD_KWARGS


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])


class RoleSerializer(serializers.ModelSerializer):
    user_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Role
        fields = ["id", "name", "slug", "description", "permissions", "user_count", "all_permissions", "locked"]
        read_only_fields = ["slug", "all_permissions", "locked"]
        extra_kwargs = {"name": {"validators": [validate_no_forbidden_words]}}

    def validate_permissions(self, value):
        bad = [k for k in value if k not in KEYS]
        if bad:
            raise serializers.ValidationError(f"Onbekend recht: {bad[0]}")
        return sorted(set(value))

    def create(self, validated):
        from django.utils.text import slugify

        base = slugify(validated["name"]) or "rol"
        slug, n = base, 2
        while Role.objects.filter(slug=slug).exists():
            slug, n = f"{base}-{n}", n + 1
        return Role.objects.create(slug=slug, **validated)


class PhotoSerializer(serializers.Serializer):
    image = serializers.ImageField()

    def validate_image(self, f):
        from apps.core.system import limit_mb

        if f.size > limit_mb("max_photo_mb") * 1024 * 1024:
            raise serializers.ValidationError(f"Foto is te groot (maximaal {limit_mb('max_photo_mb')} MB).")
        return f


class UserGroupSerializer(serializers.ModelSerializer):
    roles = serializers.PrimaryKeyRelatedField(many=True, queryset=Role.objects.all(), required=False)
    members = serializers.PrimaryKeyRelatedField(many=True, queryset=User.objects.all(), required=False)
    member_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = UserGroup
        fields = ["id", "name", "slug", "description", "roles", "members", "member_count"]
        read_only_fields = ["slug"]
        extra_kwargs = {"name": {"validators": [validate_no_forbidden_words]}}

    def validate(self, attrs):
        actor = self.context["request"].user
        if not actor.is_staff:
            mine = actor.permission_keys()
            for r in attrs.get("roles", []):
                if not r.keys() <= mine:
                    raise serializers.ValidationError({"roles": f"Je mag de rol '{r.name}' niet koppelen (meer rechten dan jijzelf)."})
            if any(u.is_staff for u in attrs.get("members", [])):
                raise serializers.ValidationError({"members": "Superadmins kun je niet beheren."})
        return attrs

    def _save(self, instance, validated, create):
        roles, members = validated.pop("roles", None), validated.pop("members", None)
        if create:
            from django.utils.text import slugify

            base = slugify(validated["name"]) or "groep"
            slug, n = base, 2
            while UserGroup.objects.filter(slug=slug).exists():
                slug, n = f"{base}-{n}", n + 1
            instance = UserGroup.objects.create(slug=slug, **validated)
        else:
            for k, v in validated.items():
                setattr(instance, k, v)
            instance.save()
        if roles is not None:
            instance.roles.set(roles)
        if members is not None:
            instance.members.set(members)
        return instance

    def create(self, validated):
        return self._save(None, validated, True)

    def update(self, instance, validated):
        return self._save(instance, validated, False)

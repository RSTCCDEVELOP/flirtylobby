from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.security.words import validate_no_forbidden_words

from .models import Role, User, UserGroup
from .perms import KEYS

PROFILE_FIELDS = ["first_name", "last_name", "function", "short", "description", "link", "link_external"]
WORD_FIELDS = ["first_name", "last_name", "function", "role", "short", "description"]
WORD_KWARGS = {f: {"validators": [validate_no_forbidden_words]} for f in WORD_FIELDS}


class UserSerializer(serializers.ModelSerializer):
    """Full user, used by the (staff only) users module."""

    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])
    roles = serializers.PrimaryKeyRelatedField(many=True, queryset=Role.objects.all(), required=False)
    user_groups = serializers.PrimaryKeyRelatedField(many=True, queryset=UserGroup.objects.all(), required=False)

    class Meta:
        model = User
        fields = ["id", "email", "role", "roles", "user_groups", "is_active", "is_staff", "last_login", "date_joined", "password", "otp_active", "twofa_method", "image", "show_public"] + PROFILE_FIELDS
        read_only_fields = ["last_login", "date_joined", "otp_active", "twofa_method", "image"]
        extra_kwargs = {"email": {"required": True}, **WORD_KWARGS}

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

    class Meta:
        model = User
        fields = ["id", "email", "role", "is_staff", "twofa", "permissions", "roles", "module_levels", "image", "show_public"] + PROFILE_FIELDS
        read_only_fields = ["id", "email", "role", "is_staff", "twofa", "permissions", "roles", "module_levels", "image", "show_public"]
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
        if f.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Foto is te groot (maximaal 5 MB).")
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

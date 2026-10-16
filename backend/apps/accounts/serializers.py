from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User

PROFILE_FIELDS = ["first_name", "last_name", "function", "short", "description", "link", "link_external"]


class UserSerializer(serializers.ModelSerializer):
    """Full user, used by the (staff only) users module."""

    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])

    class Meta:
        model = User
        fields = ["id", "email", "role", "is_active", "is_staff", "last_login", "date_joined", "password"] + PROFILE_FIELDS
        read_only_fields = ["last_login", "date_joined"]
        extra_kwargs = {"email": {"required": True}}

    def validate_email(self, value):
        value = value.lower()
        qs = User.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Dit e-mailadres is al in gebruik.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "Wachtwoord is verplicht."})
        user = User(username=validated_data["email"], **validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        if "email" in validated_data:
            instance.username = validated_data["email"]
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class ProfileSerializer(serializers.ModelSerializer):
    """What a user may change about themselves."""

    class Meta:
        model = User
        fields = ["id", "email", "role", "is_staff"] + PROFILE_FIELDS
        read_only_fields = ["id", "email", "role", "is_staff"]


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])

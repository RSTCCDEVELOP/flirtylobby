from rest_framework import serializers

from apps.accounts.models import User


class MemberSerializer(serializers.ModelSerializer):
    """Public view of a user with a public profile. Never exposes e-mail or account details."""

    name = serializers.SerializerMethodField()
    image = serializers.ImageField(read_only=True)

    def get_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.email.split("@")[0]

    class Meta:
        model = User
        fields = ["id", "name", "image", "function", "short", "description", "link", "link_external"]

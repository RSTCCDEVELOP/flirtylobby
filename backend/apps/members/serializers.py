# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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

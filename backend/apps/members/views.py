from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from apps.accounts.models import User
from apps.core.modules import module_required

from .serializers import MemberSerializer


class MembersViewSet(viewsets.ReadOnlyModelViewSet):
    """Public list of users that are shown on the website (Admin -> Gebruikers -> 'Tonen op de website')."""

    queryset = User.objects.filter(show_public=True, is_active=True).order_by("last_name", "first_name", "id")
    serializer_class = MemberSerializer
    permission_classes = [AllowAny, module_required("users")]

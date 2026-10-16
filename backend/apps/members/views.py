from rest_framework import viewsets
from rest_framework.permissions import SAFE_METHODS, BasePermission, IsAdminUser

from .models import Members
from .serializers import MembersSerializer


class ReadOnlyOrStaff(BasePermission):
    """Anyone may read members; only staff may create, change or delete."""

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or IsAdminUser().has_permission(request, view)


class MembersViewSet(viewsets.ModelViewSet):
    queryset = Members.objects.all().order_by("name")
    serializer_class = MembersSerializer
    permission_classes = [ReadOnlyOrStaff]

from rest_framework.routers import DefaultRouter

from .views import MembersViewSet

router = DefaultRouter()
router.register("members", MembersViewSet, basename="members")
urlpatterns = router.urls

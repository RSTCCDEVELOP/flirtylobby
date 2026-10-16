from rest_framework.routers import DefaultRouter

from .views import CommAddressViewSet

router = DefaultRouter()
router.register("communication", CommAddressViewSet, basename="communication")
urlpatterns = router.urls

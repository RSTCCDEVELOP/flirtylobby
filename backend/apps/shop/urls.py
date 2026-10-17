from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("shop/admin/orders", views.OrderViewSet, basename="shop-orders")

urlpatterns = [
    path("shop/admin/settings/", views.settings_admin),
    path("shop/orders/<str:number>/", views.public_order),
] + router.urls

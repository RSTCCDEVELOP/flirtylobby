from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("shop/admin/groups", views.ProductGroupViewSet, basename="shop-groups")
router.register("shop/admin/products", views.ProductViewSet, basename="shop-products")
router.register("shop/admin/orders", views.OrderViewSet, basename="shop-orders")
router.register("shop/admin/methods", views.ShippingMethodViewSet, basename="shop-methods")
router.register("shop/admin/discounts", views.DiscountCodeViewSet, basename="shop-discounts")

urlpatterns = [
    path("shop/admin/settings/", views.settings_admin),
    path("shop/groups/", views.public_groups),
    path("shop/products/", views.public_products),
    path("shop/products/<slug:slug>/", views.public_product),
    path("shop/cart/", views.cart_lines),
    path("shop/config/", views.public_config),
    path("shop/methods/", views.public_methods),
    path("shop/quote/", views.public_quote),
    path("shop/orders/", views.create_order),
    path("shop/orders/<str:number>/", views.public_order),
] + router.urls

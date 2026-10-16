from django.urls import path

from . import views

urlpatterns = [
    path("pages/menu/", views.menu),
    path("pages/state/", views.public_state),
    path("pages/backgrounds/", views.backgrounds),
    path("pages/public/<slug:key>/", views.public_page),
    path("pages/order/", views.menu_order),
    path("pages/", views.pages),
    path("pages/<int:pk>/", views.page),
]

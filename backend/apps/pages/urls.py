from django.urls import path

from . import views

from . import layout as page_layout

urlpatterns = [
    path("pages/layout/<str:key>/preset/", page_layout.preset),
    path("pages/layout/<str:key>/", page_layout.layout),
    path("pages/menu/", views.menu),
    path("pages/private-menu/", views.private_menu),
    path("pages/state/", views.public_state),
    path("pages/backgrounds/", views.backgrounds),
    path("pages/public/<slug:key>/", views.public_page),
    path("pages/by-url/", views.by_url),
    path("pages/aliases/", views.aliases),
    path("pages/order/", views.menu_order),
    path("pages/", views.pages),
    path("pages/<int:pk>/", views.page),
]

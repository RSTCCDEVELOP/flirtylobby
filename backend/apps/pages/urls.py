# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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
    path("pages/setup/<str:key>/", views.page_setup),
    path("pages/aliases/", views.aliases),
    path("pages/order/", views.menu_order),
    path("pages/translate/", views.translate),
    path("pages/menu-settings/", views.menu_settings),
    path("pages/import/", views.import_page),
    path("pages/export/", views.export_pages),
    path("pages/<int:pk>/export/", views.export_page),
    path("pages/<int:pk>/translate-all/", views.translate_page),
    path("pages/<int:pk>/reset/", views.reset_page),
    path("pages/", views.pages),
    path("pages/<int:pk>/", views.page),
]

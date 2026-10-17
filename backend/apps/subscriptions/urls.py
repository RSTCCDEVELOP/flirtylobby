from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("subscriptions/admin/plans", views.PlanViewSet, basename="sub-plans")
router.register("subscriptions/admin/members", views.SubscriptionViewSet, basename="sub-members")
router.register("subscriptions/admin/campaigns", views.CampaignViewSet, basename="sub-campaigns")

urlpatterns = [
    path("subscriptions/admin/settings/", views.settings_admin),
    path("subscriptions/admin/options/", views.options),
    path("subscriptions/admin/stats/", views.stats),
    path("subscriptions/admin/give/", views.give),
    path("subscriptions/admin/donations/", views.donations_admin),
    path("subscriptions/admin/campaigns/ai/", views.campaign_ai),
    path("subscriptions/admin/campaigns/ai-text/", views.campaign_ai_text),
    path("subscriptions/plans/", views.plans_public),
    path("subscriptions/subscribe/", views.subscribe),
    path("subscriptions/me/", views.me),
    path("subscriptions/me/<int:pk>/<str:act>/", views.me_action),
    path("subscriptions/access/", views.access),
    path("donations/campaigns/", views.campaigns_public),
    path("donations/donate/", views.donate),
] + router.urls

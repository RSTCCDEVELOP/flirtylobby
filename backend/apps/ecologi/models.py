# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Ecologi (planting trees): the settings of the management screens (Super admin) and the log of every order."""
from django.conf import settings
from django.db import models


class EcologiSettings(models.Model):
    """One row. The API key itself is in the link "Ecologi" (Admin -> API keys); the choices of the management screens are here."""

    test_mode = models.BooleanField(default=True)  # new orders are test orders (Ecologi answers like a real order, nothing is bought): switch off to really plant
    local = models.BooleanField(default=False)  # local planting (a country of your choice) instead of the standard planting
    country = models.CharField(max_length=2, default="UK")  # for local planting: UK | US | AU | BR
    name = models.CharField(max_length=120, blank=True)  # shown with the trees as "funded by" (public when the Ecologi profile is public)
    max_per_order = models.PositiveIntegerField(default=100)  # a safety limit: more trees in one order are refused
    monthly_trees = models.PositiveIntegerField(default=0)  # automatically plant this many trees once a month (0 = off)
    last_auto_month = models.CharField(max_length=7, blank=True)  # "2026-11": the month the automatic planting was done
    # the contributions (once a month the previous month is settled): visitors, the machine, easy2edit and the user
    auto_on = models.BooleanField(default=False)  # the monthly settlement is on
    cap_trees_month = models.PositiveIntegerField(default=100)  # the most trees the automatic contributions plant per month (0 = no limit)
    visitors_on = models.BooleanField(default=False)  # 1. use of the website by visitors: one tree for every `visitors_per` page views
    visitors_per = models.PositiveIntegerField(default=1000)
    machine_on = models.BooleanField(default=False)  # 2. the machine (energy use of the page views): trees to compensate the estimated CO2, one tree per `machine_kg` kg
    machine_kg = models.PositiveIntegerField(default=22)
    e2e_trees = models.PositiveIntegerField(default=1)  # 3. use of easy2edit, paid by easy2edit: trees per month that easy2edit plants for this website (only shown here: it is planted by easy2edit itself)
    admin_enabled = models.BooleanField(default=False)  # 4. use of easy2edit, paid by the user: the administrator may set his own monthly gift and give trees (Admin -> Systeem -> Bomen en giften)
    admin_trees = models.PositiveIntegerField(default=0)  # the monthly gift of the administrator
    admin_max_trees = models.PositiveIntegerField(default=25)  # the most trees the administrator may give per gift and per month
    admin_name = models.CharField(max_length=120, blank=True)
    admin_funcs = models.JSONField(default=dict, blank=True)  # the functions of easy2edit the administrator plants trees for: {key: {"on": bool, "per": n}}
    admin_max_eur = models.DecimalField(max_digits=8, decimal_places=2, default=0)  # the most the administrator wants to spend per month on his own trees (0 = no limit)
    show_on_site = models.BooleanField(default=True)  # the number of planted trees is shown in the window of the energy label of the website

    @classmethod
    def load(cls):
        return cls.objects.get_or_create(pk=1)[0]


class TreeOrder(models.Model):
    """One order at Ecologi (also a test order or a refused one): what was asked and what Ecologi answered."""

    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    number = models.PositiveIntegerField()
    local = models.BooleanField(default=False)
    country = models.CharField(max_length=2, blank=True)
    name = models.CharField(max_length=120, blank=True)
    test = models.BooleanField(default=False)
    status = models.CharField(max_length=10, default="ok")  # ok | failed
    source = models.CharField(max_length=10, default="hand")  # hand | auto
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)  # what Ecologi says it costs
    currency = models.CharField(max_length=5, blank=True)
    tree_url = models.CharField(max_length=300, blank=True)
    response = models.JSONField(default=dict, blank=True)
    error = models.CharField(max_length=300, blank=True)
    key = models.CharField(max_length=40, blank=True)  # the idempotency key that was sent (a retry of the same order cannot buy twice)

    class Meta:
        ordering = ["-created_at"]

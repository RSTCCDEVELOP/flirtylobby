# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The currency of the website (Basisgegevens): euro by default, a list to choose from, one value for shop, donations and subscriptions."""
import pytest

from apps.core import system


@pytest.mark.django_db
def test_currency_default_euro_and_validation():
    assert system.currency() == "EUR" and system.public()["currency"] == "EUR"
    _, errors = system.clean({"currency": "xyz"})
    assert "currency" in errors
    cleaned, errors = system.clean({"currency": "usd"})
    assert cleaned["currency"] == "USD" and not errors


@pytest.mark.django_db
def test_commerce_uses_the_site_currency():
    from apps import commerce

    assert commerce.settings()["currency"] == "EUR"
    system.save({"currency": "GBP"})
    assert system.currency() == "GBP" and commerce.settings()["currency"] == "GBP"

# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""How long a code is valid (the round timer next to every code input)."""
import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_the_lifetimes_of_the_codes_are_public_and_in_seconds():
    r = APIClient().get("/api/system/code-lifetimes/")
    assert r.status_code == 200
    d = r.json()
    assert set(d) == {"twofa", "registration", "terms", "owner"} and all(isinstance(v, int) and v >= 60 for v in d.values())

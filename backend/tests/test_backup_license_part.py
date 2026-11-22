# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net
import json

import pytest

from apps.backups import full, service
from apps.core.models import License


def test_with_license_adds_the_part_for_old_backups():
    parts = service.with_license([{"key": "data", "label": "x"}, {"key": "site", "label": "y"}])
    assert [p["key"] for p in parts] == ["data", "license", "site"]
    assert service.with_license(parts) == parts


@pytest.mark.django_db
def test_load_only_and_skip_license():
    License.objects.update_or_create(pk=1, defaults={"number": "OLD-1", "client": "A"})
    raw = full.dump()
    License.objects.filter(pk=1).update(number="NEW-2")
    full.load(raw, skip=service.LICENSE_MODELS)
    assert License.objects.get(pk=1).number == "NEW-2"
    full.load(raw, only=service.LICENSE_MODELS)
    assert License.objects.get(pk=1).number == "OLD-1"

# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

from .models import CommAddress


def sender(kind, purpose=None):
    """Best matching enabled address for `kind`: purpose match first, then the default, then any."""
    qs = CommAddress.objects.filter(kind=kind, enabled=True)
    for q in ([qs.filter(purpose=purpose)] if purpose else []) + [qs.filter(purpose="all", is_default=True), qs.filter(is_default=True), qs]:
        obj = q.first()
        if obj:
            return obj.value
    return None

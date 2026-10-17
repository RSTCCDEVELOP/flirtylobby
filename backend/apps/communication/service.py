from .models import CommAddress


def sender(kind, purpose=None):
    """Best matching enabled address for `kind`: purpose match first, then the default, then any."""
    qs = CommAddress.objects.filter(kind=kind, enabled=True)
    for q in ([qs.filter(purpose=purpose)] if purpose else []) + [qs.filter(purpose="all", is_default=True), qs.filter(is_default=True), qs]:
        obj = q.first()
        if obj:
            return obj.value
    return None

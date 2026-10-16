import re

from rest_framework import serializers

from . import service


def find_forbidden(text):
    """Forbidden words (any language list) found in text."""
    cfg = service.get()["words"]
    if not cfg["enabled"] or not text:
        return []
    hay = str(text).lower()
    found = set()
    for words in cfg["lists"].values():
        for w in words:
            pattern = rf"(?<!\w){re.escape(w)}(?!\w)" if re.fullmatch(r"\w+", w, re.ASCII) else re.escape(w)
            if re.search(pattern, hay):
                found.add(w)
    return sorted(found)


def validate_no_forbidden_words(value):
    found = find_forbidden(value)
    if found:
        raise serializers.ValidationError(f"Bevat niet toegestane woorden: {', '.join(found)}.")
    return value

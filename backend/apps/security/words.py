# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

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
        for w in found:
            __import__("apps.stats.service", fromlist=["record"]).record("word_filter", "blocked", w)
        raise serializers.ValidationError(f"Bevat niet toegestane woorden: {', '.join(found)}.")
    return value

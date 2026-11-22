# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""THE rule for phone numbers: always with a country code ("+31 6 12345678"). One check for every form (basic data, standard reseller, entity, wizard ...)."""
import re

MESSAGE = "Een telefoonnummer heeft altijd een landnummer, bv. +31 6 12345678."
INVALID = "Dit telefoonnummer is ongeldig."


def check(v, limit=30):
    """-> (the number as it is stored: spaces tidied, or "" when empty, an error text or ""). Only a country code (no number) counts as empty."""
    v = " ".join(str(v or "").split())[:limit]
    digits = re.sub(r"\D", "", v)
    if not v or (v.startswith("+") and len(digits) <= 3):
        return "", ""
    if not v.startswith("+"):
        return v, MESSAGE
    if not (re.fullmatch(r"\+[\d\s().-]+", v) and 8 <= len(digits) <= 15):
        return v, INVALID
    return v, ""


def valid(v):
    return not check(v)[1]

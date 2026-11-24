# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The password format of Apple: tuntod-jeznyt-6kukmY."""
import re

from apps.accounts import passgen


def test_the_format_is_three_groups_with_one_digit_and_one_capital():
    seen = set()
    for _ in range(500):
        p = passgen.generate()
        seen.add(p)
        assert re.fullmatch(r"[a-zA-Z0-9]{6}(-[a-zA-Z0-9]{6}){2}", p) and len(p) == 20
        assert sum(c.isdigit() for c in p) == 1 and sum(c.isupper() for c in p) == 1
        assert not re.search(r"[aeiouy]{3}", p.lower())  # (it can be said: consonant, vowel, consonant ...)
    assert len(seen) == 500


def test_the_reseller_passwords_use_it():
    from apps.core import resellers

    assert re.fullmatch(r"[a-zA-Z0-9]{6}(-[a-zA-Z0-9]{6}){2}", resellers.new_password())

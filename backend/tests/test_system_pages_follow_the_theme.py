# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The system pages (login, invitation, maintenance, errors ...) follow the theme that is set: their backgrounds are made from the colours of the theme, never from fixed colours."""
import re
from pathlib import Path

CSS = (Path(__file__).resolve().parents[2] / "frontend" / "app" / "globals.css").read_text(encoding="utf-8")


def _values(name):
    return re.findall(rf"^\s*{re.escape(name)}:\s*([^;]+);", CSS, re.M)


def test_the_login_background_is_made_from_the_colours_of_the_theme():
    found = _values("--login-bg")
    assert len(found) == 2  # light and dark
    for v in found:
        assert "var(--blue)" in v and "var(--orange)" in v and "var(--page" in v, v  # primary, secondary and the page colour of the theme
        assert not re.search(r"#[0-9a-fA-F]{3,8}\b", v.split("/*")[0]), v  # no fixed colour


def test_the_pages_around_the_login_use_the_colours_of_the_theme():
    for rule in (r"\.site \{[^}]*background: var\(--page\)", r"\.shell \{[^}]*background: var\(--bg\)", r"\.maintenance \{[^}]*background: var\(--page", r"\.login-page \{[^}]*background: var\(--login-bg\)"):
        assert re.search(rule, CSS), rule

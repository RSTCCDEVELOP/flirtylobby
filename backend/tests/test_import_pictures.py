# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Pictures that a page design gives as an https address are fetched at the import (safe: public addresses only, checked content, all or nothing)."""
import io
import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from PIL import Image

from apps.core import imagefetch, pagevalidate as pv
from apps.core.models import SiteDesignJob
from apps.medialib.models import MediaItem

DIR = Path(pv.__file__).parent / "pagina_formaat"


def png():
    b = io.BytesIO()
    Image.new("RGB", (8, 8), "#336699").save(b, "PNG")
    return b.getvalue()


def design(url="https://cdn.example.com/etalage.png"):
    doc = json.loads((DIR / "voorbeeld-geldig.json").read_text())
    pics = pv._doc_pictures(doc)
    assert pics, "the example has a picture"
    pics[0][1]["src"] = url
    return doc


def with_second_picture(doc, url):
    """A copy of the first block with an own id and its picture at another address (the example itself has one picture)."""
    import copy

    n = copy.deepcopy(doc["inhoud"][0])
    n["id"] = n["id"] + "-b"
    doc["inhoud"].insert(1, n)
    pics = pv._doc_pictures({"inhoud": [n]})
    pics[0][1]["src"] = url
    return doc


@pytest.fixture
def boss(db):
    return get_user_model().objects.create(username="boss", email="b@example.com", is_staff=True, is_superuser=True)


def test_an_https_picture_is_fetched_once_put_in_the_library_and_the_design_points_at_it(boss, monkeypatch):
    calls = []
    monkeypatch.setattr(imagefetch, "fetch", lambda url: (calls.append(url), (png(), "png"))[1])
    doc = design()
    with_second_picture(doc, "https://cdn.example.com/etalage.png")  # the same address twice: fetched once
    reports, job = pv.import_documents(boss, {"paginas": [doc]})
    assert job and all(r["geldig"] for r in reports)
    assert calls == ["https://cdn.example.com/etalage.png"]
    photo = job.brief["photos"][0]
    assert photo["file"] == "import-1.png" and "img/import-1.png" in job.files["index.html"] and "https://cdn.example.com" not in job.files["index.html"]
    item = MediaItem.objects.get(pk=photo["id"])
    assert item.tags == ["design", "import"] and item.kind == "image"


def test_a_picture_that_can_not_be_fetched_stops_the_whole_import_and_leaves_nothing_behind(boss, monkeypatch):
    def boom(url):
        raise imagefetch.FetchError("De server gaf geen antwoord.")

    monkeypatch.setattr(imagefetch, "fetch", boom)
    reports, job = pv.import_documents(boss, {"paginas": [design()]})
    assert job is None and not reports[0]["geldig"]
    m = [x for x in reports[0]["meldingen"] if x["code"] == "MEDIA_OPHALEN"]
    assert m and m[0]["ernst"] == "fout" and m[0]["pad"].endswith("/src") and m[0]["pad"].startswith("/")
    assert SiteDesignJob.objects.count() == 0 and MediaItem.objects.count() == 0


def test_when_the_second_picture_fails_the_first_is_taken_back(boss, monkeypatch):
    doc = design("https://cdn.example.com/een.png")
    with_second_picture(doc, "https://cdn.example.com/twee.png")
    deleted = []

    def one_then_boom(url):
        if url.endswith("twee.png"):
            raise imagefetch.FetchError("De server antwoordde met 404.")
        return png(), "png"

    monkeypatch.setattr(imagefetch, "fetch", one_then_boom)
    from django.core.files.storage import default_storage

    real = default_storage.delete
    monkeypatch.setattr(default_storage, "delete", lambda k: (deleted.append(k), real(k))[1])
    reports, job = pv.import_documents(boss, {"paginas": [doc]})
    assert job is None and len(deleted) == 1 and MediaItem.objects.count() == 0


def test_the_validator_wants_https(db):
    doc = design("http://cdn.example.com/etalage.png")
    report, _ = pv.validate(doc)
    assert any(m["code"] == "MEDIA_BRON" and "https" in m["melding"] for m in report["meldingen"])


@pytest.mark.parametrize("ip", ["127.0.0.1", "10.0.0.5", "192.168.1.9", "169.254.169.254", "172.16.0.1", "::1", "fe80::1", "0.0.0.0", "::ffff:127.0.0.1"])
def test_addresses_of_this_machine_or_the_local_network_are_never_fetched(monkeypatch, ip):
    monkeypatch.setattr(imagefetch.socket, "getaddrinfo", lambda *a, **k: [(2, 1, 6, "", (ip, 443))])
    with pytest.raises(imagefetch.FetchError):
        imagefetch.public_addresses("evil.example.com")


def test_one_private_address_among_public_ones_is_enough_to_refuse(monkeypatch):
    monkeypatch.setattr(imagefetch.socket, "getaddrinfo", lambda *a, **k: [(2, 1, 6, "", ("93.184.216.34", 443)), (2, 1, 6, "", ("10.0.0.1", 443))])
    with pytest.raises(imagefetch.FetchError):
        imagefetch.public_addresses("mixed.example.com")


class Res:
    def __init__(self, status, body=b"", headers=None):
        self.status, self._b, self._h = status, body, headers or {}

    def read(self, n=None):
        return self._b[:n]

    def getheader(self, k):
        return self._h.get(k)


def opener_for(answers):
    """A fake connection class that answers in turn (and notes the hosts)."""
    seen = []

    class Conn:
        def __init__(self, host, ip, timeout=None):
            seen.append((host, ip))

        def request(self, *a, **k):
            pass

        def getresponse(self):
            return answers.pop(0)

        def close(self):
            pass

    Conn.seen = seen
    return Conn


@pytest.fixture
def public_dns(monkeypatch):
    monkeypatch.setattr(imagefetch.socket, "getaddrinfo", lambda host, *a, **k: [(2, 1, 6, "", ("10.1.1.1" if host == "intern.example.com" else "93.184.216.34", 443))])


def test_fetch_checks_the_scheme_the_port_and_the_content(public_dns):
    for bad in ("http://cdn.example.com/a.png", "https://cdn.example.com:8443/a.png", "https://user:pw@cdn.example.com/a.png", "ftp://cdn.example.com/a.png"):
        with pytest.raises(imagefetch.FetchError):
            imagefetch.fetch(bad, opener_for([Res(200, png())]))
    with pytest.raises(imagefetch.FetchError, match="geen JPEG"):
        imagefetch.fetch("https://cdn.example.com/a.png", opener_for([Res(200, b"<svg onload=alert(1)></svg>")]))
    with pytest.raises(imagefetch.FetchError, match="404"):
        imagefetch.fetch("https://cdn.example.com/a.png", opener_for([Res(404)]))
    assert imagefetch.fetch("https://cdn.example.com/a.png", opener_for([Res(200, png())])) == (png(), "png")


def test_a_redirect_is_followed_but_checked_again_and_not_forever(public_dns):
    op = opener_for([Res(302, headers={"Location": "/b.png"}), Res(200, png())])
    assert imagefetch.fetch("https://cdn.example.com/a.png", op)[1] == "png" and [h for h, _ in op.seen] == ["cdn.example.com", "cdn.example.com"]
    with pytest.raises(imagefetch.FetchError, match="intern"):
        imagefetch.fetch("https://cdn.example.com/a.png", opener_for([Res(302, headers={"Location": "https://intern.example.com/x.png"})]))
    with pytest.raises(imagefetch.FetchError, match="te vaak"):
        imagefetch.fetch("https://cdn.example.com/a.png", opener_for([Res(302, headers={"Location": "/a.png"}) for _ in range(5)]))


def test_a_picture_over_the_maximum_is_refused(public_dns):
    with pytest.raises(imagefetch.FetchError, match="te groot"):
        imagefetch.fetch("https://cdn.example.com/a.png", opener_for([Res(200, b"x" * (imagefetch.MAX_BYTES + 5))]))

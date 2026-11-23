# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Fetching the pictures of a page design that are given as an https address (format easy2edit-pagina@1, import).

Safe by design (the address comes from a design, so from outside): only https on port 443, the name is looked up here and every address must be a public one
(never the machine itself, the local network or a cloud metadata address), the connection goes to the address that was checked (no second lookup), a redirect
is followed at most 3 times and checked again, a picture can be 8 MB, the answer must really be a JPEG, PNG, WEBP or GIF (checked with Pillow, never trusted from the header).
"""
import http.client
import io
import ipaddress
import socket
import ssl
import uuid
from datetime import date
from urllib.parse import urljoin, urlsplit

MAX_BYTES = 8_000_000
MAX_TOTAL = 40_000_000
MAX_REDIRECTS = 3
TIMEOUT = 15
FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp", "GIF": "gif"}


class FetchError(Exception):
    """The picture could not be fetched; the message is for the person who imports (Dutch, like the rest of the report)."""


def public_addresses(host):
    """The addresses of a name, only when ALL of them are public ones; else a FetchError."""
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except OSError:
        raise FetchError("De naam van de server is niet gevonden.")
    out = []
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified or (ip.version == 6 and ip.ipv4_mapped and not ip.ipv4_mapped.is_global):
            raise FetchError("Dit adres verwijst naar een intern netwerk en wordt niet opgehaald.")
        out.append(str(ip))
    if not out:
        raise FetchError("De naam van de server is niet gevonden.")
    return out


class _Pinned(http.client.HTTPSConnection):
    """An https connection to an address that was checked already (the name stays for the certificate and the host header)."""

    def __init__(self, host, ip, **kw):
        super().__init__(host, 443, **kw)
        self._ip = ip

    def connect(self):
        sock = socket.create_connection((self._ip, 443), self.timeout)
        self.sock = ssl.create_default_context().wrap_socket(sock, server_hostname=self.host)


def _get(url, opener=None):
    """One request (no redirects): (status, headers, body up to the maximum + 1 byte)."""
    parts = urlsplit(url)
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password or (parts.port not in (None, 443)):
        raise FetchError("Alleen een https-adres (poort 443) wordt opgehaald.")
    ips = public_addresses(parts.hostname)
    conn = (opener or _Pinned)(parts.hostname, ips[0], timeout=TIMEOUT)
    try:
        path = (parts.path or "/") + (f"?{parts.query}" if parts.query else "")
        conn.request("GET", path, headers={"User-Agent": "easy2edit-import/1.0", "Accept": "image/jpeg,image/png,image/webp,image/gif"})
        res = conn.getresponse()
        body = res.read(MAX_BYTES + 1) if res.status == 200 else b""
        return res.status, res, body
    except (OSError, http.client.HTTPException):
        raise FetchError("De server gaf geen antwoord.")
    finally:
        conn.close()


def fetch(url, opener=None):
    """The bytes and the extension of the picture at an https address, or a FetchError."""
    for _ in range(MAX_REDIRECTS + 1):
        status, res, body = _get(url, opener)
        if status in (301, 302, 303, 307, 308):
            where = res.getheader("Location") or ""
            if not where:
                raise FetchError("De server stuurt door zonder adres.")
            url = urljoin(url, where)
            continue
        if status != 200:
            raise FetchError(f"De server antwoordde met {status}.")
        if len(body) > MAX_BYTES:
            raise FetchError("De afbeelding is te groot (meer dan 8 MB).")
        try:
            from PIL import Image

            im = Image.open(io.BytesIO(body))
            im.verify()
            ext = FORMATS.get(im.format)
        except Exception:  # noqa: BLE001
            ext = None
        if not ext:
            raise FetchError("Dit is geen JPEG-, PNG-, WEBP- of GIF-afbeelding.")
        return body, ext
    raise FetchError("De server stuurt te vaak door.")


def save(data, ext, name, user):
    """Put the picture in the media library (tag design, import). -> the MediaItem. The caller removes it again (storage is not part of a transaction) when the import fails."""
    from django.core.files.base import ContentFile
    from django.core.files.storage import default_storage
    from django.utils.text import get_valid_filename

    from apps.medialib import areas
    from apps.medialib.models import MediaItem

    fname = f"{get_valid_filename(name)[:60] or 'afbeelding'}.{ext}"
    key = default_storage.save(areas.site_path("library", f"{date.today():%Y/%m}/{uuid.uuid4().hex[:8]}-{fname}"), ContentFile(data))
    item = MediaItem.objects.get(key=key)
    item.name, item.uploaded_by, item.tags = fname[:255], user, ["design", "import"]
    item.save(update_fields=["name", "uploaded_by", "tags"])
    return item

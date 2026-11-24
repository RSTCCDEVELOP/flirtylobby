# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""A picture (jpeg) of the top of another website, for the creator: the customer names up to five websites that he likes and the designer looks at them.
Made with a browser without a window (Chrome or Chromium) that is on the server; without one there is no picture and the screen says so. Only public websites: an address that points to this
computer or to an internal network is refused (nobody can use this to look at the inside of the server)."""
import io
import ipaddress
import logging
import os
import shutil
import socket
import subprocess
import tempfile
from urllib.parse import urlparse

logger = logging.getLogger(__name__)
CANDIDATES = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "chrome",
              "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "/usr/bin/chromium", "/usr/bin/google-chrome"]
WIDTH, HEIGHT, OUT_WIDTH = 1280, 1500, 1000
TIMEOUT = 45


class ShotError(ValueError):
    pass


def browser():
    """The path of a Chrome or Chromium on this computer, or ''."""
    env = os.getenv("SITE_SHOT_BROWSER", "").strip()
    if env and shutil.which(env):
        return shutil.which(env)
    for c in CANDIDATES:
        p = shutil.which(c) or (c if os.path.isfile(c) and os.access(c, os.X_OK) else "")
        if p:
            return p
    return ""


def available():
    return bool(browser())


def clean_url(url):
    """A public http(s) address, checked: no login in it, no port other than 80/443, and the host must not be an internal address. Returns the clean address."""
    u = str(url or "").strip()
    if u and "://" not in u:
        u = "https://" + u
    try:
        p = urlparse(u)
        port = p.port
    except ValueError:
        raise ShotError("Dit is geen geldig websiteadres (https://…).")
    if p.scheme not in ("http", "https") or not p.hostname or p.username or p.password or len(u) > 300:
        raise ShotError("Dit is geen geldig websiteadres (https://…).")
    if port not in (None, 80, 443):
        raise ShotError("Alleen de gewone poorten van een website zijn toegestaan.")
    try:
        infos = socket.getaddrinfo(p.hostname, port or (443 if p.scheme == "https" else 80), type=socket.SOCK_STREAM)
    except OSError:
        raise ShotError("Deze website is niet gevonden.")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            raise ShotError("Dit adres is niet openbaar.")
    return u


def capture(url):
    """The jpeg bytes of the top of the website (1000 px wide). Raises ShotError."""
    from PIL import Image

    u = clean_url(url)
    exe = browser()
    if not exe:
        raise ShotError("Op de server is geen browser (Chrome of Chromium) om een afbeelding van een website te maken.")
    with tempfile.TemporaryDirectory() as d:
        png = os.path.join(d, "shot.png")
        cmd = [exe, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--mute-audio", "--no-first-run", f"--user-data-dir={os.path.join(d, 'profile')}",
               f"--window-size={WIDTH},{HEIGHT}", "--virtual-time-budget=8000", f"--screenshot={png}", u]
        try:
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=TIMEOUT, check=False)
        except subprocess.TimeoutExpired:
            raise ShotError("De website reageerde niet op tijd.")
        if not os.path.isfile(png) or os.path.getsize(png) < 2000:
            raise ShotError("Van deze website kon geen afbeelding worden gemaakt.")
        im = Image.open(png).convert("RGB")
        k = OUT_WIDTH / im.width
        im = im.resize((OUT_WIDTH, max(1, int(im.height * k))))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=80, optimize=True)
        return buf.getvalue()

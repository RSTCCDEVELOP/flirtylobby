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
TIMEOUT = 60


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


def clean_url(url, allow_private=False):
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
    if port not in (None, 80, 443) and not allow_private:  # (the own website may run on another port, like 5173 on a development computer)
        raise ShotError("Alleen de gewone poorten van een website zijn toegestaan.")
    try:
        infos = socket.getaddrinfo(p.hostname, port or (443 if p.scheme == "https" else 80), type=socket.SOCK_STREAM)
    except OSError:
        raise ShotError("Deze website is niet gevonden.")
    for info in infos:
        if allow_private:  # (the own website of the installation: only used with an address that the server itself knows)
            break
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            raise ShotError("Dit adres is niet openbaar.")
    return u


def _capture_top(url, allow_private=False):
    """The jpeg bytes of the top of the website (1000 px wide): the simple way, used when the whole page can not be made. Raises ShotError."""
    from PIL import Image

    u = clean_url(url, True) if allow_private else clean_url(url)
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


MAX_PAGE_HEIGHT = 12000  # css pixels of the page that are taken (a very long page is cut off here)


def _cdp_page(url):
    """The whole page as png bytes through the browser without a window, steered with the DevTools protocol (so a picture of the FULL page, not only what fits in a window). Raises ShotError or an Exception."""
    import base64
    import json
    import time

    from websockets.sync.client import connect

    exe = browser()
    with tempfile.TemporaryDirectory() as d:
        prof = os.path.join(d, "profile")
        cmd = [exe, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--mute-audio", "--no-first-run", "--remote-debugging-port=0", f"--user-data-dir={prof}", "about:blank"]
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            port_file = os.path.join(prof, "DevToolsActivePort")
            for _ in range(100):
                if os.path.isfile(port_file) and len(open(port_file).read().split("\n")) >= 2:
                    break
                time.sleep(0.1)
            else:
                raise ShotError("De browser op de server startte niet.")
            port, path = open(port_file).read().split("\n")[:2]
            ws = connect(f"ws://127.0.0.1:{port}{path}", max_size=None, open_timeout=10)
            n = [0]
            sid = [None]

            def call(method, params=None, timeout=TIMEOUT):
                n[0] += 1
                msg = {"id": n[0], "method": method, "params": params or {}}
                if sid[0]:
                    msg["sessionId"] = sid[0]
                ws.send(json.dumps(msg))
                end = time.time() + timeout
                while time.time() < end:
                    try:
                        raw = ws.recv(timeout=max(0.1, end - time.time()))
                    except TimeoutError:
                        break
                    data = json.loads(raw)
                    if data.get("id") == n[0]:
                        if "error" in data:
                            raise ShotError("De browser kon de pagina niet vastleggen.")
                        return data.get("result") or {}
                raise ShotError("De website reageerde niet op tijd.")

            tid = call("Target.createTarget", {"url": "about:blank"})["targetId"]
            sid[0] = call("Target.attachToTarget", {"targetId": tid, "flatten": True})["sessionId"]
            call("Page.enable")
            call("Emulation.setDeviceMetricsOverride", {"width": WIDTH, "height": 900, "deviceScaleFactor": 1, "mobile": False})
            call("Page.navigate", {"url": url})
            end = time.time() + 30  # wait for the page to be loaded
            while time.time() < end:
                try:
                    data = json.loads(ws.recv(timeout=max(0.1, end - time.time())))
                except TimeoutError:
                    break
                if data.get("method") == "Page.loadEventFired":
                    break
            time.sleep(1.5)
            for i in range(1, 9):  # scroll down the page once: pictures that load only when they come into view
                call("Runtime.evaluate", {"expression": f"window.scrollTo(0, {i} * 1100)"})
                time.sleep(0.35)
            call("Runtime.evaluate", {"expression": "window.scrollTo(0, 0)"})
            time.sleep(0.8)
            height = int(call("Page.getLayoutMetrics")["cssContentSize"]["height"])
            height = max(900, min(height, MAX_PAGE_HEIGHT))
            shot = call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True, "clip": {"x": 0, "y": 0, "width": WIDTH, "height": height, "scale": 1}}, timeout=60)
            try:
                call("Browser.close", timeout=3)
            except Exception:  # noqa: BLE001
                pass
            return base64.b64decode(shot["data"])
        finally:
            try:
                proc.kill()
            except Exception:  # noqa: BLE001
                pass


def capture(url, allow_private=False):
    """The jpeg bytes of the WHOLE page of the website (1000 px wide, as high as the page is, at most about 9000 px). When that does not work: the top of the page. Raises ShotError."""
    from PIL import Image

    u = clean_url(url, True) if allow_private else clean_url(url)
    if not browser():
        raise ShotError("Op de server is geen browser (Chrome of Chromium) om een afbeelding van een website te maken.")
    try:
        png = _cdp_page(u)
        im = Image.open(io.BytesIO(png)).convert("RGB")
        if im.height < 300:
            raise ShotError("leeg")
        k = OUT_WIDTH / im.width
        im = im.resize((OUT_WIDTH, max(1, int(im.height * k))))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=78, optimize=True)
        return buf.getvalue()
    except ShotError as e:
        if "reageerde niet" in str(e):
            raise
        logger.warning("whole page picture failed (%s): the top of the page is taken", e)
    except Exception:  # noqa: BLE001
        logger.warning("whole page picture failed: the top of the page is taken", exc_info=True)
    return _capture_top(u, allow_private)

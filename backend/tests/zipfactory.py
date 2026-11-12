# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""A small test ZIP with every edge case of the website import: 47 pictures (limit 40), a 50-character file name, a name with a space and capitals, an svg with a script in an
<img>, a background through a css variable and one through background-image, a page that is only in the footer, a subfolder en/ and a translation file."""
import io
import json
import zipfile

from PIL import Image

LONG = "x" * 50
HEAD = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><meta name="description" content="{desc}">{extra}<link rel="stylesheet" href="style.css"></head>'
NAV = '<header><a href="index.html"><img src="img/logo.svg" alt="Logo" width="40" height="40"></a><nav><a href="index.html">Home</a><a href="about.html">Over ons</a></nav></header>'
FOOT = '<footer><p>Bakkerij Zon</p><a href="contact.html">Contact</a></footer>'

INDEX = (HEAD.format(title="Bakkerij Zon | Vers brood", desc="Verse broden uit de oven.", extra=f'<meta property="og:image" content="img/Social Kaart.png">') + "<body>" + NAV +
         '<main><section id="hero" class="hero"><div class="container"><h1>Vers brood &amp; meer</h1><p>Elke ochtend vers uit de oven.</p><img src="img/Team Foto.jpg" alt="Team"></div></section>'
         f'<section id="band" class="band"><div class="container"><h2>Onze broden</h2><p>Altijd vers.</p><img src="img/{LONG}.png" alt="Lang" srcset="img/{LONG}.png 2x"></div></section>'
         '<section id="nieuw"><div class="container"><h2>Nieuw</h2><p>Een tekst die niet vertaald is.</p></div></section></main>' + FOOT + "</body></html>")
ABOUT = HEAD.format(title="Over ons | Bakkerij Zon", desc="Wie wij zijn.", extra="") + "<body>" + NAV + '<main><section id="over"><div class="container"><h1>Over ons</h1><p>Wij bakken sinds 1990.</p></div></section></main>' + FOOT + "</body></html>"
CONTACT = HEAD.format(title="Contact | Bakkerij Zon", desc="Neem contact op.", extra="") + "<body>" + NAV + '<main><section id="contact"><div class="container"><h1>Contact</h1><p>Bel ons gerust.</p></div></section></main>' + FOOT + "</body></html>"
ENGLISH = HEAD.format(title="English", desc="x", extra="") + "<body><main><section><h1>English page</h1></section></main></body></html>"
CSS = (':root{--hero-photo:url(img/hero.jpg);--primary:#8a4b12}'
       'body{font-family:system-ui;color:#222}.container{max-width:1100px;margin:0 auto;padding:0 1.25rem}'
       '.hero{background:var(--hero-photo) center/cover;padding:6rem 0}.band{background-image:url("img/band.webp");padding:4rem 0}')
SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>'
TRANSLATION = {
    "formaat": "easy2edit-vertalingen/1", "bron": "nl", "doel": "en",
    "paginas": {
        "index.html": [
            {"element": "title", "nl": "Bakkerij Zon | Vers brood", "en": "Sun Bakery | Fresh bread"},
            {"element": "description", "nl": "Verse broden uit de oven.", "en": "Fresh loaves from the oven."},
            {"element": "h1", "nl": "Vers brood &amp; meer", "en": "Fresh bread &amp; more"},
            {"element": "p", "nl": "Elke ochtend   vers uit de oven.", "en": "Fresh from the oven every morning."},
            {"element": "h2", "nl": "Onze broden", "en": "Our breads"},
            {"element": "p", "nl": "Altijd vers.", "en": "Always fresh."},
        ],
        "about.html": [
            {"element": "title", "nl": "Over ons | Bakkerij Zon", "en": "About us | Sun Bakery"},
            {"element": "h1", "nl": "Over ons", "en": "About us"},
            {"element": "p", "nl": "Wij bakken sinds 1990.", "en": "We have been baking since 1990."},
        ],
    },
}


def _img(fmt):
    b = io.BytesIO()
    Image.new("RGB", (8, 8), (200, 120, 40)).save(b, fmt)
    return b.getvalue()


def build(top=""):
    """The test ZIP as bytes; top = an optional common top folder."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        w = lambda n, d: z.writestr(top + n, d)  # noqa: E731
        w("index.html", INDEX)
        w("about.html", ABOUT)
        w("contact.html", CONTACT)
        w("en/index.html", ENGLISH)
        w("style.css", CSS)
        w("img/logo.svg", SVG)
        w("img/hero.jpg", _img("JPEG"))
        w("img/band.webp", _img("WEBP"))
        w("img/Team Foto.jpg", _img("JPEG"))
        w("img/Social Kaart.png", _img("PNG"))
        w(f"img/{LONG}.png", _img("PNG"))
        for i in range(41):
            w(f"img/vulling{i:02d}.jpg", _img("JPEG"))
        w("vertalingen-en.json", json.dumps(TRANSLATION))
    return buf.getvalue()

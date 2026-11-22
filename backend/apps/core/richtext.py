# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""Sanitizing + resolving of rich text (HTML from the WYSIWYG editor). Stored as 'html:<clean html>'."""
import re

import nh3

TAGS = {"p", "br", "strong", "b", "em", "i", "u", "s", "strike", "h2", "h3", "h4", "ul", "ol", "li", "blockquote",
        "a", "img", "hr", "div", "span"}
ATTRS = {"a": {"href", "target"}, "img": {"src", "alt", "data-media"}, "div": {"data-sysobject"}, "*": {"style"}}  # data-sysobject: a system object placed on the page
PREFIX = "html:"
MAX = 20000


def clean(html):
    return nh3.clean(html, tags=TAGS, attributes=ATTRS, url_schemes={"http", "https", "mailto", "tel"},
                     link_rel="noopener noreferrer", filter_style_properties={"text-align"})


def plain(html):
    return nh3.clean(html, tags=set())


def resolve(html, url_for):
    """Point <img data-media="ID"> at the file's current URL (it may have moved between local and S3)."""
    def fix(m):
        tag = m.group(0)
        media_id = re.search(r'data-media="(\d+)"', tag)
        url = url_for(int(media_id.group(1))) if media_id else None
        if not url:
            return tag
        tag = re.sub(r'\ssrc="[^"]*"', "", tag)
        return tag.replace("<img", f'<img src="{url}"', 1)

    return re.sub(r"<img\b[^>]*>", fix, html)


# the small editor of descriptions (users, profiles, plans, donations ...): a few tags, links to safe addresses only; no images, styles or events
SMALL_TAGS = {"p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a"}


def _small_attr(tag, attr, value):
    """data-open (where a link opens) only with a known value."""
    return value if attr != "data-open" or value in ("self", "tab", "window") else None


def clean_small(value, limit=4000):
    """A description from a form: "html:<html>" is cleaned with the whitelist of the small editor (and cut to `limit` characters of text); plain text stays plain text."""
    value = str(value or "")
    if not value.startswith(PREFIX):
        return value[:limit]
    body = nh3.clean(value[len(PREFIX):], tags=SMALL_TAGS, attributes={"a": {"href", "data-open"}}, attribute_filter=_small_attr, url_schemes={"http", "https", "mailto", "tel"}, link_rel="noopener noreferrer nofollow", strip_comments=True)
    if len(plain(body)) > limit:
        body = body[: limit * 3]  # (too long: cut; the editor does not allow this anyway)
    return PREFIX + body if plain(body).strip() else ""


# a component of the UI-kit (html from a component set or from the AI) that is drawn straight into the page, so it is cleaned on the server as well (a whitelist: the browser cleans too, but never alone)
KIT_TAGS = {"a", "article", "aside", "audio", "b", "blockquote", "br", "button", "circle", "code", "dd", "details", "dialog", "div", "dl", "dt", "em", "figcaption", "figure", "footer", "form", "g",
            "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "i", "img", "input", "label", "li", "line", "mark", "nav", "ol", "option", "p", "path", "polygon", "polyline", "rect", "ellipse", "s", "section",
            "select", "small", "span", "strong", "sub", "sup", "summary", "svg", "table", "tbody", "td", "text", "textarea", "tfoot", "th", "thead", "time", "tr", "u", "ul", "video", "source"}
KIT_ATTRS = {"*": {"class", "id", "style", "title", "role", "draggable", "tabindex", "lang", "dir"},
             "a": {"href", "target"}, "img": {"src", "alt", "width", "height", "loading"}, "audio": {"src", "controls", "preload"}, "video": {"src", "controls", "preload", "poster", "width", "height", "muted", "loop", "playsinline"},
             "source": {"src", "type"}, "form": {"action", "method"}, "input": {"type", "name", "value", "placeholder", "min", "max", "step", "checked", "disabled", "required", "readonly"},
             "textarea": {"name", "placeholder", "rows", "cols", "disabled", "required", "readonly"}, "select": {"name", "disabled", "required"}, "option": {"value", "selected"},
             "label": {"for"}, "button": {"type", "name", "value", "disabled"}, "td": {"colspan", "rowspan"}, "th": {"colspan", "rowspan", "scope"}, "ol": {"start", "type"}, "time": {"datetime"}, "details": {"open"},
             **{t: {"viewBox", "width", "height", "preserveAspectRatio", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "opacity", "transform", "vector-effect", "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "x2", "y1", "y2", "points", "text-anchor", "xmlns"}
                for t in ("svg", "circle", "line", "path", "polygon", "polyline", "rect", "ellipse", "g", "text")}}


def clean_kit(html):
    """The html of a kit component: only known tags and attributes (data-* and aria-* are free), no scripts, frames, event attributes or javascript: addresses."""
    return nh3.clean(str(html or ""), tags=KIT_TAGS, attributes=KIT_ATTRS, generic_attribute_prefixes={"data-", "aria-"}, url_schemes={"http", "https", "mailto", "tel"},
                     link_rel="noopener noreferrer", strip_comments=True)

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


def clean_small(value, limit=4000):
    """A description from a form: "html:<html>" is cleaned with the whitelist of the small editor (and cut to `limit` characters of text); plain text stays plain text."""
    value = str(value or "")
    if not value.startswith(PREFIX):
        return value[:limit]
    body = nh3.clean(value[len(PREFIX):], tags=SMALL_TAGS, attributes={"a": {"href"}}, url_schemes={"http", "https", "mailto", "tel"}, link_rel="noopener noreferrer nofollow", strip_comments=True)
    if len(plain(body)) > limit:
        body = body[: limit * 3]  # (too long: cut; the editor does not allow this anyway)
    return PREFIX + body if plain(body).strip() else ""

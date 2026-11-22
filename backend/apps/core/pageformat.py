# Copyright & Ownership Notice
# easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
# owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
# reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
# is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
# website https://rstcc.net

"""The page design format "easy2edit-pagina@1": a page as a tree of components with props.

The component set (the registry) holds every component as a piece of html. The props of a component are NOT written by hand: they are derived from that html (`schema_of`):
every text, link, picture and repeated group (cards, steps, questions ...) of the template is a prop. A component node is {id, type, versie, props, children}; `render` fills the
template with the props, `extract` reads the props out of the html of a component. So a new component in the set is in the catalogue (and has a props schema) at once.

Prop types: text (a string, a few inline tags), link {label, href}, afbeelding {src, alt}, lijst (a list of items with props of their own). Everything else of the template (classes,
icons, svg, layout) is fixed: a design can not change it, so a page can not break the look of the component set.

Documents: a page = {formaat, set, pagina, header, inhoud, footer, ontbrekende_componenten}; see `new_document`, `design_to_documents` and `document_to_html`."""
import copy
import re
from html import escape
from html.parser import HTMLParser

FORMAT = "easy2edit-pagina@1"
VOID = {"img", "br", "hr", "input", "meta", "link", "source", "wbr", "col"}
OPAQUE = {"svg", "canvas", "input", "select", "textarea", "script", "style", "iframe", "video", "audio", "table", "form", "button", "object"}  # left as the template has them (not props)
INLINE = {"b", "i", "em", "strong", "br", "span", "small", "mark", "code", "u", "sup", "sub"}
MAX_TEXT = 2000
MAX_ITEMS = 24


# ── a small html tree (the standard library only) ──
class El:
    __slots__ = ("tag", "attrs", "kids")

    def __init__(self, tag, attrs=None, kids=None):
        self.tag, self.attrs, self.kids = tag, list(attrs or []), list(kids or [])

    def get(self, name, default=""):
        for k, v in self.attrs:
            if k == name:
                return v if v is not None else ""
        return default

    def set(self, name, value):
        for i, (k, _v) in enumerate(self.attrs):
            if k == name:
                self.attrs[i] = (k, value)
                return
        self.attrs.append((name, value))


class _Builder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = El("#root")
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        e = El(tag, attrs)
        self.stack[-1].kids.append(e)
        if tag not in VOID:
            self.stack.append(e)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].kids.append(El(tag, attrs))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        if data:
            self.stack[-1].kids.append(data)


def parse(html):
    b = _Builder()
    b.feed(str(html or ""))
    b.close()
    return b.root


def serialize(node):
    if isinstance(node, str):
        return escape(node, quote=False)
    if node.tag == "#root":
        return "".join(serialize(k) for k in node.kids)
    attrs = "".join(f' {k}="{escape(v, quote=True)}"' if v is not None else f" {k}" for k, v in node.attrs)
    if node.tag in VOID:
        return f"<{node.tag}{attrs}>"
    return f"<{node.tag}{attrs}>{''.join(serialize(k) for k in node.kids)}</{node.tag}>"


def _ekids(el):
    """The child ELEMENTS of an element (the text between them is not counted: paths survive other white space)."""
    return [k for k in el.kids if isinstance(k, El)]


def _text_of(el):
    return "".join(k if isinstance(k, str) else _text_of(k) for k in el.kids)


def _inline_only(el):
    """True when the element holds only text and inline tags (so its content is ONE text prop)."""
    return all(isinstance(k, str) or (k.tag in INLINE and _inline_only(k)) for k in el.kids)


def _inner(el):
    return "".join(serialize(k) for k in el.kids)


def _sig(el):
    return (el.tag, el.get("class"))


# ── the schema of a component, derived from its html ──
ROLE_CLASS = ("eyebrow", "lead", "badge", "caption", "price", "quote", "value", "label", "title", "name", "role", "tag", "meta", "date")
ROLE_TAG = {"h1": "kop1", "h2": "kop2", "h3": "kop3", "h4": "kop4", "h5": "kop5", "p": "tekst", "blockquote": "citaat", "li": "punt", "summary": "vraag", "figcaption": "onderschrift",
            "small": "klein", "span": "label", "strong": "nadruk", "b": "nadruk", "div": "tekst", "td": "cel", "th": "kopcel", "dt": "term", "dd": "uitleg", "label": "label", "cite": "bron", "time": "datum"}


def _role(el):
    cls = el.get("class")
    for k in ROLE_CLASS:
        if re.search(rf"(^|[\s_-]){k}(\b|[\s_-])", cls):
            return {"eyebrow": "eyebrow", "lead": "lead", "badge": "badge", "caption": "onderschrift", "price": "prijs", "quote": "citaat", "value": "waarde", "label": "label", "title": "titel",
                    "name": "naam", "role": "functie", "tag": "tag", "meta": "meta", "date": "datum"}[k]
    return ROLE_TAG.get(el.tag, "tekst")


class Slot:
    """One prop of a component: kind text | link | afbeelding | lijst; path = child indexes from the root of the component (or of the list item)."""

    __slots__ = ("name", "kind", "path", "start", "end", "item", "sample", "aria")

    def __init__(self, name, kind, path, **kw):
        self.name, self.kind, self.path = name, kind, tuple(path)
        self.start = kw.get("start")
        self.end = kw.get("end")
        self.item = kw.get("item")
        self.sample = kw.get("sample")
        self.aria = bool(kw.get("aria"))  # the element has an aria-label of its own (a prop too)


def _unique(name, used):
    if name not in used:
        used.add(name)
        return name
    n = 2
    while f"{name}{n}" in used:
        n += 1
    used.add(f"{name}{n}")
    return f"{name}{n}"


def _slots(el, path, used):
    """The slots in the children of `el` (paths start with `path`; indexes count elements only). Repeated siblings become a list slot whose items have slots of their own."""
    out = []
    kids = _ekids(el)
    i = 0
    while i < len(kids):
        e = kids[i]
        j = i
        while j + 1 < len(kids) and _sig(kids[j + 1]) == _sig(e):
            j += 1
        if e.tag in OPAQUE:
            i = j + 1
            continue
        if j > i:  # a run of the same element: a list (cards, steps, questions, list items ...); every template item has its own slots (the items of a template can differ a little)
            variants = [_own_slots(kids[k], set()) for k in range(i, min(j + 1, i + 12))]
            if any(variants):
                out.append(Slot(_unique(_list_name(e), used), "lijst", path + (i,), start=i, end=j + 1, item=variants, sample=j - i + 1))
            i = j + 1
            continue
        out.extend(_own_slots_at(e, path + (i,), used))
        i += 1
    return out


def _list_name(e):
    return {"li": "punten", "details": "vragen", "article": "kaarten", "figure": "figuren", "tr": "rijen", "a": "links", "div": "items", "section": "items", "blockquote": "citaten"}.get(e.tag, "items")


def _own_slots(item, used):
    """The slots of a list item, relative to the item itself (path () is the item)."""
    return _own_slots_at(item, (), used, as_root=True)


def _own_slots_at(e, path, used, as_root=False):
    if e.tag in OPAQUE:
        return []
    if e.tag == "img":
        return [Slot(_unique("afbeelding", used), "afbeelding", path)]
    if e.get("role") == "img":  # a picture place (with or without the picture in it: a template can hold the empty place)
        return [Slot(_unique("afbeelding", used), "afbeelding", path, sample="plek")]
    if e.tag == "a":
        aria = bool(e.get("aria-label"))
        if _inline_only(e):
            return [Slot(_unique(_role_link(e), used), "link", path, aria=aria)]
        sub = _slots(e, path, used)
        return [Slot(_unique(_role_link(e), used), "link", path, sample="href", aria=aria)] + sub  # a link with more inside: only its address is a prop, the inside is walked
    if e.get("class") and "e2e-icon" in e.get("class"):
        return []
    if _text_of(e).strip() and _inline_only(e):
        return [Slot(_unique(_role(e), used), "text", path)]
    return _slots(e, path, used)


def _role_link(e):
    cls = e.get("class")
    return "knop" if "btn" in cls else "link"


_cache = {}


def schema_of(component):
    """The props schema of a component ({tag, slots}); derived from its html, cached."""
    key = (component["easy2edit_tag"], hash(component["html"]))
    if key not in _cache:
        root = parse(component["html"])
        top = next((k for k in root.kids if isinstance(k, El)), None)
        _cache[key] = {"tag": component["easy2edit_tag"], "slots": _slots(top, (), set()) if top else []}
    return _cache[key]


def schema_json(component):
    """The schema as plain data (for the catalogue and the formal schema)."""
    def one(s):
        d = {"naam": s.name, "type": s.kind, "verplicht": s.kind != "lijst" or True}
        if s.kind == "lijst":
            d["items"] = [one(x) for x in s.item[0]]
            d["max"] = MAX_ITEMS
            if len({tuple((x.name, x.kind) for x in v) for v in s.item}) > 1:
                d["varianten"] = [[one(x) for x in v] for v in s.item]  # the items of this template are not all alike: item n follows variant n (and then they repeat)
        return d

    return [one(s) for s in schema_of(component)["slots"]]


# ── props <-> html ──
def _at(root, path):
    n = root
    for i in path:
        ks = _ekids(n) if isinstance(n, El) else []
        if i < len(ks):
            n = ks[i]
        else:
            return None
    return n


def _extract(el, slots):
    props = {}
    for s in slots:
        if s.kind == "lijst":
            parent = _at(el, s.path[:-1]) if s.path else el
            start = s.path[-1] if s.path else 0
            if parent is None:
                props[s.name] = []
                continue
            run = _ekids(parent)[start:]
            sig = _sig(run[0]) if run else None
            items = []
            for n_, k in enumerate(run):
                if _sig(k) != sig:
                    break
                items.append(_extract(k, s.item[n_ % len(s.item)]))
            props[s.name] = items
            continue
        n = _at(el, s.path)
        if n is None:
            props[s.name] = {"label": "", "href": ""} if s.kind == "link" else {"src": "", "alt": ""} if s.kind == "afbeelding" else ""
        elif s.kind == "text":
            props[s.name] = _inner(n).strip()
        elif s.kind == "link":
            props[s.name] = {"label": _inner(n).strip() if s.sample != "href" else "", "href": n.get("href"), **({"aria": n.get("aria-label")} if s.aria else {})}
        elif s.sample == "plek":
            img = next((k for k in _walk(n) if k is not n and k.tag == "img"), None)
            props[s.name] = {"src": img.get("src") if img is not None else "", "alt": (img.get("alt") if img is not None else "") or n.get("aria-label")}
        else:
            props[s.name] = {"src": n.get("src"), "alt": n.get("alt")}
    return props


def extract(component, html):
    """The props of a component read from its html (the structure of the template is expected). -> props dict."""
    top = next((k for k in parse(html).kids if isinstance(k, El)), None)
    return _extract(top, schema_of(component)["slots"]) if top else {}


def sample_props(component):
    """The props of the example of the component (the texts of the template): shown to the model as the shape that it fills in."""
    return extract(component, component["html"])


def _set_text(n, value):
    n.kids = parse(str(value or "")).kids


def _render(el, slots, props):
    for s in sorted([x for x in slots if x.kind != "lijst"], key=lambda x: x.path):
        n = _at(el, s.path)
        v = props.get(s.name)
        if n is None or v is None:
            continue
        if s.kind == "text":
            _set_text(n, v)
        elif s.kind == "link" and isinstance(v, dict):
            n.set("href", str(v.get("href") or ""))
            if s.sample != "href" and "label" in v:
                _set_text(n, v.get("label"))
            if s.aria and "aria" in v:
                n.set("aria-label", str(v.get("aria") or ""))
        elif s.kind == "afbeelding" and isinstance(v, dict) and s.sample == "plek":
            img = next((k for k in _walk(n) if k is not n and k.tag == "img"), None)
            src, alt = str(v.get("src") or ""), str(v.get("alt") or "")
            if src and img is None:
                img = El("img")
                n.kids.append(img)
            if img is not None:
                img.set("src", src)
                img.set("alt", alt)
            n.set("aria-label", alt)
        elif s.kind == "afbeelding" and isinstance(v, dict):
            n.set("src", str(v.get("src") or ""))
            n.set("alt", str(v.get("alt") or ""))
    for s in sorted([x for x in slots if x.kind == "lijst"], key=lambda x: x.path, reverse=True):  # later lists first: the indexes of earlier ones stay
        parent = _at(el, s.path[:-1]) if s.path else el
        items = props.get(s.name)
        if parent is None or not isinstance(items, list):
            continue
        ek = _ekids(parent)
        run = [s.start]  # the neighbours of the same kind (a different element ends the run: the next run is another list)
        while run[-1] + 1 < len(ek) and _sig(ek[run[-1] + 1]) == _sig(ek[s.start]):
            run.append(run[-1] + 1)
        templates = [ek[i] for i in run][:len(s.item)]
        made = []
        for n_, it in enumerate(items[:MAX_ITEMS]):
            c = copy.deepcopy(templates[n_ % len(templates)])  # item n follows template item n (the icons, the open question ...), then they repeat
            if n_ >= len(templates):
                for x in _walk(c):  # a repeat is not "the current page" or "open"
                    x.attrs = [(k, v) for k, v in x.attrs if k not in ("aria-current", "open")]
            _render(c, s.item[n_ % len(s.item)], it if isinstance(it, dict) else {})
            made.append(c)
        raw = [i for i, k in enumerate(parent.kids) if isinstance(k, El)]
        a0, b0 = raw[run[0]], raw[run[-1]] + 1
        parent.kids[a0:b0] = made
    return el


def render(component, props):
    """The html of a component filled with props. Everything that is not a prop stays as the template has it."""
    top = next((k for k in parse(component["html"]).kids if isinstance(k, El)), None)
    if top is None:
        return ""
    _render(top, schema_of(component)["slots"], props if isinstance(props, dict) else {})
    for n in _walk(top):  # a picture with a role="img" wrapper: the label follows the alt text
        if n.get("role") == "img" and n.get("aria-label"):
            img = next((k for k in n.kids if isinstance(k, El) and k.tag == "img"), None)
            if img is not None and img.get("alt"):
                n.set("aria-label", img.get("alt"))
    return serialize(top)


def _walk(el):
    yield el
    for k in el.kids:
        if isinstance(k, El):
            yield from _walk(k)


def _strip_ws(el):
    el.kids = [re.sub(r"\s+", " ", k).strip() if isinstance(k, str) else k for k in el.kids if not (isinstance(k, str) and not k.strip())]
    for k in el.kids:
        if isinstance(k, El):
            _strip_ws(k)
    return el


def normalise(html):
    """The html as the tree writes it, without the white space between tags: to compare two pieces of html."""
    return serialize(_strip_ws(parse(html)))

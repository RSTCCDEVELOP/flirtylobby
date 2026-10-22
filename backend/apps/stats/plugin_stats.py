"""Statistics of a plugin: what the plugin records itself (system.stats.record), what it offers (system.provide("stats", provider) with widgets(days)),
and, for every plugin, what stands in its own tables (plg_<name>_…): how many rows, and how many were made per day."""
import re

from django.db import connection

from . import collectors as c
from . import service as st

DATE_COLUMNS = ("created_at", "created", "date", "ordered_at", "placed_at", "at", "starts_at", "paid_at", "updated_at")


def _tables(name):
    prefix = "plg_" + name.replace("-", "_") + "_"
    return [t for t in connection.introspection.table_names() if t.startswith(prefix)], prefix


def widgets(name, days=30):
    """Widgets of one plugin (also for a module whose work is done by a plugin, like Orders and Payments)."""
    out = []
    try:
        from apps.plugins import runtime

        runtime.ensure_loaded()
        lp = runtime.LOADED.get(name)
        prov = (lp.provides.get("stats") if lp else None)
        if prov:
            out += list(prov.widgets(days) or [])
    except Exception:  # noqa: BLE001 - a plugin must never break the page
        pass
    src = f"plugin:{name}"
    events = {}
    from .models import StatDay

    for ev_, in StatDay.objects.filter(source=src).values_list("event").distinct():
        events[ev_] = st.total(src, ev_, days)
    if events:
        out.append(c.lines("Gebeurtenissen per dag", [(e, st.series(src, e, days)) for e in sorted(events, key=lambda k: -events[k])[:4]]))
        out.append(c.bars("Gebeurtenissen (periode)", sorted(events.items(), key=lambda kv: -kv[1])[:10]))
    tables, prefix = _tables(name)
    rows, per_table = [], []
    with connection.cursor() as cur:
        for t in tables:
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{t}"')
                n = cur.fetchone()[0]
                rows.append((t[len(prefix):], n))
                cols = [x.name for x in connection.introspection.get_table_description(cur, t)]
                date_col = next((d for d in DATE_COLUMNS if d in cols), None)
                if date_col and n:
                    per_table.append((t[len(prefix):], date_col))
            except Exception:  # noqa: BLE001
                continue
    if rows:
        out.insert(0, c.bars("Gegevens van de plugin (aantal rijen per tabel)", sorted(rows, key=lambda r: -r[1])[:12]))
        for r_ in rows[:4]:
            out.insert(0, c.num(r_[0].replace("_", " ").capitalize(), r_[1]))
    # the rows that were made per day, for the biggest tables with a date
    ds = st._days(days)
    named = []
    with connection.cursor() as cur:
        for tname, col in per_table[:3]:
            t = prefix + tname
            try:
                cur.execute(f'SELECT date("{col}") AS d, COUNT(*) FROM "{t}" WHERE date("{col}") >= %s GROUP BY d', [ds[0].isoformat()])
                got = {str(d): n for d, n in cur.fetchall()}
                named.append((tname.replace("_", " "), [{"x": d.isoformat(), "y": int(got.get(d.isoformat(), 0))} for d in ds]))
            except Exception:  # noqa: BLE001
                continue
    if named:
        out.append(c.lines("Nieuwe rijen per dag", named))
    return out or [c.num("Gegevens", 0, "Deze plugin heeft nog niets vastgelegd.")]

// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Tabs from "../../../../components/Tabs";
import { api, errorText } from "../../../../lib/api";
import { tx } from "../../../../lib/t";

// The + of the chat of the creator: next to pictures the customer can add system parts to the design: components of the component set, system objects and widgets.
// What is chosen is kept in the brief of the design (components, objects): the designer gets it in the questions and in the plan, a widget is installed when the design is made, and a part that the plan leaves out is added anyway.
export const partsOf = (brief) => [...(brief?.components || []), ...(brief?.objects || []), ...(brief?.plugins_use || [])];

export function partName(slug, catalog) {
  const pl = (catalog?.plugins || []).find((x) => x.name === slug);
  if (pl) return pl.title || slug;
  const o = (catalog?.objects || []).find((x) => x.slug === slug);
  if (o) return o.name || slug;
  const c = (catalog?.components || []).find((x) => x.tag === slug);
  return c ? c.name : slug;
}

// The chosen parts as small badges above the input (with a cross to take one away).
export function PartChips({ job, catalog, onChange, disabled }) {
  const b = job?.brief || {};
  const list = partsOf(b);
  if (!list.length) return null;
  const drop = (slug) => onChange?.({ components: (b.components || []).filter((x) => x !== slug), objects: (b.objects || []).filter((x) => x !== slug), plugins_use: (b.plugins_use || []).filter((x) => x !== slug) });
  return (
    <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap", padding: ".5rem .7rem 0", borderTop: "1px solid var(--line)" }} aria-label={tx("Systeemonderdelen bij je ontwerp")} data-easy2edit-tag="ui-part-chips">
      {list.map((slug) => (
        <span key={slug} className="badge" style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", padding: ".25rem .5rem", borderRadius: 8, border: "1px solid var(--line)" }}>
          {partName(slug, catalog)}
          <button type="button" className="acl-x" style={{ width: "1.3rem", height: "1.3rem", fontSize: "1rem" }} disabled={disabled} onClick={() => drop(slug)} aria-label={`${tx("Verwijder")} ${partName(slug, catalog)}`}>×</button>
        </span>
      ))}
    </div>
  );
}

export default function PartsPicker({ job, catalog, onClose, onSaved }) {
  const b = job?.brief || {};
  const [tab, setTab] = useState("components");
  const [q, setQ] = useState("");
  const [comps, setComps] = useState(b.components || []);
  const [objs, setObjs] = useState(b.objects || []);
  const [plugs, setPlugs] = useState(b.plugins_use || []);
  const [off, setOff] = useState(b.modules_off || []);        // modules that the design does not use
  const [extra, setExtra] = useState(b.modules_extra || []);  // modules outside the installation that are used on purpose (only free ones can be chosen)
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const all = catalog?.objects || [];
  const lists = useMemo(() => ({
    components: (catalog?.components || []).map((c) => ({ slug: c.tag, name: c.name, group: c.category, text: c.description })),
    objects: all.filter((o) => o.kind !== "widget").map((o) => ({ slug: o.slug, name: o.name, group: o.kind_label, text: "" })),
    modules: (catalog?.modules || []).filter((m) => m.kind === "module").map((m) => {
      const paid = m.in_installation === false && Number(m.extra_monthly || 0) > 0;
      return { slug: m.key, name: m.label, group: "", text: m.desc || "", lock: !m.enabled ? tx("staat uit") : paid ? `${tx("kost extra per maand")}: € ${m.extra_monthly}` : "", free: m.in_installation === false && !paid };
    }),
    plugins: (catalog?.plugins || []).map((x) => ({ slug: x.name, name: x.title, group: x.active ? tx("Actief") : x.installed ? tx("Staat uit") : tx("Nog niet geïnstalleerd"), text: x.description || "", lock: x.free ? "" : `${tx("betaald: kost")} € ${x.price}`, off: !x.active })),
    widgets: all.filter((o) => o.kind === "widget").map((o) => ({ slug: o.slug, name: o.name, group: o.category || o.kind_label, text: o.description || "", off: o.installed === false })),
  }), [catalog]); // eslint-disable-line react-hooks/exhaustive-deps
  // modules are "on" unless the design switches them off; the others are on when they are in the list
  const chosen = (k, slug) => (k === "modules" ? !off.includes(slug) : k === "components" ? comps.includes(slug) : k === "plugins" ? plugs.includes(slug) : objs.includes(slug));
  const flip = (k, slug, item) => {
    if (k === "modules") {
      const on = !off.includes(slug);
      setOff((cur) => (on ? [...cur, slug] : cur.filter((x) => x !== slug)));
      if (on) setExtra((cur) => cur.filter((x) => x !== slug)); else if (item?.free) setExtra((cur) => [...cur, slug]);
      return;
    }
    const set = k === "components" ? setComps : k === "plugins" ? setPlugs : setObjs;
    set((cur) => (cur.includes(slug) ? cur.filter((x) => x !== slug) : [...cur, slug]));
  };
  const n = { components: comps.length, plugins: plugs.length, modules: null, objects: objs.filter((x) => lists.objects.some((o) => o.slug === x)).length, widgets: objs.filter((x) => lists.widgets.some((o) => o.slug === x)).length };
  const shown = lists[tab].filter((it) => !q.trim() || `${it.name} ${it.group} ${it.text}`.toLowerCase().includes(q.trim().toLowerCase()));
  const groups = [...new Set(shown.map((it) => it.group || ""))];
  const changed = JSON.stringify([comps, objs, plugs, off, extra]) !== JSON.stringify([b.components || [], b.objects || [], b.plugins_use || [], b.modules_off || [], b.modules_extra || []]);
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const j = await api(`/sitecreator/${job.id}/`, { method: "PATCH", body: { components: comps, objects: objs, plugins_use: plugs, modules_off: off, modules_extra: extra } });
      const added = [...comps.filter((x) => !(b.components || []).includes(x)), ...objs.filter((x) => !(b.objects || []).includes(x)), ...plugs.filter((x) => !(b.plugins_use || []).includes(x))];
      onSaved?.(j, added);
      onClose();
    } catch (e) { setErr(errorText(e)); }
    setBusy(false);
  };
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tx("Systeemonderdelen toevoegen")} onClick={() => !busy && onClose()}>
      <div className="card modal form int-modal inv-modal" onClick={(e) => e.stopPropagation()} data-easy2edit-tag="ui-parts-picker">
        <div className="row between" style={{ flex: "0 0 auto" }}>
          <h2 style={{ margin: 0 }}>{tx("Systeemonderdelen toevoegen")}</h2>
          <button type="button" className="btn sm" disabled={busy} onClick={onClose} aria-label={tx("Sluiten")}>×</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>{tx("Kies onderdelen die in je website moeten zitten. De ontwerper neemt ze mee in de vragen en in het ontwerp, een widget wordt geïnstalleerd en wat de ontwerper vergeet wordt toch toegevoegd.")}</p>
        <Tabs className="tabs-one-row" value={tab} onChange={setTab} tabs={[["components", "Componenten", null, n.components || null], ["objects", "Objecten", null, n.objects || null], ["widgets", "Widgets", null, n.widgets || null], ["modules", "Modules"], ["plugins", "Plugins", null, n.plugins || null]]} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoeken…")} aria-label={tx("Zoeken…")} style={{ flex: "0 0 auto" }} />
        <div className="inv-body">
          {!catalog && <span className="muted">{tx("Bezig…")}</span>}
          <div style={{ display: "grid", gap: ".9rem", alignContent: "start" }}>
            {groups.map((g) => (
              <div key={g} style={{ display: "grid", gap: ".5rem" }}>
                {g && <strong className="muted" style={{ fontSize: ".78rem", textTransform: "uppercase", letterSpacing: ".04em" }}>{tx(g)}</strong>}
                {shown.filter((it) => (it.group || "") === g).map((it) => (
                  <label key={it.slug} className="en-row" style={it.lock ? { opacity: .55, cursor: "not-allowed" } : undefined}>
                    <span className="en-text"><strong>{tx(it.name)}{it.off && <small className="muted"> · {tx("wordt geïnstalleerd")}</small>}{it.lock && <small className="muted"> · {it.lock}</small>}</strong>{it.text && <small className="muted">{tx(it.text)}</small>}</span>
                    <span className="switch"><input type="checkbox" disabled={!!it.lock} checked={!it.lock && chosen(tab, it.slug)} onChange={() => flip(tab, it.slug, it)} /><span /></span>
                  </label>
                ))}
              </div>
            ))}
            {catalog && !shown.length && <span className="muted">{tx("Niets gevonden.")}</span>}
          </div>
        </div>
        {err && <div className="alert">{err}</div>}
        <div className="row inv-foot">
          <button type="button" className="btn" disabled={busy} onClick={onClose}>{tx("Annuleren")}</button>
          <button type="button" className="btn primary" disabled={busy || !changed} onClick={save}>{busy ? tx("Bezig…") : tx("Opslaan")}</button>
        </div>
      </div>
    </div>, document.body);
}

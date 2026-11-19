// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../../../components/AuthContext";
import { IconEdit, IconInfo, IconPlus, IconTag, IconTrash, IconX } from "../../../../components/Icons";
import { Busy } from "../../../../components/PageLoader";
import Tabs from "../../../../components/Tabs";
import { ColorDot, ColorField, SWATCHES, TagChip } from "../../../../components/Tags";
import { api, errorText } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { lvl } from "../../../../lib/perms";
import KitScope from "../../../../lib/ui-kit/KitScope";
import { tx } from "../../../../lib/t";

// Tags (module Tags): a tag has a name, a colour and a scope; it can be put on any part of easy2edit. The scope decides where it may be used:
// everywhere (global), only on the parts of chosen modules, or only on the parts of chosen plugins. The tags are put on things in their own screens (users, entities ...).
const EMPTY = { name: "", color: SWATCHES[0], description: "", scope: "global", modules: [], plugins: [] };
const SCOPES = [["global", "Overal", "De tag mag op alles van easy2edit."], ["module", "Modules", "De tag mag alleen op onderdelen van de gekozen modules."], ["plugin", "Plugins", "De tag mag alleen op onderdelen van de gekozen plugins."]];

// chosen items as chips with a "+" that opens a search over the rest
function MultiPick({ items, value, onChange, label, searchLabel, disabled }) {
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const chosen = value.map((k) => items.find((x) => x.key === k) || { key: k, label: k });
  const hits = items.filter((x) => !value.includes(x.key) && `${x.label} ${x.key}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 10);
  return (
    <div className="e2e-field">
      <label className="e2e-label"><span>{label}</span></label>
      <div className="e2e-tags">
        {chosen.map((x) => <span key={x.key} className="e2e-tag">{x.label}{!disabled && <button type="button" className="e2e-tag__x" aria-label={tx("Verwijderen")} onClick={() => onChange(value.filter((k) => k !== x.key))}><IconX width={11} height={11} /></button>}</span>)}
        {!chosen.length && <span className="muted">{tx("Nog niets gekozen.")}</span>}
        {!disabled && <button type="button" className={`e2e-btn e2e-btn--sm${adding ? " e2e-btn--primary" : ""}`} aria-label={tx("Toevoegen")} onClick={() => { setAdding(!adding); setQ(""); }}><IconPlus width={14} height={14} /></button>}
      </div>
      {adding && (
        <div className="e2e-tagadd">
          <input className="e2e-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setAdding(false); if (e.key === "Enter" && hits[0]) { e.preventDefault(); onChange([...value, hits[0].key]); setQ(""); } }} placeholder={searchLabel} aria-label={searchLabel} />
          <div className="e2e-tagadd__hits">
            {hits.map((x) => <button type="button" key={x.key} className="e2e-tagadd__hit" onClick={() => { onChange([...value, x.key]); setQ(""); }}>{x.label}<small className="muted">{x.key}</small></button>)}
            {!hits.length && <span className="muted" style={{ padding: ".5rem .7rem" }}>{tx("Niets gevonden.")}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function TagModal({ init, modules, plugins, canEdit, onClose, onSaved }) {
  const [f, setF] = useState(init);
  const [tab, setTab] = useState("general");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) { setTab("general"); setErr(tx("Geef de tag een naam.")); return; }
    setBusy(true); setErr("");
    try { await api(f.id ? `/tags/${f.id}/` : "/tags/", { method: f.id ? "PUT" : "POST", body: { name: f.name, color: f.color, description: f.description, scope: f.scope, modules: f.modules, plugins: f.plugins } }); onSaved(); }
    catch (e) { setErr(errorText(e)); }
    setBusy(false);
  };
  return createPortal(
    <div className="overlay" style={{ zIndex: 3050 }} onClick={onClose}>
      <div className="card modal pc-modal" role="dialog" aria-label={tx("Tag")} style={{ width: "min(640px, 96vw)", maxHeight: "92vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}><KitScope tag="ui-tag">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <h2 style={{ margin: 0 }}>{f.id ? <><ColorDot color={f.color} size={12} />{f.name}</> : tx("Nieuwe tag")}</h2>
          <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Sluiten")} onClick={onClose}><IconX width={16} height={16} /></button>
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[["general", tx("Algemeen"), <IconTag key="g" />], ["scope", tx("Bereik"), <IconInfo key="s" />]]} />
        {err && <div className="alert">{err}</div>}
        <div className="stack" style={{ gap: ".9rem", overflow: "auto", flex: 1, minHeight: 250, paddingTop: ".4rem" }}>
          {tab === "general" && (<>
            <div className="e2e-field"><label className="e2e-label" htmlFor="tg-name"><span>{tx("Naam")} <span style={{ color: "var(--e2e-danger)" }}>*</span></span></label>
              <div style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
                <ColorField inline value={f.color} onChange={(v) => set("color", v || SWATCHES[0])} disabled={!canEdit} allowNone={false} />
                <input id="tg-name" className="e2e-input" style={{ flex: 1 }} value={f.name} maxLength={60} disabled={!canEdit} onChange={(e) => set("name", e.target.value)} />
              </div></div>
            <div className="e2e-field"><label className="e2e-label" htmlFor="tg-desc"><span>{tx("Omschrijving")}</span></label><input id="tg-desc" className="e2e-input" value={f.description} maxLength={200} disabled={!canEdit} onChange={(e) => set("description", e.target.value)} /></div>
            <div><span className="muted">{tx("Zo ziet de tag eruit")}: </span><TagChip tag={{ name: f.name || tx("Tag"), color: f.color }} /></div>
          </>)}
          {tab === "scope" && (<>
            <div className="stack" style={{ gap: ".5rem" }} role="radiogroup" aria-label={tx("Bereik")}>
              {SCOPES.map(([k, label, hint]) => (
                <label key={k} className="check sec-toggle">
                  <span className="switch"><input type="radio" name="tg-scope" checked={f.scope === k} disabled={!canEdit} onChange={() => set("scope", k)} /><span /></span>
                  <span>{tx(label)}<small className="muted" style={{ display: "block" }}>{tx(hint)}</small></span>
                </label>
              ))}
            </div>
            {f.scope === "module" && <MultiPick items={modules} value={f.modules} onChange={(v) => set("modules", v)} label={tx("Modules")} searchLabel={tx("Zoek een module")} disabled={!canEdit} />}
            {f.scope === "plugin" && <MultiPick items={plugins} value={f.plugins} onChange={(v) => set("plugins", v)} label={tx("Plugins")} searchLabel={tx("Zoek een plugin")} disabled={!canEdit} />}
          </>)}
        </div>
        <div style={{ display: "flex", gap: ".6rem", justifyContent: "flex-end", borderTop: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.12)))", paddingTop: ".8rem" }}>
          <button type="button" className="btn" onClick={onClose}>{tx("Annuleren")}</button>
          {canEdit && <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? tx("Bezig…") : tx("Opslaan")}</button>}
        </div>
      </KitScope></div>
    </div>,
    document.body,
  );
}

export default function TagsPage() {
  const { user } = useAuth();
  const L = user?.is_staff || Object.values(user?.module_levels || {}).some((v) => v >= 2) ? 3 : 0; // every administrator makes and changes tags
  const [rows, setRows] = useState(null);
  const [mods, setMods] = useState([]);
  const [plugs, setPlugs] = useState([]);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api("/tags/").then(setRows).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => {
    load();
    api("/modules/all/").then((l) => setMods(l.map((m) => ({ key: m.key, label: tx(m.label) })))).catch(() => {});
    api("/plugins/").then((l) => setPlugs((Array.isArray(l) ? l : l.plugins || []).map((p) => ({ key: p.name, label: p.title || p.name })))).catch(() => {});
  }, [load]);
  const nameOf = useMemo(() => ({ m: Object.fromEntries(mods.map((x) => [x.key, x.label])), p: Object.fromEntries(plugs.map((x) => [x.key, x.label])) }), [mods, plugs]);
  const scopeText = (t) => (t.scope === "global" ? tx("Overal") : t.scope === "module" ? t.modules.map((k) => nameOf.m[k] || k).join(", ") : t.plugins.map((k) => nameOf.p[k] || k).join(", "));
  const remove = async (t) => {
    if (!(await confirmDialog(tx("De tag {0} verwijderen? Hij verdwijnt overal waar hij op staat; de onderdelen blijven.", t.name), { danger: true, okLabel: tx("Verwijderen"), cancelLabel: tx("Annuleren") }))) return;
    try { await api(`/tags/${t.id}/`, { method: "DELETE" }); load(); window.dispatchEvent(new Event("tags-changed")); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  if (!rows) return msg ? <div className="alert">{msg.text}</div> : <Busy />;
  const shown = rows.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(q.trim().toLowerCase()));
  const ROW = { display: "grid", alignItems: "center", gap: ".7rem", padding: ".55rem .5rem", borderBottom: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.12)))", gridTemplateColumns: "minmax(140px,1.4fr) minmax(120px,1.6fr) 70px 80px" };
  return (
    <KitScope tag="ui-tag">
      <div className="page-head">
        <div>
          <h1>{tx("Tags")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Tags met een kleur voor alle onderdelen van easy2edit. Een tag geldt overal, voor één of meer modules of voor één of meer plugins. Je hangt ze aan gebruikers, entiteiten en meer in hun eigen scherm.")}</p>
        </div>
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: ".8rem" }}>{msg.text}</div>}
      <div className="card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", gap: ".6rem", alignItems: "center", marginBottom: ".6rem", flexWrap: "wrap" }}>
          {L >= 3 && <button type="button" className="btn primary" onClick={() => setModal({ ...EMPTY })} aria-label={tx("Tag toevoegen")}><IconPlus /> {tx("Toevoegen")}</button>}
          <input className="e2e-input" style={{ maxWidth: 260 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoeken")} aria-label={tx("Zoeken")} />
          <span className="muted" style={{ fontSize: ".85rem" }}>{shown.length}</span>
        </div>
        {shown.length ? (
          <div style={{ overflowX: "auto" }}>
            <div style={{ ...ROW, fontSize: ".78rem", textTransform: "uppercase", letterSpacing: ".04em", opacity: 0.65, padding: ".3rem .5rem" }}><span>{tx("Tag")}</span><span>{tx("Bereik")}</span><span>{tx("Gebruikt")}</span><span /></div>
            {shown.map((t) => (
              <div key={t.id} style={ROW}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><ColorDot color={t.color} size={12} /><strong>{t.name}</strong>{t.description && <small className="muted"> · {t.description}</small>}</span>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={scopeText(t)}>{t.scope === "global" ? tx("Overal") : `${tx(t.scope === "module" ? "Modules" : "Plugins")}: ${scopeText(t)}`}</span>
                <span>{t.count}</span>
                <div style={{ display: "flex", gap: ".25rem", justifyContent: "flex-end" }}>
                  <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Bewerken")} title={tx("Bewerken")} onClick={() => setModal({ ...t })}><IconEdit width={14} height={14} /></button>
                  {L >= 3 && <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Verwijderen")} title={tx("Verwijderen")} onClick={() => remove(t)}><IconTrash width={14} height={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="muted">{rows.length ? tx("Niets gevonden.") : tx("Nog geen tags. Voeg er een toe met de knop Toevoegen.")}</p>}
      </div>
      {modal && <TagModal init={modal} modules={mods} plugins={plugs} canEdit={L >= 2} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); window.dispatchEvent(new Event("tags-changed")); }} />}
    </KitScope>
  );
}

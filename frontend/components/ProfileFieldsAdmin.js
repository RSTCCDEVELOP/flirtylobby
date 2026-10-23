// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import { useState } from "react";
import { api, errorText } from "../lib/api";
import { alertDialog, confirmDialog, promptDialog } from "../lib/dialog";
import { FIELD_TYPES, FIELD_VISIBILITY } from "./ProfileFields";
import { IconEdit, IconPalette, IconSliders } from "./Icons";
import Tabs from "./Tabs";

const slug = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 28);

const Sw = ({ label, checked, onChange, disabled }) => (
  <label className="check sec-toggle">
    <span className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span>
    <span>{label}</span>
  </label>
);

// Admin: community theme + which built-in profile fields are shown + the own (configurable) profile fields
export default function ProfileFieldsAdmin({ prof, setProf, themes, builtinLabels, can, onThemeApplied }) {
  const [tab, setTab] = useState("theme");
  const fields = prof.fields || [];
  const setField = (i, patch) => setProf({ fields: fields.map((f, n) => (n === i ? { ...f, ...patch } : f)) });
  const move = (i, d) => { const a = [...fields]; [a[i], a[i + d]] = [a[i + d], a[i]]; setProf({ fields: a }); };

  async function apply(t) {
    if (!(await confirmDialog(tx("Thema \"{0}\" toepassen? De profielvelden worden vervangen door die van dit thema. Wat leden al hebben ingevuld blijft bewaard.", t.label), { title: tx("Thema toepassen"), okLabel: tx("Toepassen") }))) return;
    try { onThemeApplied(await api("/community/theme/", { method: "POST", body: { theme: t.key } })); } catch (e) { alertDialog(errorText(e)); }
  }
  async function add() {
    const label = await promptDialog(tx("Naam van het nieuwe veld (bijv. Lievelingsgerecht)"), "", { title: tx("Nieuw veld"), okLabel: tx("Toevoegen") });
    if (!label?.trim()) return;
    let key = slug(label) || "veld";
    if (!/^[a-z]/.test(key)) key = `veld_${key}`;
    const taken = new Set(fields.map((f) => f.key));
    let k = key, n = 2;
    while (taken.has(k)) k = `${key}_${n++}`;
    setProf({ fields: [...fields, { key: k, label: label.trim(), type: "text", options: [], unit: "", required: false, visibility: "members", card: false, filter: false, group: "" }] });
  }
  async function remove(i) {
    if (await confirmDialog(tx("Veld \"{0}\" verwijderen? De ingevulde waarden van leden blijven bewaard maar worden niet meer getoond.", fields[i].label), { danger: true })) setProf({ fields: fields.filter((_, n) => n !== i) });
  }

  return (
    <>
      <Tabs value={tab} onChange={setTab} tabs={[["theme", "Thema", <IconPalette key="t" />], ["builtin", "Standaardvelden", <IconSliders key="b" />], ["custom", "Eigen velden", <IconEdit key="c" />, fields.length]]} />

      {tab === "theme" && (<>
      <h3>{tx("Thema")}</h3>
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{tx("Kies een startpunt voor je community. Daarna pas je alles hieronder aan, zonder programmeren.")}</p>
      <div className="popup-presets">
        {themes.map((t) => (
          <div key={t.key} className="card" style={{ borderColor: prof.theme === t.key ? "var(--blue)" : undefined, display: "flex", flexDirection: "column", gap: ".4rem" }}>
            <strong>{t.label} {prof.theme === t.key && <span className="badge ok">{tx("Actief")}</span>}</strong>
            <span className="muted" style={{ fontSize: ".82rem", flex: 1 }}>{t.desc}</span>
            <small className="muted">{t.fields} {tx("eigen")} {t.fields === 1 ? "veld" : "velden"}</small>
            <button type="button" className="btn sm" disabled={!can || prof.theme === t.key} onClick={() => apply(t)}>{prof.theme === t.key ? tx("In gebruik") : tx("Gebruik dit thema")}</button>
          </div>
        ))}
      </div>

      </>)}

      {tab === "builtin" && (<>
      <h3>{tx("Standaardvelden")}</h3>
      <div className="theme-grid">
        {Object.entries(builtinLabels).map(([k, l]) => <Sw key={k} label={l} disabled={!can} checked={prof.builtin?.[k] !== false} onChange={(v) => setProf({ builtin: { ...prof.builtin, [k]: v } })} />)}
      </div>
      <small className="muted">{tx("Uitgezet = het veld verdwijnt van het profielformulier, de profielpagina, de kaarten en de zoekfilters.")}</small>

      </>)}

      {tab === "custom" && (<>
      <h3>{tx("Eigen velden")} <small className="muted">({fields.length})</small></h3>
      {!fields.length && <p className="muted" style={{ margin: 0 }}>{tx("Nog geen eigen velden. Voeg er een toe of kies een thema.")}</p>}
      {fields.map((f, i) => (
        <div key={f.key} className="card field-card">
          <div className="theme-grid">
            <label>{tx("Naam")}<input value={f.label} disabled={!can} maxLength={60} onChange={(e) => setField(i, { label: e.target.value })} /></label>
            <label>{tx("Soort")}
              <select value={f.type} disabled={!can} onChange={(e) => setField(i, { type: e.target.value, options: ["select", "multiselect"].includes(e.target.value) && !f.options.length ? [tx("Optie 1"), tx("Optie 2")] : f.options })}>
                {FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>{tx("Wie ziet het")}
              <select value={f.visibility} disabled={!can} onChange={(e) => setField(i, { visibility: e.target.value })}>
                {FIELD_VISIBILITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>{tx("Groep")} <small className="muted">{tx("kop op de pagina")}</small><input value={f.group} disabled={!can} maxLength={40} onChange={(e) => setField(i, { group: e.target.value })} /></label>
            {f.type === "number" && <label>{tx("Eenheid")}<input value={f.unit} disabled={!can} maxLength={12} placeholder={tx("cm, kg, uur…")} onChange={(e) => setField(i, { unit: e.target.value })} /></label>}
          </div>
          {["select", "multiselect"].includes(f.type) && (
            <label>{tx("Keuzes")} <small className="muted">{tx("één per regel")}</small>
              <textarea rows={Math.min(8, Math.max(3, f.options.length + 1))} disabled={!can} defaultValue={f.options.join("\n")} key={`${f.key}-${f.type}`}
                onBlur={(e) => setField(i, { options: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} />
            </label>
          )}
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap", gap: "1rem" }}>
            <span className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
              <Sw label={tx("Verplicht")} disabled={!can} checked={f.required} onChange={(v) => setField(i, { required: v })} />
              <Sw label={tx("Tonen op kaart")} disabled={!can} checked={f.card} onChange={(v) => setField(i, { card: v })} />
              {f.type !== "textarea" && <Sw label={tx("Zoekfilter")} disabled={!can} checked={f.filter} onChange={(v) => setField(i, { filter: v })} />}
            </span>
            {can && (
              <span className="row" style={{ flexWrap: "nowrap", gap: ".3rem" }}>
                <button type="button" className="btn sm" disabled={i === 0} onClick={() => move(i, -1)} title={tx("Omhoog")}>↑</button>
                <button type="button" className="btn sm" disabled={i === fields.length - 1} onClick={() => move(i, 1)} title={tx("Omlaag")}>↓</button>
                <button type="button" className="btn sm danger" onClick={() => remove(i)}>{tx("Verwijderen")}</button>
              </span>
            )}
          </div>
        </div>
      ))}
      {can && <div><button type="button" className="btn primary" onClick={add}>{tx("+ Veld toevoegen")}</button></div>}
      <small className="muted">{tx("Wijzigingen aan de velden worden automatisch opgeslagen.")}</small>
      </>)}
    </>
  );
}

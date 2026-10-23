// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
// Dynamic profile fields (configured by an admin on Admin -> Community -> Profielvelden)
export const FIELD_TYPES = [["text", "Tekst"], ["textarea", "Lange tekst"], ["number", "Getal"], ["select", "Keuzelijst"], ["multiselect", "Meerdere keuzes"], ["checkbox", "Ja / nee"], ["date", "Datum"], ["url", "Link"]];
export const FIELD_VISIBILITY = [["public", "Openbaar"], ["members", "Ingelogde leden"], ["friends", "Alleen vrienden"], ["hidden", "Alleen de eigenaar"]];

export function FieldInput({ field, value, onChange }) {
  const { type, options = [], unit, label, required } = field;
  const title = <span>{label}{unit && <small className="muted"> ({unit})</small>}{required && <b style={{ color: "var(--danger, #d92d20)" }}> *</b>}</span>;
  if (type === "checkbox") {
    return (
      <label className="check sec-toggle">
        <span className="switch"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /><span /></span>
        <span>{label}</span>
      </label>
    );
  }
  if (type === "multiselect") {
    const cur = Array.isArray(value) ? value : [];
    return (
      <div>
        <strong style={{ fontSize: ".85rem" }}>{title}</strong>
        <div className="chips" style={{ marginTop: ".35rem" }}>
          {options.map((o) => (
            <button type="button" key={o} className={`chip ${cur.includes(o) ? "active" : ""}`} aria-pressed={cur.includes(o)}
              onClick={() => onChange(cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o])}>{o}</button>
          ))}
        </div>
      </div>
    );
  }
  if (type === "select") {
    return <label>{title}<select value={value ?? ""} onChange={(e) => onChange(e.target.value)}><option value="">{tx("Niet opgegeven")}</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>;
  }
  if (type === "textarea") return <label>{title}<textarea rows={4} maxLength={4000} value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></label>;
  const htmlType = { number: "number", date: "date", url: "url" }[type] || "text";
  return <label>{title}<input type={htmlType} step={type === "number" ? "any" : undefined} value={value ?? ""} placeholder={type === "url" ? "https://…" : undefined} maxLength={type === "text" ? 200 : undefined} onChange={(e) => onChange(e.target.value)} /></label>;
}

export const fieldText = (f) => {
  const v = f.value;
  if (f.type === "checkbox") return v ? "Ja" : "";
  if (Array.isArray(v)) return v.join(", ");
  if (f.type === "date" && v) return new Date(v).toLocaleDateString("nl-NL");
  return `${v}${f.unit ? ` ${f.unit}` : ""}`;
};

// Values on a profile page, grouped
export function FieldList({ fields }) {
  if (!fields?.length) return null;
  const groups = [...new Set(fields.map((f) => f.group || ""))];
  return (
    <div className="field-list">
      {groups.map((g) => (
        <section key={g}>
          {g && <h3>{g}</h3>}
          <dl>
            {fields.filter((f) => (f.group || "") === g).map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{f.type === "url" ? <a href={f.value} target="_blank" rel="noopener noreferrer nofollow" style={{ color: "var(--blue)" }}>{f.value.replace(/^https?:\/\//, "")}</a> : f.type === "multiselect" ? <span className="chips">{f.value.map((x) => <span key={x} className="chip" style={{ cursor: "default" }}>{x}</span>)}</span> : fieldText(f)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

// Short line on member cards
export const cardFieldsText = (fields) => (fields || []).map((f) => (f.type === "checkbox" ? f.label : fieldText(f))).filter(Boolean).join(" · ");

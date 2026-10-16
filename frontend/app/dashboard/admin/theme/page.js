"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../../../../lib/api";

// Apply css returned by the API to the live page (same specificity as the server-rendered one, later in <head>)
function applyPreview({ css, fonts_url }) {
  let style = document.getElementById("theme-preview");
  if (!style) {
    style = document.createElement("style");
    style.id = "theme-preview";
    document.head.appendChild(style);
  }
  style.textContent = css;
  if (fonts_url && !document.querySelector(`link[href="${fonts_url}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = fonts_url;
    document.head.appendChild(link);
  }
}

function Field({ f, value, onChange }) {
  if (f.type === "color")
    return (
      <label className="theme-field">
        {f.label}
        <span className="color-row">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
          <input value={value} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && onChange(e.target.value)} maxLength={7} />
        </span>
      </label>
    );
  if (f.type === "number")
    return (
      <label className="theme-field">
        <span>{f.label} <em>{value}{f.unit}</em></span>
        <span className="color-row">
          <input type="range" min={f.min} max={f.max} step={f.step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
          <input type="number" min={f.min} max={f.max} step={f.step} value={value} onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))} style={{ width: 90 }} />
        </span>
      </label>
    );
  return (
    <label className="theme-field">
      {f.label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {f.choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    </label>
  );
}

export default function ThemePage() {
  const [schema, setSchema] = useState([]);
  const [values, setValues] = useState(null);
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    api("/theme/").then((d) => { setSchema(d.schema); setValues(d.values); }).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  }, []);

  const preview = useCallback((next) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api("/theme/preview/", { method: "POST", body: { values: next } }).then(applyPreview).catch(() => {});
    }, 250);
  }, []);

  function change(key, v) {
    const next = { ...values, [key]: v };
    setValues(next);
    setMsg(null);
    preview(next);
  }

  async function save() {
    try {
      const d = await api("/theme/", { method: "PUT", body: { values } });
      applyPreview(d);
      document.getElementById("theme-live")?.remove();
      setMsg({ ok: true, text: "Vormgeving opgeslagen voor de hele website." });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
  }

  async function reset() {
    if (!confirm("Alle vormgeving terugzetten naar de standaardwaarden?")) return;
    const d = await api("/theme/reset/", { method: "POST" });
    setValues(d.values);
    applyPreview(d);
    document.getElementById("theme-live")?.remove();
    setMsg({ ok: true, text: "Standaardwaarden hersteld." });
  }

  if (!values) return <p className="muted">Laden…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Vormgeving</h1>
          <p className="muted" style={{ margin: 0 }}>Wijzigingen zie je direct hier. Pas na opslaan gelden ze voor de hele website.</p>
        </div>
        <div className="row">
          <button className="btn" onClick={reset}>Standaard herstellen</button>
          <button className="btn primary" onClick={save}>Opslaan</button>
        </div>
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <div className="card sample">
        <h2>Voorbeeld</h2>
        <p>Zo ziet gewone tekst eruit, met een <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "var(--blue)" }}>link</a> en <span className="muted">gedempte tekst</span>.</p>
        <div className="row" style={{ justifyContent: "flex-start", alignItems: "center" }}>
          <button className="btn primary">Primair</button>
          <button className="btn">Standaard</button>
          <button className="btn danger">Verwijderen</button>
          <span className="badge ok">Actief</span>
          <span className="badge off">Geblokkeerd</span>
        </div>
      </div>

      {schema.map((g) => (
        <div className="card theme-group" key={g.key}>
          <h2>{g.label}</h2>
          <div className="theme-grid">
            {g.fields.map((f) => <Field key={f.key} f={f} value={values[f.key]} onChange={(v) => change(f.key, v)} />)}
          </div>
        </div>
      ))}
    </>
  );
}

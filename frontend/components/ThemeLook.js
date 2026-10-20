"use client";

import { Busy } from "./PageLoader";
import { tx } from "../lib/t";
import { confirmDialog } from "../lib/dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import Collapsible, { CollapseAll } from "./Collapsible";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import { lvl } from "../lib/perms";
import { useUi } from "./Ui";
import { useBranding } from "./BrandingContext";
import { api, errorText } from "../lib/api";
import { useAutoSave } from "../lib/autosave";
import SaveStatus from "./SaveStatus";

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

// Ready-made popup versions (values of the "popups" fields)
const POPUP_VERSIONS = [
  { name: "Klassiek", desc: "Gecentreerd venster, donkere achtergrond", v: { popup_overlay: 0.72, popup_blur: 6, popup_radius: 14, popup_width: 480, popup_pad: 2, popup_bg_opacity: 1, popup_position: "center", popup_anim: "scale", popup_border_width: 0, popup_border_color: "#e5e8ef", popup_shadow: "soft", popup_btn_radius: 10, popup_image_radius: 8 } },
  { name: "Glas", desc: "Doorzichtig venster, sterke vervaging", v: { popup_overlay: 0.35, popup_blur: 18, popup_radius: 24, popup_width: 520, popup_pad: 2, popup_bg_opacity: 0.72, popup_position: "center", popup_anim: "scale", popup_border_width: 1, popup_border_color: "#e5e8ef", popup_shadow: "strong", popup_btn_radius: 14, popup_image_radius: 14 } },
  { name: "Zijpaneel", desc: "Schuift van rechts in, volle hoogte", v: { popup_overlay: 0.5, popup_blur: 0, popup_radius: 0, popup_width: 440, popup_pad: 2, popup_bg_opacity: 1, popup_position: "right", popup_anim: "right", popup_border_width: 1, popup_border_color: "#e5e8ef", popup_shadow: "strong", popup_btn_radius: 6, popup_image_radius: 6 } },
  { name: "Onderaan", desc: "Schuift omhoog van onderen", v: { popup_overlay: 0.5, popup_blur: 2, popup_radius: 24, popup_width: 680, popup_pad: 2, popup_bg_opacity: 1, popup_position: "bottom", popup_anim: "up", popup_border_width: 0, popup_border_color: "#e5e8ef", popup_shadow: "strong", popup_btn_radius: 14, popup_image_radius: 14 } },
  { name: "Minimaal", desc: "Klein, scherp en bijna onzichtbare achtergrond", v: { popup_overlay: 0.2, popup_blur: 0, popup_radius: 4, popup_width: 400, popup_pad: 1.5, popup_bg_opacity: 1, popup_position: "center", popup_anim: "fade", popup_border_width: 1, popup_border_color: "#d1d5db", popup_shadow: "none", popup_btn_radius: 4, popup_image_radius: 4 } },
  { name: "Groot en luchtig", desc: "Veel ruimte, zachte afronding", v: { popup_overlay: 0.85, popup_blur: 10, popup_radius: 28, popup_width: 640, popup_pad: 3, popup_bg_opacity: 1, popup_position: "center", popup_anim: "scale", popup_border_width: 0, popup_border_color: "#e5e8ef", popup_shadow: "soft", popup_btn_radius: 20, popup_image_radius: 20 } },
];
const DEVICES = [
  ["device_mobile", "Mobiel", "Telefoon in de browser", { w: 375, h: 680, kind: "phone" }],
  ["device_tablet", "iPad", "iPad of tablet", { w: 820, h: 620, kind: "tablet" }],
  ["device_desktop", "Website", "Computer", { w: 1180, h: 560, kind: "desktop" }],
  ["device_app", "App op mobiel", "Geïnstalleerd op het beginscherm, zonder browserbalk", { w: 375, h: 680, kind: "app" }],
];

export function Field({ f, value, onChange }) {
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

export default function ThemeLook() {
  const router = useRouter();
  const { user } = useAuth();
  const L = lvl(user, "theme");
  const { previewLogoSet } = useBranding();
  const { previewUi } = useUi();
  const [schema, setSchema] = useState([]);
  const [values, setValues] = useState(null);
  const [msg, setMsg] = useState(null);
  const [view, setView] = useState("device_desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    api("/theme/").then((d) => { setSchema(d.schema); setValues(d.values); }).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  }, []);

  // the logo follows the theme: preview it here, revert when leaving the page without saving
  const logoSet = values?.brand_logo;
  useEffect(() => {
    if (logoSet) previewLogoSet(logoSet);
    return () => previewLogoSet(null);
  }, [logoSet, previewLogoSet]);

  // interface defaults act immediately on this page; revert when leaving without saving
  const remember = values?.remember_collapse;
  const sidebarAuto = values?.sidebar_auto;
  const versionNotice = values?.version_notice;
  const tabStyle = values?.tab_style;
  const sysPopup = values?.system_popup;
  useEffect(() => {
    if (remember) previewUi({ remember_collapse: remember, sidebar_auto: sidebarAuto, chat_label: values?.chat_label, version_notice: versionNotice, tab_style: tabStyle, system_popup: sysPopup });
    return () => previewUi(null);
  }, [remember, sidebarAuto, versionNotice, tabStyle, sysPopup, values?.chat_label, previewUi]);

  const preview = useCallback((next) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api("/theme/preview/", { method: "POST", body: { values: next } }).then(applyPreview).catch(() => {});
    }, 250);
  }, []);

  // switch the admin's own view so you see the chosen start mode
  function showMode(mode) {
    if (mode !== "light" && mode !== "dark") return;
    document.documentElement.dataset.theme = mode;
    try { localStorage.setItem("theme", mode); } catch {}
    window.dispatchEvent(new CustomEvent("themechange", { detail: mode }));
  }

  function toggleDevice(key, on) {
    const next = { ...values, [key]: on ? "yes" : "no" };
    if (!DEVICES.some(([k]) => next[k] === "yes")) return setMsg({ ok: false, text: tx("Minimaal één weergave moet actief blijven.") });
    setValues(next);
    if (next[view] !== "yes") setView(DEVICES.find(([k]) => next[k] === "yes")[0]);
    setMsg(null);
  }

  function change(key, v) {
    if (key === "default_mode") showMode(v);
    const next = { ...values, [key]: v };
    setValues(next);
    setMsg(null);
    preview(next);
  }

  function applyValues(patch) {
    const next = { ...values, ...patch };
    setValues(next);
    setMsg(null);
    preview(next);
  }

  async function save() {
    try {
      const d = await api("/theme/", { method: "PUT", body: { values } });
      applyPreview(d);
      document.getElementById("theme-live")?.remove();
      setMsg(null);
      setPreviewKey((k) => k + 1);
      router.refresh(); // logo/favicon come from the server layout
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
      return false;
    }
  }

  async function reset() {
    if (!(await confirmDialog(tx("Alle vormgeving terugzetten naar de standaardwaarden?")))) return;
    const d = await api("/theme/reset/", { method: "POST" });
    setValues(d.values);
    applyPreview(d);
    document.getElementById("theme-live")?.remove();
    setMsg({ ok: true, text: tx("Standaardwaarden hersteld.") });
  }

  const auto = useAutoSave(values, save, { ready: !!values && L >= 2, delay: 1200 }); // saves by itself, no Save button
  if (!values) return <Busy />;

  return (
    <>
      <div className="page-head">
        <p className="muted" style={{ margin: 0 }}>{tx("Wijzigingen zie je direct hier en worden automatisch opgeslagen voor de hele website.")}</p>
        <div className="row">
          <CollapseAll />
          <button className="btn" onClick={reset} disabled={L < 2}>{tx("Standaard herstellen")}</button>
          <SaveStatus auto={auto} />
        </div>
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <Collapsible id="theme-devices" title={tx("Weergave per apparaat")} className="theme-group">
        <p className="muted" style={{ margin: ".25rem 0 1rem" }}>{tx("Op welke apparaten is de site beschikbaar? Minimaal één moet actief zijn. Een bezoeker op een uitgezet apparaat ziet een melding. Staat")} <strong>{tx("App op mobiel")}</strong> {tx("aan, dan is de site te installeren op het beginscherm; staat Mobiel dan uit, dan krijgt een telefoon in de browser de vraag de app te installeren.")}</p>
        <div className="vis-options">
          {DEVICES.map(([k, label, hint]) => (
            <label key={k} className="check sec-toggle">
              <span className="switch"><input type="checkbox" checked={values[k] === "yes"} onChange={(e) => toggleDevice(k, e.target.checked)} /><span /></span>
              <span><strong>{label}</strong><small className="muted"> {hint}</small></span>
            </label>
          ))}
        </div>
      </Collapsible>

      <Collapsible id="theme-preview" title={tx("Live voorbeeld per apparaat")} className="theme-group">
        <div className="row" style={{ justifyContent: "flex-start", marginBottom: ".75rem" }}>
          {DEVICES.filter(([k]) => values[k] === "yes").map(([k, label]) => <button key={k} className={`btn sm ${view === k ? "primary" : ""}`} onClick={() => setView(k)}>{label}</button>)}
          <button className="btn sm" onClick={() => setPreviewKey((n) => n + 1)}>{tx("Verversen")}</button>
          <small className="muted">{tx("Het voorbeeld toont de opgeslagen vormgeving; sla eerst op om wijzigingen te zien.")}</small>
        </div>
        {(() => {
          const d = DEVICES.find(([k]) => k === view)?.[3] || DEVICES[2][3];
          return (
            <div className="device-preview">
              <div className={`device-frame ${d.kind}`} style={{ width: d.kind === "desktop" ? "100%" : d.w + 24, maxWidth: "100%", height: d.h + 24 }}>
                <iframe key={`${view}-${previewKey}`} src="/" title={tx("Voorbeeld")} style={{ height: d.h }} />
              </div>
            </div>
          );
        })()}
      </Collapsible>

      {schema.filter((g) => g.key === "defaults").map((g) => (
        <Collapsible key={g.key} id="theme-defaults" title={g.label} className="theme-group">
          <p className="muted" style={{ margin: ".25rem 0 1rem" }}>{tx("Gedrag van de interface. Wordt niet veranderd door een ander thema te kiezen.")}</p>
          <div className="theme-grid">
            {g.fields.filter((f) => f.key !== "system_popup").map((f) => <Field key={f.key} f={f} value={values[f.key]} onChange={(v) => change(f.key, v)} />)}
          </div>
        </Collapsible>
      ))}

      <Collapsible id="theme-popups" title={tx("Popup-versies en test")} className="theme-group">
        <p className="muted" style={{ margin: ".25rem 0 1rem" }}>{tx("Kies een versie voor de standaardpopups (leeftijd, gokken, cookies). Daarna kun je alles fijn afstellen onder \"Popups\". Met de testknoppen zie je meteen het resultaat, ook voordat je opslaat.")}</p>
        <div className="popup-presets">
          {POPUP_VERSIONS.map((p) => {
            const active = Object.keys(p.v).every((k) => values[k] === p.v[k]);
            return (
              <button key={p.name} className={`preset ${active ? "active" : ""}`} onClick={() => applyValues(p.v)}>
                <strong>{p.name}</strong>
                <small>{p.desc}</small>
              </button>
            );
          })}
        </div>
      </Collapsible>

      <Collapsible id="theme-sample" title={tx("Voorbeeld")} className="sample">
        <p>{tx("Zo ziet gewone tekst eruit, met een")} <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "var(--blue)" }}>{tx("link")}</a> {tx("en")} <span className="muted">{tx("gedempte tekst")}</span>.</p>
        <div className="row" style={{ justifyContent: "flex-start", alignItems: "center" }}>
          <button className="btn primary">{tx("Primair")}</button>
          <button className="btn">{tx("Standaard")}</button>
          <button className="btn danger">{tx("Verwijderen")}</button>
          <span className="badge ok">{tx("Actief")}</span>
          <span className="badge off">{tx("Geblokkeerd")}</span>
        </div>
      </Collapsible>

      {schema.filter((g) => g.key !== "defaults" && g.key !== "devices" && g.key !== "interface_look" && g.key !== "page_layout" && g.key !== "loader").map((g) => (
        <Collapsible key={g.key} id={`theme-${g.key}`} title={g.label} className="theme-group">
          <div className="theme-grid">
            {g.fields.map((f) => <Field key={f.key} f={f} value={values[f.key]} onChange={(v) => change(f.key, v)} />)}
          </div>
        </Collapsible>
      ))}
    </>
  );
}

"use client";

import { tx } from "../../../../lib/t";
import { alertDialog, confirmDialog, promptDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../components/AuthContext";
import { lvl } from "../../../../lib/perms";
import { useUi } from "../../../../components/Ui";
import { useBranding } from "../../../../components/BrandingContext";
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
const POPUP_TESTS = [["example", "Voorbeeld met afbeelding"], ["age", "Leeftijdscontrole"], ["gambling", "Gokken-popup"], ["cookies", "Cookiebanner"], ["policy", "Cookiebeleid"], ["window:chat", "Venster: Chat"], ["window:video", "Venster: Videochat"], ["window:files", "Venster: Bestanden"]];

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
  const router = useRouter();
  const { user } = useAuth();
  const L = lvl(user, "theme");
  const { previewLogoSet } = useBranding();
  const { previewUi } = useUi();
  const [schema, setSchema] = useState([]);
  const [presets, setPresets] = useState([]);
  const [values, setValues] = useState(null);
  const [msg, setMsg] = useState(null);
  const [view, setView] = useState("device_desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    api("/theme/").then((d) => { setSchema(d.schema); setPresets(d.presets || []); setValues(d.values); }).catch((e) => setMsg({ ok: false, text: errorText(e) }));
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
  useEffect(() => {
    if (remember) previewUi({ remember_collapse: remember, sidebar_auto: sidebarAuto, chat_label: values?.chat_label, version_notice: versionNotice });
    return () => previewUi(null);
  }, [remember, sidebarAuto, versionNotice, values?.chat_label, previewUi]);

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

  function applyPreset(p) {
    // a theme changes the look, not the interface behaviour
    const next = { ...p.values, remember_collapse: values.remember_collapse, sidebar_auto: values.sidebar_auto, version_notice: values.version_notice, ...Object.fromEntries(DEVICES.map(([k]) => [k, values[k]])), ...Object.fromEntries(Object.keys(values).filter((k) => k.startsWith("chat_")).map((k) => [k, values[k]])) };
    showMode(next.default_mode);
    setValues(next);
    setMsg(null);
    preview(next);
  }
  const isActive = (p) => Object.keys(p.values).every((k) => p.values[k] === values[k]);

  async function save() {
    try {
      const d = await api("/theme/", { method: "PUT", body: { values } });
      applyPreview(d);
      document.getElementById("theme-live")?.remove();
      setMsg({ ok: true, text: tx("Vormgeving opgeslagen voor de hele website.") });
      setPreviewKey((k) => k + 1);
      router.refresh(); // logo/favicon come from the server layout
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
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

  if (!values) return <p className="muted">{tx("Laden…")}</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Vormgeving")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Wijzigingen zie je direct hier. Pas na opslaan gelden ze voor de hele website.")}</p>
        </div>
        <div className="row">
          <CollapseAll />
          <button className="btn" onClick={reset} disabled={L < 2}>{tx("Standaard herstellen")}</button>
          <button className="btn primary" onClick={save} disabled={L < 2}>{tx("Opslaan")}</button>
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
            {g.fields.map((f) => <Field key={f.key} f={f} value={values[f.key]} onChange={(v) => change(f.key, v)} />)}
          </div>
        </Collapsible>
      ))}

      <Collapsible id="theme-presets" title={tx("Thema's")} className="theme-group">
        <p className="muted" style={{ margin: ".25rem 0 1rem" }}>{tx("Kies een thema om alle kleuren, lettertypen en vormen in één keer te veranderen. Daarna kun je nog alles hieronder fijn afstellen.")}</p>
        <div className="preset-grid">
          {presets.map((p) => (
            <button key={p.key} className={`preset ${isActive(p) ? "active" : ""}`} onClick={() => applyPreset(p)} title={p.description}>
              <span className="swatches">
                <i style={{ background: p.values.light_bg }} />
                <i style={{ background: p.values.light_card, borderColor: p.values.light_line }} />
                <i style={{ background: p.values.primary }} />
                <i style={{ background: p.values.secondary }} />
                <i style={{ background: p.values.dark_card }} />
                <i style={{ background: p.values.dark_bg }} />
              </span>
              <strong>{p.name}</strong>
              <small>{p.description}</small>
            </button>
          ))}
        </div>
      </Collapsible>

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
        <div className="popup-test" style={{ marginTop: "1rem" }}>
          <strong>{tx("Test:")}</strong>
          {POPUP_TESTS.map(([t, label]) => (
            <button key={t} type="button" className="btn" onClick={() => window.dispatchEvent(new CustomEvent("test-popup", { detail: t }))}>{label}</button>
          ))}
          <button type="button" className="btn" onClick={() => confirmDialog(tx("Weet je zeker dat je dit wilt doen?"), { title: tx("Systeempopup: bevestigen") })}>{tx("Systeempopup: bevestigen")}</button>
          <button type="button" className="btn" onClick={() => confirmDialog(tx("Dit item definitief verwijderen?"), { title: tx("Systeempopup: verwijderen"), danger: true })}>{tx("Systeempopup: verwijderen")}</button>
          <button type="button" className="btn" onClick={() => alertDialog(tx("Je wijzigingen zijn opgeslagen."), { title: tx("Systeempopup: melding") })}>{tx("Systeempopup: melding")}</button>
          <button type="button" className="btn" onClick={() => promptDialog(tx("Geef een nieuwe naam"), tx("Voorbeeld"), { title: tx("Systeempopup: invullen") })}>{tx("Systeempopup: invullen")}</button>
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

      {schema.filter((g) => g.key !== "defaults" && g.key !== "devices").map((g) => (
        <Collapsible key={g.key} id={`theme-${g.key}`} title={g.label} className="theme-group">
          <div className="theme-grid">
            {g.fields.map((f) => <Field key={f.key} f={f} value={values[f.key]} onChange={(v) => change(f.key, v)} />)}
          </div>
        </Collapsible>
      ))}
    </>
  );
}

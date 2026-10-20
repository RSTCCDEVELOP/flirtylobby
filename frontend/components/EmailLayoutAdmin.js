"use client";

import { Busy } from "./PageLoader";
import { tx } from "../lib/t";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { useAutoSave } from "../lib/autosave";
import { useAuth } from "./AuthContext";
import SaveStatus from "./SaveStatus";

const FORMATS = [["html", "HTML", "Mooie opmaak met logo, kleuren en knoppen"], ["text", "Platte tekst", "Alleen tekst, zonder opmaak"]];
const DESIGNS = [["theme", "Volgens het thema", "Kleuren, lettertype en logo uit Vormgeving"], ["custom", "Eigen instellingen", "Zelf kleuren, lettertype en afronding kiezen"]];
// Four ready-made layouts (position of the logo, alignment, box). Small drawings show what each one looks like.
const VARIANTS = [
  ["classic", "Klassiek", "Logo in het midden boven het vak, tekst links"],
  ["centered", "Gecentreerd", "Logo en tekst in het midden"],
  ["banner", "Banner", "Gekleurde balk met het logo, het vak eronder"],
  ["minimal", "Minimaal", "Zonder vak, logo rechtsboven"],
];
// How the verification code looks in the verification mails (login code, sign-up code)
const CODE_STYLES = [
  ["card", "Vak", "De code groot in één gekleurd vak"],
  ["boxes", "Vakjes", "Een vakje per cijfer, zoals het codescherm van de website"],
  ["plain", "Groot getal", "Alleen de code, groot en in de accentkleur"],
  ["band", "Gekleurde balk", "De code in witte letters op een balk in de accentkleur"],
];
const Mini = ({ v }) => {
  const c = "var(--blue)", l = "var(--line)", t = "var(--muted)";
  return (
    <svg viewBox="0 0 96 64" width="96" height="64" aria-hidden="true">
      <rect x=".5" y=".5" width="95" height="63" rx="5" fill="var(--bg)" stroke={l} />
      {v === "classic" && <><rect x="40" y="8" width="16" height="8" rx="2" fill={c} /><rect x="10" y="22" width="76" height="34" rx="4" fill="var(--card)" stroke={l} /><rect x="16" y="29" width="30" height="4" rx="2" fill={t} /><rect x="16" y="37" width="60" height="3" rx="1.5" fill={l} /><rect x="16" y="44" width="22" height="7" rx="3" fill={c} /></>}
      {v === "centered" && <><rect x="40" y="8" width="16" height="8" rx="2" fill={c} /><rect x="10" y="22" width="76" height="34" rx="4" fill="var(--card)" stroke={l} /><rect x="33" y="29" width="30" height="4" rx="2" fill={t} /><rect x="24" y="37" width="48" height="3" rx="1.5" fill={l} /><rect x="37" y="44" width="22" height="7" rx="3" fill={c} /></>}
      {v === "banner" && <><path d="M10 8h76v14H10z" fill={c} /><rect x="38" y="11" width="20" height="8" rx="2" fill="#fff" /><rect x="10" y="22" width="76" height="34" fill="var(--card)" stroke={l} /><rect x="16" y="29" width="30" height="4" rx="2" fill={t} /><rect x="16" y="37" width="60" height="3" rx="1.5" fill={l} /><rect x="16" y="44" width="22" height="7" rx="3" fill={c} /></>}
      {v === "minimal" && <><rect x="10" y="6" width="76" height="2" fill={c} /><rect x="70" y="12" width="16" height="8" rx="2" fill={c} /><rect x="10" y="27" width="30" height="4" rx="2" fill={t} /><rect x="10" y="36" width="76" height="3" rx="1.5" fill={l} /><rect x="10" y="44" width="22" height="7" rx="3" fill={c} /></>}
    </svg>
  );
};

const FONT_LABEL = { system: "Systeemlettertype", arial: "Arial", georgia: "Georgia", verdana: "Verdana", trebuchet: "Trebuchet" };
const COLORS = [["accent", "Accentkleur (knoppen, links)"], ["background", "Achtergrond"], ["card", "Berichtvak"], ["text", "Tekst"], ["muted", "Gedempte tekst"]];

const Choice = ({ options, value, onChange, disabled }) => (
  <div className="popup-presets">
    {options.map(([v, title, hint]) => (
      <button key={v} type="button" className="card" disabled={disabled} onClick={() => onChange(v)}
        style={{ textAlign: "left", cursor: disabled ? "default" : "pointer", display: "flex", flexDirection: "column", gap: ".25rem", borderColor: value === v ? "var(--blue)" : undefined }}>
        <strong>{tx(title)} {value === v && <span className="badge ok">{tx("Actief")}</span>}</strong>
        <span className="muted" style={{ fontSize: ".82rem" }}>{tx(hint)}</span>
      </button>
    ))}
  </div>
);

// Communicatie -> E-mailopmaak: HTML or plain text, design from the theme or own settings, live preview and a test mail.
export default function EmailLayoutAdmin({ canEdit, onMessage }) {
  const { user } = useAuth();
  const [cfg, setCfg] = useState(null);
  const [fonts, setFonts] = useState([]);
  const [saved, setSaved] = useState(null);
  const [preview, setPreview] = useState(null); // {format, html, text}
  const [kind, setKind] = useState("mail"); // which sample the preview shows: mail | code
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState("");
  const timer = useRef(null);

  const load = useCallback(() => api("/communication/email-layout/").then((d) => { setCfg(d.settings); setSaved(JSON.stringify(d.settings)); setFonts(d.fonts); }).catch((e) => onMessage({ ok: false, text: errorText(e) })), [onMessage]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (user?.email && !to) setTo(user.email); }, [user, to]);

  // live preview of what is on screen (also unsaved changes)
  useEffect(() => {
    if (!cfg) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => api("/communication/email-layout/preview/", { method: "POST", body: { settings: cfg, kind } }).then(setPreview).catch(() => {}), 350);
    return () => clearTimeout(timer.current);
  }, [cfg, kind]);

  const auto = useAutoSave(cfg, save, { ready: !!cfg && canEdit, delay: 1000 }); // saves by itself, no Save button
  if (!cfg) return <Busy />;
  const set = (patch) => setCfg({ ...cfg, ...patch });
  const setCustom = (patch) => setCfg({ ...cfg, custom: { ...cfg.custom, ...patch } });

  async function save() {
    try { const d = await api("/communication/email-layout/", { method: "PUT", body: cfg }); setCfg(d.settings); setSaved(JSON.stringify(d.settings)); onMessage(null); }
    catch (e) { onMessage({ ok: false, text: errorText(e) }); return false; }
  }
  async function sendTest() {
    setBusy("test");
    try { const r = await api("/communication/email-layout/test/", { method: "POST", body: { to } }); onMessage({ ok: true, text: r.detail }); }
    catch (e) { onMessage({ ok: false, text: errorText(e) }); }
    setBusy("");
  }

  return (
    <>
      <p className="muted" style={{ margin: 0 }}>{tx("Zo zien alle e-mails van het systeem eruit (inlogcodes, bevestigingen, meldingen).")}</p>
      <h3>{tx("Soort e-mail")}</h3>
      <Choice options={FORMATS} value={cfg.format} disabled={!canEdit} onChange={(v) => set({ format: v })} />

      {cfg.format === "html" && (
        <>
          <h3>{tx("Opmaakvariant")}</h3>
          <div className="popup-presets">
            {VARIANTS.map(([v, title, hint]) => (
              <button key={v} type="button" className="card" disabled={!canEdit} onClick={() => set({ variant: v })}
                style={{ textAlign: "left", cursor: canEdit ? "pointer" : "default", display: "flex", flexDirection: "column", gap: ".4rem", borderColor: cfg.variant === v ? "var(--blue)" : undefined }}>
                <Mini v={v} />
                <strong>{tx(title)} {cfg.variant === v && <span className="badge ok">{tx("Actief")}</span>}</strong>
                <span className="muted" style={{ fontSize: ".82rem" }}>{tx(hint)}</span>
              </button>
            ))}
          </div>
          <h3>{tx("Verificatiemails")}</h3>
          <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{tx("Zo staat de code in de mail bij aanmelden en inloggen. De mail is altijd licht, met het logo en de kleuren van de website.")}</p>
          <Choice options={CODE_STYLES} value={cfg.code_style} disabled={!canEdit} onChange={(v) => { set({ code_style: v }); setKind("code"); }} />
          <h3>{tx("Vormgeving")}</h3>
          <Choice options={DESIGNS} value={cfg.design} disabled={!canEdit} onChange={(v) => set({ design: v })} />
          {cfg.design === "custom" && (
            <div className="theme-grid">
              {COLORS.map(([k, label]) => (
                <label key={k}>{tx(label)}
                  <span className="color-row"><input type="color" value={cfg.custom[k]} disabled={!canEdit} onChange={(e) => setCustom({ [k]: e.target.value })} /><input value={cfg.custom[k]} disabled={!canEdit} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setCustom({ [k]: e.target.value })} /></span>
                </label>
              ))}
              <label>{tx("Lettertype")}
                <select value={cfg.custom.font} disabled={!canEdit} onChange={(e) => setCustom({ font: e.target.value })}>{fonts.map((f) => <option key={f} value={f}>{FONT_LABEL[f] || f}</option>)}</select>
              </label>
              <label>{tx("Afronding")} <small className="muted">px</small>
                <input type="number" min={0} max={32} value={cfg.custom.radius} disabled={!canEdit} onChange={(e) => e.target.value !== "" && setCustom({ radius: Number(e.target.value) })} />
              </label>
            </div>
          )}
          <div className="theme-grid" style={{ marginTop: "1.25rem" }}>
            <label>{tx("Logo uitlijnen")}
              <select value={cfg.logo_align || "auto"} disabled={!canEdit} onChange={(e) => set({ logo_align: e.target.value })}>
                <option value="auto">{tx("Volgens de opmaakvariant")}</option><option value="left">{tx("Links")}</option><option value="center">{tx("Midden")}</option><option value="right">{tx("Rechts")}</option>
              </select>
            </label>
            <label>{tx("Formaat van het logo")}
              <select value={cfg.logo_size || "m"} disabled={!canEdit} onChange={(e) => set({ logo_size: e.target.value })}>
                <option value="s">{tx("Klein")}</option><option value="m">{tx("Middel")}</option><option value="l">{tx("Groot")}</option>
              </select>
            </label>
          </div>
          <label className="check sec-toggle" style={{ marginTop: "1.25rem" }}>
            <span className="switch"><input type="checkbox" checked={cfg.show_logo} disabled={!canEdit} onChange={(e) => set({ show_logo: e.target.checked })} /><span /></span>
            <span>{tx("Logo bovenaan tonen")} <small className="muted">{tx("Zonder logo staat de naam van de website bovenaan.")}</small></span>
          </label>
        </>
      )}
      <div className="theme-grid">
        <label>{tx("Naam van de website (bovenaan, zonder logo)")}<input value={cfg.brand_name} placeholder="Studio2" maxLength={80} disabled={!canEdit} onChange={(e) => set({ brand_name: e.target.value })} /></label>
        <label>{tx("Voettekst onder elk bericht")}<textarea rows={2} value={cfg.footer} maxLength={500} disabled={!canEdit} placeholder={tx("Bijvoorbeeld je bedrijfsnaam en adres")} onChange={(e) => set({ footer: e.target.value })} /></label>
      </div>

      <h3 style={{ margin: "2rem 0 1rem" }}>{tx("Voorbeeld")}</h3>
      <div className="row" style={{ justifyContent: "flex-start", marginBottom: "1.25rem" }}>
        {[["mail", "Gewone e-mail"], ["code", "Verificatiecode"]].map(([k, l]) => <button key={k} type="button" className={`btn sm ${kind === k ? "primary" : ""}`} onClick={() => setKind(k)}>{tx(l)}</button>)}
      </div>
      <div className="mail-preview">
        {preview?.format === "html" && preview.html
          ? <iframe title={tx("Voorbeeld")} srcDoc={preview.html} sandbox="" />
          : <pre>{preview?.text}</pre>}
      </div>

      <div className="row" style={{ justifyContent: "flex-start", marginTop: "1rem" }}>
        {canEdit && <SaveStatus auto={auto} />}
      </div>

      <h3 style={{ margin: "2rem 0 1rem" }}>{tx("Testmail versturen")}</h3>
      <div className="row" style={{ justifyContent: "flex-start", flexWrap: "nowrap", alignItems: "end" }}>
        <label style={{ flex: 1, maxWidth: 420 }}>{tx("E-mailadres voor de testmail")}
          <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="naam@voorbeeld.nl" />
        </label>
        {canEdit && <button type="button" className="btn" disabled={!to || busy === "test"} onClick={sendTest}>{busy === "test" ? tx("Bezig…") : tx("Testmail versturen")}</button>}
      </div>
    </>
  );
}

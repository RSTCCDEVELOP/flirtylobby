"use client";

import { Busy } from "../../../../components/PageLoader";
import { tx } from "../../../../lib/t";
import { useEffect, useState } from "react";
import Collapsible from "../../../../components/Collapsible";
import { api, errorText } from "../../../../lib/api";
import { useAutoSave } from "../../../../lib/autosave";
import SaveStatus from "../../../../components/SaveStatus";

const TIMEZONES = ["Europe/Amsterdam", "Europe/Brussels", "Europe/Berlin", "Europe/Paris", "Europe/London", "Europe/Madrid", "Europe/Lisbon", "Europe/Rome", "Europe/Vienna", "Europe/Zurich", "Europe/Athens", "Europe/Istanbul", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo", "Asia/Dubai", "Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "UTC"];
const ENV_NAME = { production: "Live (productie)", staging: "Test (staging)", development: "Ontwikkeling" };
const DOT = { ok: "#16a34a", warn: "#d97706", bad: "#dc2626" };

function Env({ title, text }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    setDone(true); setTimeout(() => setDone(false), 1500);
  };
  return (
    <div style={{ marginBottom: ".9rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".6rem", marginBottom: ".3rem" }}>
        <strong style={{ fontSize: ".9rem" }}>{title}</strong>
        <button type="button" className="btn" onClick={copy}>{done ? tx("Gekopieerd") : tx("Kopiëren")}</button>
      </div>
      <pre className="sys-env">{text}</pre>
    </div>
  );
}

export default function SystemPage() {
  const [d, setD] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState(null);
  const load = (r) => { setD(r); setForm({ ...r.settings, extra_origins: (r.settings.extra_origins || []).join(", "), aliases: (r.settings.aliases || []).join(", ") }); };
  useEffect(() => { api("/system/").then(load).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, []);
  const [trBusy, setTrBusy] = useState(false);
  async function translateNotice() {
    setTrBusy(true); setMsg(null);
    try {
      await save(); // the source text first
      const r = await api("/system/maintenance-translate/", { method: "POST", body: {} });
      setForm((f) => ({ ...f, maintenance_messages: r.settings.maintenance_messages }));
      setMsg({ ok: true, text: r.translated ? tx("{0} talen zijn ingevuld.", r.translated) : tx("Alle talen waren al ingevuld.") });
    } catch (err) { setMsg({ ok: false, text: errorText(err) }); }
    setTrBusy(false);
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function save(e) {
    e?.preventDefault?.();
    try { load(await api("/system/", { method: "PUT", body: { ...form, extra_origins: String(form.extra_origins || "").split(",").map((x) => x.trim()).filter(Boolean), aliases: String(form.aliases || "").split(",").map((x) => x.trim()).filter(Boolean) } })); setMsg(null); }
    catch (err) { setMsg({ ok: false, text: errorText(err) }); return false; }
  }

  const auto = useAutoSave(form, save, { ready: !!d, delay: 1200 }); // saves by itself, no Save button
  if (!d) return msg ? <div className="alert">{msg.text}</div> : <Busy />;
  const clientApi = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const checks = [...d.checks];
  if (d.settings.backend_url && clientApi && clientApi !== d.settings.backend_url.replace(/\/$/, "")) {
    checks.push({ key: "NEXT_PUBLIC_API_URL", label: tx("API-adres in de website"), value: clientApi, status: "warn", hint: `${tx("Wijkt af van het API-adres hierboven. Zet NEXT_PUBLIC_API_URL op")} ${d.settings.backend_url} ${tx("en bouw de website opnieuw.")}` });
  }
  const bad = checks.filter((c) => c.status === "bad").length, warn = checks.filter((c) => c.status === "warn").length;

  return (
    <>
      <div className="page-head"><h1>{tx("Basisgegevens")}</h1></div>
      <p className="muted">{tx("De basis van deze installatie: naam, adressen en contactgegevens, plus alles wat nodig is om de website live te zetten.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <form onSubmit={save}>
        <Collapsible id="sys-site" title={tx("Website")} defaultOpen>
          <div className="grid2">
            <label>{tx("Naam van de website")}<input value={form.site_name} onChange={set("site_name")} maxLength={80} placeholder="Studio2" /></label>
            <label>{tx("Slogan")}<input value={form.tagline} onChange={set("tagline")} maxLength={120} /></label>
            <label>{tx("Titel van het browsertabblad (startpagina)")}<input value={form.tab_title || ""} onChange={set("tab_title")} maxLength={120} placeholder={form.site_name || "Studio2"} /></label>
            <label>{tx("Omgeving")}
              <select value={form.environment} onChange={set("environment")}>{d.environments.map((e) => <option key={e} value={e}>{tx(ENV_NAME[e])}</option>)}</select>
            </label>
            <label>{tx("Tijdzone")}
              <input list="tz-list" value={form.timezone} onChange={set("timezone")} placeholder="Europe/Amsterdam" />
              <datalist id="tz-list">{TIMEZONES.map((z) => <option key={z} value={z} />)}</datalist>
            </label>
          </div>
          <p className="muted" style={{ margin: ".4rem 0", fontSize: ".82rem" }}>{tx("De naam van de website staat in de header, de titel van het browsertabblad, e-mails, de app-naam en de 2-staps-app. Het tabblad toont op de startpagina de tabbladtitel (leeg = de naam van de website); andere pagina's tonen \"paginatitel | naam van de website\". De titel per pagina stel je in bij SEO of bij de pagina-instellingen.")}</p>
          <label className="check sec-toggle">
            <input type="checkbox" checked={!!form.maintenance} onChange={set("maintenance")} />
            <span><strong>{tx("Onderhoudsmodus")}</strong><br /><small className="muted">{tx("Bezoekers zien alleen een onderhoudspagina, zonder menu's. Inloggen via /login kan alleen voor superadmins en beheerders.")}</small></span>
          </label>
          {form.maintenance && (
            <>
              <label>{tx("Melding tijdens onderhoud")}<input value={form.maintenance_message} onChange={set("maintenance_message")} maxLength={500} placeholder={tx("We zijn bezig met onderhoud. Probeer het straks opnieuw.")} /></label>
              <div className="row" style={{ justifyContent: "flex-start", alignItems: "center" }}>
                <button type="button" className="btn sm primary" disabled={trBusy} onClick={translateNotice}>{trBusy ? tx("Claude vertaalt…") : tx("Vertaal de melding in alle talen")}</button>
                <small className="muted">{tx("Maakt de melding voor alle talen van het systeem, ook de talen die uit staan. De tekst hierboven is de bron.")}</small>
              </div>
              {Object.keys(form.maintenance_messages || {}).length > 0 && (
                <div className="grid2">
                  {Object.entries(form.maintenance_messages).map(([c, t]) => (
                    <label key={c}>{c.toUpperCase()}<input value={t} maxLength={500} onChange={(e) => setForm({ ...form, maintenance_messages: { ...form.maintenance_messages, [c]: e.target.value } })} /></label>
                  ))}
                </div>
              )}
            </>
          )}
        </Collapsible>
        <Collapsible id="sys-urls" title={tx("Adressen")} defaultOpen>
          <p className="muted" style={{ marginTop: 0, fontSize: ".85rem" }}>{tx("Zonder pad en zonder slash erachter. Het website-adres mag de API gebruiken zonder dat je de server-instellingen aanpast.")}</p>
          <div className="grid2">
            <label>{tx("Website-adres (frontend)")}<input value={form.frontend_url} onChange={set("frontend_url")} placeholder="https://www.voorbeeld.nl" /></label>
            <label>{tx("API-adres (backend)")}<input value={form.backend_url} onChange={set("backend_url")} placeholder="https://api.voorbeeld.nl" /></label>
          </div>
          <label>{tx("Andere domeinnamen van de website (komma's)")}<input value={form.aliases} onChange={set("aliases")} placeholder="voorbeeld.nl, www.voorbeeld.com" /></label>
          <label className="check sec-toggle">
            <input type="checkbox" checked={!!form.redirect_aliases} onChange={set("redirect_aliases")} />
            <span><strong>{tx("Andere domeinen doorsturen naar het hoofdadres")}</strong><br /><small className="muted">{tx("Bezoekers van een ander domein komen automatisch op het website-adres hierboven (met dezelfde pagina). Zorg dat die domeinen naar dezelfde server wijzen.")}</small></span>
          </label>
          <label>{tx("Extra adressen die de API mogen gebruiken (komma's)")}<input value={form.extra_origins} onChange={set("extra_origins")} placeholder="https://voorbeeld.nl, https://app.voorbeeld.nl" /></label>
          <p className="muted" style={{ margin: ".4rem 0 0", fontSize: ".8rem" }}>{tx("Je bekijkt dit nu via")} <strong>{d.request_origin}</strong></p>
        </Collapsible>
        <Collapsible id="sys-contact" title={tx("Bedrijf en contact")}>
          <div className="grid2">
            <label>{tx("Bedrijfsnaam")}<input value={form.company_name} onChange={set("company_name")} /></label>
            <label>{tx("Contact e-mail")}<input type="email" value={form.contact_email} onChange={set("contact_email")} /></label>
            <label>{tx("Support e-mail")}<input type="email" value={form.support_email} onChange={set("support_email")} /></label>
            <label>{tx("Beheer e-mail (meldingen van het systeem)")}<input type="email" value={form.admin_email} onChange={set("admin_email")} /></label>
            <label>{tx("Telefoon")}<input value={form.phone} onChange={set("phone")} /></label>
            <label>{tx("Adres")}<input value={form.address} onChange={set("address")} /></label>
            <label>{tx("KvK-nummer")}<input value={form.kvk} onChange={set("kvk")} /></label>
            <label>{tx("BTW-nummer")}<input value={form.vat_id} onChange={set("vat_id")} /></label>
          </div>
        </Collapsible>
        <Collapsible id="sys-footer" title={tx("Voettekst en sociale media")}>
          <label>{tx("Tekst in de voettekst")}<input value={form.footer_text} onChange={set("footer_text")} maxLength={500} /></label>
          <div className="grid2">
            {[["facebook", "Facebook"], ["instagram", "Instagram"], ["x", "X"], ["linkedin", "LinkedIn"], ["youtube", "YouTube"], ["tiktok", "TikTok"]].map(([k, l]) => (
              <label key={k}>{l}<input value={form[`social_${k}`] || ""} onChange={set(`social_${k}`)} placeholder="https://" /></label>
            ))}
          </div>
        </Collapsible>
        <Collapsible id="sys-limits" title={tx("Uploadlimieten")}>
          <div className="grid2">
            <label>{tx("Afbeelding in de bibliotheek (MB)")}<input type="number" min="1" max="200" value={form.max_image_mb} onChange={set("max_image_mb")} /></label>
            <label>{tx("Video in de bibliotheek (MB)")}<input type="number" min="1" max="2000" value={form.max_video_mb} onChange={set("max_video_mb")} /></label>
            <label>{tx("Profielfoto (MB)")}<input type="number" min="1" max="50" value={form.max_photo_mb} onChange={set("max_photo_mb")} /></label>
          </div>
        </Collapsible>
        <div className="profile-save"><SaveStatus auto={auto} /></div>
      </form>

      <Collapsible id="sys-checks" title={`${tx("Controle van de installatie")}${bad ? ` · ${bad} ${tx("fout")}` : ""}${warn ? ` · ${warn} ${tx("let op")}` : ""}`} defaultOpen>
        <div className="sys-checks">
          {checks.map((c) => (
            <div className="sys-check" key={c.key}>
              <i style={{ background: DOT[c.status] }} />
              <div>
                <strong>{tx(c.label)}</strong> <code>{c.key}</code>
                <div className="muted" style={{ fontSize: ".85rem", wordBreak: "break-all" }}>{c.value}</div>
                {c.hint && <div style={{ fontSize: ".82rem", color: c.status === "ok" ? "var(--muted)" : DOT[c.status] }}>{tx(c.hint)}</div>}
              </div>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: ".8rem", marginBottom: 0 }}>{tx("Deze server-instellingen staan in de omgeving (.env of Coolify) en worden hier alleen gecontroleerd.")}</p>
      </Collapsible>

      <Collapsible id="sys-env" title={tx("Instellingen voor de deployment")}>
        <p className="muted" style={{ marginTop: 0, fontSize: ".85rem" }}>{tx("Op basis van de adressen hierboven. Vul de waarden tussen < > zelf in en plak ze in .env of bij de omgevingsvariabelen van Coolify.")}</p>
        <Env title={tx("Backend")} text={d.env.backend} />
        <Env title={tx("Frontend")} text={d.env.frontend} />
      </Collapsible>
    </>
  );
}

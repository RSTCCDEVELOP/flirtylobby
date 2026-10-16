"use client";

import { tx } from "../../../../lib/t";
import { useEffect, useState } from "react";
import Collapsible from "../../../../components/Collapsible";
import { api, errorText } from "../../../../lib/api";

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
  const load = (r) => { setD(r); setForm({ ...r.settings, extra_origins: (r.settings.extra_origins || []).join(", ") }); };
  useEffect(() => { api("/system/").then(load).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    try { load(await api("/system/", { method: "PUT", body: { ...form, extra_origins: String(form.extra_origins || "").split(",").map((x) => x.trim()).filter(Boolean) } })); setMsg({ ok: true, text: tx("Opgeslagen.") }); }
    catch (err) { setMsg({ ok: false, text: errorText(err) }); }
  }

  if (!d) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Laden…")}</p>;
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
            <label>{tx("Omgeving")}
              <select value={form.environment} onChange={set("environment")}>{d.environments.map((e) => <option key={e} value={e}>{tx(ENV_NAME[e])}</option>)}</select>
            </label>
          </div>
        </Collapsible>
        <Collapsible id="sys-urls" title={tx("Adressen")} defaultOpen>
          <p className="muted" style={{ marginTop: 0, fontSize: ".85rem" }}>{tx("Zonder pad en zonder slash erachter. Het website-adres mag de API gebruiken zonder dat je de server-instellingen aanpast.")}</p>
          <div className="grid2">
            <label>{tx("Website-adres (frontend)")}<input value={form.frontend_url} onChange={set("frontend_url")} placeholder="https://www.voorbeeld.nl" /></label>
            <label>{tx("API-adres (backend)")}<input value={form.backend_url} onChange={set("backend_url")} placeholder="https://api.voorbeeld.nl" /></label>
          </div>
          <label>{tx("Extra adressen die de API mogen gebruiken (komma's)")}<input value={form.extra_origins} onChange={set("extra_origins")} placeholder="https://voorbeeld.nl, https://app.voorbeeld.nl" /></label>
          <p className="muted" style={{ margin: ".4rem 0 0", fontSize: ".8rem" }}>{tx("Je bekijkt dit nu via")} <strong>{d.request_origin}</strong></p>
        </Collapsible>
        <Collapsible id="sys-contact" title={tx("Bedrijf en contact")}>
          <div className="grid2">
            <label>{tx("Bedrijfsnaam")}<input value={form.company_name} onChange={set("company_name")} /></label>
            <label>{tx("Contact e-mail")}<input type="email" value={form.contact_email} onChange={set("contact_email")} /></label>
            <label>{tx("Support e-mail")}<input type="email" value={form.support_email} onChange={set("support_email")} /></label>
            <label>{tx("Telefoon")}<input value={form.phone} onChange={set("phone")} /></label>
            <label>{tx("KvK-nummer")}<input value={form.kvk} onChange={set("kvk")} /></label>
            <label>{tx("BTW-nummer")}<input value={form.vat_id} onChange={set("vat_id")} /></label>
          </div>
        </Collapsible>
        <div className="profile-save"><button className="btn primary">{tx("Opslaan")}</button></div>
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

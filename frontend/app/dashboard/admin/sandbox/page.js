"use client";

import { tx } from "../../../../lib/t";
import { confirmDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import { api, errorText } from "../../../../lib/api";
import { lvl } from "../../../../lib/perms";

const SIM = [
  ["email", "E-mail", "Berichten (inlogcodes, testmail) worden niet verstuurd maar komen in het sandbox-postvak."],
  ["sms", "Sms", "Sms-codes worden niet verstuurd maar komen in het sandbox-postvak."],
  ["payments", "Betalingen", "Betalingen krijgen een nagemaakte betaalpagina. Geen echt geld, geen Mollie of Stripe."],
  ["integrations", "Koppelingen testen", "De testknop bij API keys meldt 'gelukt' zonder echte verbinding."],
  ["geo", "Landcontrole", "Elke bezoeker komt uit het hieronder gekozen land, zonder IP-opzoeking."],
  ["geocoding", "Plaatsbepaling", "Zoeken op afstand: een plaats krijgt een vaste nagemaakte locatie, zonder OpenStreetMap."],
];
const STATUS = { open: ["Open", "off"], paid: ["Betaald", "ok"], failed: ["Mislukt", "off"], canceled: ["Geannuleerd", "off"], expired: ["Verlopen", "off"], refunded: ["Terugbetaald", "ok"] };
const money = (p) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: p.currency }).format(p.amount);

export default function Sandbox() {
  const { user } = useAuth();
  const L = lvl(user, "sandbox");
  const [s, setS] = useState(null);
  const [codes, setCodes] = useState([]);
  const [payments, setPayments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ provider: "mollie", amount: "24.95", currency: "EUR", description: tx("Testbestelling"), outcome: "" });
  const [open, setOpen] = useState(null);
  const names = useMemo(() => { const dn = new Intl.DisplayNames(["nl"], { type: "region" }); return Object.fromEntries(codes.map((c) => [c, dn.of(c) || c])); }, [codes]);

  const loadData = useCallback(() => {
    api("/sandbox/payments/").then(setPayments).catch(() => {});
    api("/sandbox/messages/").then(setMessages).catch(() => {});
  }, []);
  useEffect(() => {
    api("/sandbox/settings/").then((d) => { setS(d.settings); setCodes(d.country_codes); }).catch((e) => setMsg({ ok: false, text: errorText(e) }));
    loadData();
  }, [loadData]);

  async function save(patch) {
    const next = { ...s, ...patch, simulate: { ...s.simulate, ...(patch.simulate || {}) } };
    setS(next);
    try {
      const d = await api("/sandbox/settings/", { method: "PUT", body: next });
      setS(d.settings);
      setMsg({ ok: true, text: tx("Sandbox-instellingen opgeslagen.") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }
  const run = async (fn, okText) => { try { await fn(); if (okText) setMsg({ ok: true, text: okText }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } loadData(); };

  if (!s) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Laden…")}</p>;
  const edit = L >= 2;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Sandbox")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Testomgeving: externe diensten worden gesimuleerd, zodat je betalingen, e-mailverificaties en meer kunt uitproberen zonder dat echte API's worden aangeroepen.")}</p>
        </div>
        <CollapseAll />
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
      {s.enabled && <div className="alert" style={{ background: "#fef3c7", color: "#78350f", marginBottom: "1rem" }}><strong>{tx("Sandbox staat aan.")}</strong> {tx("De onderdelen hieronder worden gesimuleerd. Zet hem uit voor je live gaat.")}</div>}

      <Collapsible id="sandbox-settings" title={tx("Instellingen")}>
        <label className="check sec-toggle">
          <span className="switch"><input type="checkbox" checked={s.enabled} disabled={!edit} onChange={(e) => save({ enabled: e.target.checked })} /><span /></span>
          <span><strong>{tx("Sandbox (testomgeving) aan")}</strong></span>
        </label>
        <label className="check sec-toggle">
          <span className="switch"><input type="checkbox" checked={s.banner} disabled={!edit} onChange={(e) => save({ banner: e.target.checked })} /><span /></span>
          <span>{tx("Oranje label \"SANDBOX\" op elke pagina tonen")}</span>
        </label>
        <h3>{tx("Wat wordt gesimuleerd")}</h3>
        <div className="bot-grid">
          {SIM.map(([k, label, hint]) => (
            <label key={k} className="check sec-toggle">
              <span className="switch"><input type="checkbox" checked={s.simulate[k]} disabled={!edit} onChange={(e) => save({ simulate: { [k]: e.target.checked } })} /><span /></span>
              <span>{label}<small className="muted"> {hint}</small></span>
            </label>
          ))}
        </div>
        <div className="theme-grid">
          <label>{tx("Vaste verificatiecode")} <small className="muted">{tx("leeg = willekeurig (zie postvak)")}</small>
            <input value={s.fixed_code} inputMode="numeric" maxLength={8} placeholder={tx("bv. 123456")} disabled={!edit} onChange={(e) => setS({ ...s, fixed_code: e.target.value })} onBlur={(e) => save({ fixed_code: e.target.value })} />
          </label>
          <label>{tx("Land van alle bezoekers")} <small className="muted">{tx("bij gesimuleerde landcontrole")}</small>
            <select value={s.geo_country} disabled={!edit} onChange={(e) => save({ geo_country: e.target.value })}>
              {codes.map((c) => <option key={c} value={c}>{names[c]} ({c})</option>)}
            </select>
          </label>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{tx("Niet gesimuleerd: het verplaatsen van bestanden naar S3 en het ophalen van Google Fonts. Die gebruiken nog de echte diensten.")}</p>
      </Collapsible>

      <Collapsible id="sandbox-payments" title={tx("Betalingen simuleren ({0})", payments.length)}>
        <div className="theme-grid">
          <label>{tx("Aanbieder")}<select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}><option value="mollie">{tx("Mollie")}</option><option value="stripe">{tx("Stripe")}</option></select></label>
          <label>{tx("Bedrag")}<input value={form.amount} inputMode="decimal" onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          <label>{tx("Omschrijving")}<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label>{tx("Uitkomst")}
            <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}>
              <option value="">{tx("Open laten (afronden op de betaalpagina)")}</option>
              <option value="paid">{tx("Meteen betaald")}</option><option value="failed">{tx("Meteen mislukt")}</option>
              <option value="canceled">{tx("Meteen geannuleerd")}</option><option value="expired">{tx("Meteen verlopen")}</option>
            </select>
          </label>
        </div>
        <div className="row" style={{ justifyContent: "flex-start", marginTop: ".75rem" }}>
          <button className="btn primary" disabled={!s.enabled || !s.simulate.payments || !edit}
            title={!s.enabled ? tx("Zet de sandbox aan") : ""}
            onClick={() => run(() => api("/sandbox/payments/", { method: "POST", body: form }), tx("Betaling aangemaakt."))}>{tx("Betaling simuleren")}</button>
          {!s.enabled && <span className="muted">{tx("Zet de sandbox aan om betalingen te simuleren.")}</span>}
        </div>
        <div className="int-list" style={{ marginTop: "1rem" }}>
          {payments.map((p) => (
            <div className="card int-item" key={p.ref}>
              <div className="int-main">
                <strong>{money(p)} <span className={`badge ${STATUS[p.status][1]}`} style={{ marginLeft: ".4rem" }}>{STATUS[p.status][0]}</span></strong>
                <span className="muted">{p.description || "—"} · {p.provider === "stripe" ? tx("Stripe") : tx("Mollie")} · <code>{p.ref}</code></span>
                {open === p.ref && p.events.map((e, i) => <small key={i} className="muted">{new Date(e.at).toLocaleString("nl-NL")}: {e.text}</small>)}
              </div>
              <div className="int-actions">
                <button className="btn sm" onClick={() => setOpen(open === p.ref ? null : p.ref)}>{tx("Gebeurtenissen")}</button>
                {p.status === "open" && <a className="btn sm" href={p.checkout_path} target="_blank" rel="noreferrer">{tx("Betaalpagina")}</a>}
                {p.status === "open" && edit && ["paid", "failed", "canceled", "expired"].map((o) => (
                  <button key={o} className="btn sm" onClick={() => run(() => api(`/sandbox/payments/${p.ref}/outcome/`, { method: "POST", body: { outcome: o } }))}>{STATUS[o][0]}</button>
                ))}
                {p.status === "paid" && edit && <button className="btn sm" onClick={() => run(() => api(`/sandbox/payments/${p.ref}/outcome/`, { method: "POST", body: { outcome: "refunded" } }))}>{tx("Terugbetalen")}</button>}
              </div>
            </div>
          ))}
          {!payments.length && <p className="muted">{tx("Nog geen gesimuleerde betalingen.")}</p>}
        </div>
        {payments.length > 0 && L >= 3 && <button className="btn sm danger" style={{ marginTop: ".75rem" }} onClick={async () => (await confirmDialog(tx("Alle gesimuleerde betalingen wissen?"), { danger: true })) && run(() => api("/sandbox/clear/", { method: "POST", body: { what: "payments" } }))}>{tx("Alles wissen")}</button>}
      </Collapsible>

      <Collapsible id="sandbox-inbox" title={tx("Sandbox-postvak: e-mail en sms ({0})", messages.length)}>
        <p className="muted" style={{ marginTop: 0 }}>{tx("Berichten die het systeem zou versturen. Hier vind je bijvoorbeeld de verificatiecode.")} <button className="btn sm" onClick={loadData}>{tx("Verversen")}</button></p>
        <div className="int-list">
          {messages.map((m) => (
            <div className="inbox-msg" key={m.id}>
              <span><span className={`badge ${m.kind === "sms" ? "ok" : "off"}`}>{m.kind === "sms" ? "SMS" : tx("E-mail")}</span> <strong>{m.subject || tx("(sms)")}</strong> <small className="muted">{tx("aan")} {m.to}{m.sender && tx(" · van {0}", m.sender)} · {new Date(m.created_at).toLocaleString("nl-NL")}</small></span>
              <pre>{m.body}</pre>
            </div>
          ))}
          {!messages.length && <p className="muted">{tx("Het postvak is leeg.")}</p>}
        </div>
        {messages.length > 0 && L >= 3 && <button className="btn sm danger" style={{ marginTop: ".75rem" }} onClick={() => run(() => api("/sandbox/clear/", { method: "POST", body: { what: "messages" } }))}>{tx("Postvak legen")}</button>}
      </Collapsible>
    </>
  );
}

// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import Tabs from "./Tabs";
import KitScope from "../lib/ui-kit/KitScope";
import { IconCheck } from "./Icons";

const eur = (v) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(v));

// Price (incl. VAT) per module, plugin and game: what is in use counts towards the price of the licence. Folds per group, one open at a time.
function ComponentPrices({ onTotal }) {
  const [d, setD] = useState(null);
  const [open, setOpen] = useState("");
  const [error, setError] = useState("");
  const timer = useRef(null);
  useEffect(() => { api("/system/license/prices/").then((r) => { setD(r); onTotal(r.total); }).catch((e) => setError(errorText(e))); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return error ? <div className="alert">{error}</div> : null;
  const set = (item, v) => {
    setD((x) => ({ ...x, items: x.items.map((i) => (i === item ? { ...i, price: v } : i)) }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => api("/system/license/prices/", { method: "PUT", body: { prices: { [`${item.kind}:${item.key}`]: v } } }).then((r) => { setD((x) => ({ ...x, total: r.total, in_use: r.in_use })); onTotal(r.total); }).catch((e) => setError(errorText(e))), 600);
  };
  const groups = [...new Set(d.items.map((i) => i.group))];
  return (
    <div style={{ display: "grid", gap: ".4rem" }}>
      {error && <div className="alert">{error}</div>}
      <div className="card" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem" }}>
        <span>{tx("Licentieprijs nu")}: <strong>{eur(d.monthly)}</strong> {tx("per maand")} · <strong>{eur(d.quarterly)}</strong> {tx("per kwartaal")} · <strong>{eur(d.yearly)}</strong> {tx("per jaar")} <small className="muted">({tx("incl. btw")})</small></span>
        <small className="muted">{tx("Per maand")}: {tx("basisprijs")} {eur(d.base_price)} + {tx("in gebruik")} {eur(d.in_use)}</small>
      </div>
      {groups.map((g) => {
        const list = d.items.filter((i) => i.group === g), isOpen = open === g, used = list.filter((i) => i.active).reduce((a, i) => a + Number(i.price || 0), 0);
        return (
          <div key={g} className="info-acc">
            <button type="button" className="info-acc-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? "" : g)}><span>{tx(g)}</span><span className="info-ver">{eur(used)} <span className="info-chev" data-open={isOpen}>▾</span></span></button>
            {isOpen && (
              <div style={{ display: "grid", gap: ".35rem", padding: ".5rem .2rem" }}>
                {list.map((i) => (
                  <label key={`${i.kind}:${i.key}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".6rem" }}>
                    <span>{tx(i.label)} <small className="muted">{i.active ? tx("in gebruik") : tx("uit")}</small></span>
                    {i.computed
                      ? <span style={{ width: 110, textAlign: "right" }} title={tx("Berekend uit de backup-limieten: stel de prijs per backup hiernaast bij Verlengen in")}>{eur(i.price)}</span>
                      : <input type="number" step="0.01" value={i.price} readOnly title={tx("Komt uit de prijslijst (Super admin → Prijzen)")} style={{ width: 110, opacity: .8 }} />}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


const METHOD_HINT = { online: "De gebruiker betaalt elke periode zelf online, bijvoorbeeld met iDEAL of creditcard.", auto: "Elke periode wordt het bedrag automatisch geïncasseerd (een abonnement).", invoice: "De gebruiker krijgt een factuur en betaalt die zelf." };

// The Stripe account of the licence: its own keys, apart from the Stripe link of the website's own shop (Admin -> API keys).
function StripeSettings({ setError }) {
  const [s, setS] = useState(null);
  const [form, setForm] = useState({ secret_key: "", webhook_secret: "" });
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/system/license/stripe/").then(setS).catch((e) => setError(errorText(e))); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return null;
  const save = async (patch, msg) => {
    setBusy(true); setNote(null);
    try { const r = await api("/system/license/stripe/", { method: "PUT", body: patch }); setS(r); setForm({ secret_key: "", webhook_secret: "" }); setNote({ ok: true, text: msg || tx("Opgeslagen.") }); } catch (e) { setNote({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const test = async () => {
    setBusy(true); setNote(null);
    try { const r = await api("/system/license/stripe/", { method: "POST", body: {} }); setNote({ ok: r.ok, text: r.message }); } catch (e) { setNote({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const methods = s.payment_methods || [];
  return (
    <section className="e2e-stack" style={{ gap: "1rem", padding: "1.2rem 1.3rem", border: "1px solid var(--line)", borderRadius: "var(--radius, 12px)", background: "var(--card)" }} data-easy2edit-tag="ui-form-fields">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>{tx("Stripe voor de licentie")}</h3>
          <span className="e2e-hint">{tx("Dit is het Stripe-account van wie de licentie verkoopt, niet de Stripe-koppeling van de website zelf (die staat bij Admin → API keys en wordt hier nooit gebruikt). De sleutels worden versleuteld bewaard en komen nooit terug op dit scherm.")}</span>
        </div>
        <span className={`e2e-badge ${s.enabled && s.has_secret_key ? "e2e-badge--success" : ""}`}>{s.enabled && s.has_secret_key ? (s.mode === "live" ? tx("live") : tx("test")) : tx("uit")}</span>
      </div>
      {note && <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">{note.ok ? <IconCheck width={14} height={14} /> : "!"}</span><div>{note.text}</div></div>}
      <label className="e2e-switch" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: ".75rem" }}>
        <input type="checkbox" checked={s.enabled} disabled={busy || !s.has_secret_key} onChange={(e) => save({ enabled: e.target.checked })} />
        <span><strong>{tx("Licentiebetalingen via Stripe")}</strong></span>
      </label>
      <div className="e2e-grid" style={{ "--e2e-min": "300px", gap: "1rem" }}>
        <div className="e2e-field">
          <label className="e2e-label" htmlFor="ls-sk">{tx("Geheime sleutel (sk_… of rk_…)")}</label>
          <input id="ls-sk" className="e2e-input" type="password" autoComplete="off" value={form.secret_key} onChange={(e) => setForm({ ...form, secret_key: e.target.value })} placeholder={s.has_secret_key ? `${tx("Ingesteld")} ${s.secret_key_hint}` : "sk_live_…"} />
        </div>
        <div className="e2e-field">
          <label className="e2e-label" htmlFor="ls-wh">{tx("Webhook-geheim (whsec_…)")}</label>
          <input id="ls-wh" className="e2e-input" type="password" autoComplete="off" value={form.webhook_secret} onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })} placeholder={s.has_webhook_secret ? tx("Ingesteld") : "whsec_…"} />
        </div>
      </div>
      <div className="e2e-field">
        <span className="e2e-label">{tx("Betaalmethoden in Stripe Checkout")}</span>
        <div className="e2e-row" style={{ gap: "1.2rem", flexWrap: "wrap" }}>
          {s.methods.map((m) => (
            <label key={m.key} className="e2e-check"><input type="checkbox" checked={methods.includes(m.key)} disabled={busy} onChange={(e) => save({ payment_methods: e.target.checked ? [...methods, m.key] : methods.filter((x) => x !== m.key) })} /> {tx(m.label)}</label>
          ))}
        </div>
        <span className="e2e-hint">{tx("Niets aanvinken = de instellingen van je Stripe-dashboard")}</span>
      </div>
      <div className="e2e-field" style={{ maxWidth: 360 }}>
        <label className="e2e-label" htmlFor="ls-desc">{tx("Omschrijving op het bankafschrift (max. 22 tekens)")}</label>
        <input id="ls-desc" className="e2e-input" value={s.descriptor || ""} maxLength={22} onChange={(e) => setS({ ...s, descriptor: e.target.value })} onBlur={(e) => save({ descriptor: e.target.value })} placeholder="EASY2EDIT LICENTIE" />
      </div>
      <div className="e2e-row" style={{ gap: ".6rem", flexWrap: "wrap" }} data-easy2edit-tag="ui-button-variants">
        <button type="button" className="e2e-btn" disabled={busy || (!form.secret_key && !form.webhook_secret)} onClick={() => save({ secret_key: form.secret_key, webhook_secret: form.webhook_secret })}>{tx("Sleutels opslaan")}</button>
        <button type="button" className="e2e-btn e2e-btn--outline" disabled={busy || !s.has_secret_key} onClick={test}>{tx("Verbinding testen")}</button>
        {s.has_secret_key && <button type="button" className="e2e-btn e2e-btn--ghost" style={{ color: "var(--e2e-danger)", marginLeft: "auto" }} disabled={busy} onClick={() => save({ clear_keys: true }, tx("De sleutels zijn verwijderd."))}>{tx("Sleutels verwijderen")}</button>}
      </div>
      <div style={{ padding: ".8rem 1rem", borderRadius: "var(--radius, 10px)", background: "var(--bg)", border: "1px solid var(--line)", display: "grid", gap: ".3rem" }}>
        <strong style={{ fontSize: ".85rem" }}>{tx("Webhook in Stripe instellen")}</strong>
        <code style={{ wordBreak: "break-all", fontSize: ".82rem" }}>{s.webhook_url}</code>
        <span className="e2e-hint">{tx("Zet in Stripe (Ontwikkelaars → Webhooks) dit adres met de gebeurtenissen checkout.session.completed, invoice.paid, invoice.payment_failed en customer.subscription.deleted, en plak het geheim hierboven.")}</span>
      </div>
    </section>
  );
}

// Super admin: the licence number of this installation and the client (opdrachtgever). Both show in the Info pop-up.
export default function LicenseAdmin() {
  const [lic, setLic] = useState(null);
  const [tab, setTab] = useState("license");
  const [error, setError] = useState("");
  const timer = useRef(null);
  useEffect(() => { api("/system/license/").then(setLic).catch((e) => setError(errorText(e))); }, []);
  if (!lic) return error ? <div className="alert">{error}</div> : null;
  const field = (k, v) => {
    setLic(k.startsWith("reseller_") ? { ...lic, reseller: { ...(lic.reseller || {}), [k.slice(9)]: v } } : { ...lic, [k]: v });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => api("/system/license/", { method: "PUT", body: { [k]: v } }).then((r) => setLic((x) => ({ ...x, expired: r.expired, has: r.has, price: r.price, monthly: r.monthly, quarterly: r.quarterly, yearly: r.yearly, backup_slots: r.backup_slots }))).catch((e) => setError(errorText(e))), 600); // saved by itself
  };
  const reload = () => api("/system/license/").then(setLic).catch((e) => setError(errorText(e)));
  const setMethod = async (m) => {  // the way the user pays: one is active (choosing another one stops collecting by itself)
    setError("");
    try { const r = await api("/system/license/", { method: "PUT", body: { payment_method: m } }); setLic((x) => ({ ...x, billing: r.billing })); } catch (e) { setError(errorText(e)); }
  };
  const sub = async (what) => { setError(""); try { const r = await api("/system/license/subscribe/", what === "stop" ? { method: "DELETE" } : { method: "POST", body: {} }); if (what !== "stop" && r.url && !/^https?:/.test(r.url)) { window.location.assign(r.url); return; } await reload(); } catch (e) { setError(errorText(e)); } };
  const invoicePaid = async () => {
    if (!(await confirmDialog(tx("Is de factuur betaald? De licentie loopt dan een periode door."), { okLabel: tx("Verlengen"), cancelLabel: tx("Annuleren") }))) return;
    try { setLic(await api("/system/license/invoice-paid/", { method: "POST", body: {} })); } catch (e) { setError(errorText(e)); }
  };
  const remove = async () => {
    if (!(await confirmDialog(tx("De licentie leegmaken en verwijderen? De website werkt daarna zonder licentie en toont onderaan elke pagina dat er geen licentie in gebruik is."), { okLabel: tx("Licentie verwijderen"), cancelLabel: tx("Annuleren") }))) return;
    try { setLic(await api("/system/license/", { method: "DELETE" })); } catch (e) { setError(errorText(e)); }
  };
  const make = async () => {
    if (lic.number && !(await confirmDialog(tx("Er is al een licentienummer. Een nieuw nummer vervangt het huidige. Doorgaan?"), { okLabel: tx("Nieuw nummer"), cancelLabel: tx("Annuleren") }))) return;
    try { setLic(await api("/system/license/", { method: "POST", body: {} })); } catch (e) { setError(errorText(e)); }
  };
  return (
    <div style={{ display: "grid", gap: ".8rem" }}>
      {error && <div className="alert">{error}</div>}
      {lic.expired && <div className="alert">{tx("De licentie is verlopen: de website toont de onderhoudspagina.")}</div>}
      <Tabs value={tab} onChange={setTab} tabs={[["license", "Licentie"], ["reseller", "Reseller"], ["prices", "Prijzen"], ["pay", "Betalen"]]} />
      {tab === "license" && (
        <div className="lic-cols">
        <section className="lic-col">
          <h3>{tx("Licentie")}</h3>
          <label>{tx("Opdrachtgever")}<input value={lic.client} maxLength={200} onChange={(e) => field("client", e.target.value)} placeholder={tx("Naam van de opdrachtgever van deze website")} /></label>
          <label>{tx("Hoofd-URL")}<input value={lic.main_url || ""} maxLength={300} onChange={(e) => field("main_url", e.target.value)} placeholder="www.voorbeeld.nl" inputMode="url" /></label>
          <div className="addr-grid">
            {[["street", "Straat", "a-street", { autoComplete: "address-line1" }], ["house_number", "Huisnummer", "a-nr", { maxLength: 12 }], ["postal_code", "Postcode", "a-zip", { maxLength: 10, autoComplete: "postal-code" }], ["city", "Plaats", "a-city", { autoComplete: "address-level2" }], ["country", "Land", "a-country", { placeholder: "Nederland" }]].map(([k, label, cls, rest]) => (
              <label key={k} className={cls}>{tx(label)}<input value={lic.client_parts?.[k] || ""} onChange={(e) => field("client_parts", { ...(lic.client_parts || {}), [k]: e.target.value })} {...rest} /></label>
            ))}
          </div>
          <label>{tx("Licentie geldig tot")}<input type="date" value={lic.valid_until || ""} onChange={(e) => field("valid_until", e.target.value)} />
            <small className="muted" style={{ display: "block" }}>{tx("Leeg = geen einddatum. Na deze datum ziet iedereen de onderhoudspagina; superadmins kunnen nog inloggen om de licentie te verlengen.")}</small></label>
          {(lic.billing?.methods || []).length > 0 && (
            <label>{tx("Betaalwijze van deze licentie")}
              <select value={lic.billing.method || ""} onChange={(e) => setMethod(e.target.value)}>
                {lic.billing.methods.map((m) => <option key={m.key} value={m.key}>{tx(m.label)}</option>)}
              </select>
              <small className="muted" style={{ display: "block" }}>{tx(METHOD_HINT[lic.billing.method] || "")} {tx("Je kunt dit ook instellen op het tabblad Betalen.")}</small></label>
          )}
          <div style={{ display: "flex", gap: ".6rem", alignItems: "end", flexWrap: "wrap" }}>
            <label style={{ flex: 1, minWidth: 180 }}>{tx("Licentienummer")}<input value={lic.number} readOnly placeholder={tx("Nog niet gemaakt")} style={{ fontFamily: "monospace", letterSpacing: ".05em" }} /></label>
            <button type="button" className="btn primary" onClick={make}>{lic.number ? tx("Nieuw nummer maken") : tx("Nummer maken")}</button>
          </div>
          {lic.issued_at && <small className="muted">{tx("Uitgegeven op")} {new Date(lic.issued_at).toLocaleString()}</small>}
          {lic.has && <div><button type="button" className="btn danger" onClick={remove}>{tx("Licentie leegmaken en verwijderen")}</button></div>}
        </section>
        </div>
      )}
      {tab === "reseller" && (
        <section className="lic-col">
          <h3>{tx("Reseller")}</h3>
          <label>{tx("Reseller")}<input value={lic.reseller?.name || ""} maxLength={120} onChange={(e) => field("reseller_name", e.target.value)} placeholder={tx("Naam van de reseller")} /></label>
          <label>{tx("E-mail reseller")}<input type="email" value={lic.reseller?.email || ""} onChange={(e) => field("reseller_email", e.target.value)} /></label>
          <label>{tx("Link om de licentie te bestellen of te betalen")}<input value={lic.reseller?.url || ""} placeholder="https://…" onChange={(e) => field("reseller_url", e.target.value)} /></label>
        </section>
      )}
      {tab === "prices" && (
        <div className="lic-cols">
        <section className="lic-col">
          <h3 style={{ marginTop: ".6rem" }}>{tx("Licentieprijs")}</h3>
          <div className="grid2">
            <label>{tx("Basisprijs per maand (incl. btw)")}<input type="number" value={lic.base_price ?? 0} readOnly title={tx("Komt uit de prijslijst (Super admin → Prijzen)")} /><small className="muted">{tx("Uit de prijslijst (pricing.json). Pas aan bij Super admin → Prijzen.")}</small></label>
            <label>{tx("Betaalperiode")}
              <select value={lic.renew_months ?? 12} onChange={(e) => field("renew_months", e.target.value)}>
                <option value={1}>{tx("Per maand")}</option><option value={3}>{tx("Per kwartaal")}</option><option value={12}>{tx("Per jaar")}</option>
              </select>
            </label>
            <label>{tx("Backups in de basisprijs")}<input type="number" min="0" max="1000" value={lic.backup_included ?? 5} onChange={(e) => field("backup_included", e.target.value)} /></label>
            <label>{tx("Prijs per extra backup per maand (incl. btw)")}<input type="number" min="0" step="0.01" value={lic.backup_slot_price ?? 0} onChange={(e) => field("backup_slot_price", e.target.value)} /></label>
          </div>
          <div className="card" style={{ display: "grid", gap: ".2rem" }}>
            <span>{tx("Per maand")}: <strong>{eur(lic.monthly ?? 0)}</strong> · {tx("per kwartaal")}: <strong>{eur(lic.quarterly ?? 0)}</strong> · {tx("per jaar")}: <strong>{eur(lic.yearly ?? 0)}</strong></span>
            <small className="muted">{tx("Een verlenging kost nu {0} ({1}).", eur(lic.price ?? 0), lic.renew_months === 1 ? tx("per maand") : lic.renew_months === 3 ? tx("per kwartaal") : tx("per jaar"))} {tx("De backup-limieten tellen mee: {0} backups in totaal.", lic.backup_slots ?? 0)}</small>
          </div>
          <small className="muted">{tx("Alle prijzen zijn per maand en incl. btw: de basisprijs plus alles wat in gebruik is (modules, plugins, spelletjes en het aantal backups boven wat in de basisprijs zit). De betaalperiode bepaalt hoeveel maanden je in één keer betaalt. Met een prijs boven 0 kunnen beheerders de licentie zelf betalen (Beheer → Licentie).")}</small>
        </section>
        <section className="lic-col">
          <h3>{tx("Prijzen per onderdeel")}</h3>
          <ComponentPrices key={`${lic.base_price}-${lic.backup_included}-${lic.backup_slot_price}-${lic.backup_slots}`} onTotal={(t) => setLic((x) => ({ ...x, price: t }))} />
        </section>
        </div>
      )}
      {tab === "pay" && (
        <KitScope tag="ui-form-fields">
          <div className="e2e-stack" style={{ gap: "1.2rem" }}>
            <section className="e2e-stack" style={{ gap: "1rem", padding: "1.2rem 1.3rem", border: "1px solid var(--line)", borderRadius: "var(--radius, 12px)", background: "var(--card)" }}>
              <div>
                <h3 style={{ margin: 0 }}>{tx("Betaalwijze van de gebruiker")}</h3>
                <span className="e2e-hint">{tx("Hoe betaalt deze gebruiker de licentie? Er is er altijd precies één actief.")}</span>
              </div>
              <div className="e2e-grid" style={{ "--e2e-min": "220px", gap: ".8rem" }} role="radiogroup" aria-label={tx("Betaalwijze van de gebruiker")}>
                {(lic.billing?.methods || []).map((m) => {
                  const on = lic.billing.method === m.key;
                  return (
                    <label key={m.key} style={{ display: "flex", gap: ".7rem", alignItems: "flex-start", padding: ".85rem 1rem", border: `1px solid ${on ? "var(--e2e-primary)" : "var(--line)"}`, borderRadius: "var(--radius, 10px)", background: on ? "var(--e2e-primary-soft, transparent)" : "transparent", cursor: "pointer" }}>
                      <input type="radio" name="lic-method" checked={on} onChange={() => setMethod(m.key)} style={{ flex: "0 0 auto", width: "1.05rem", height: "1.05rem", margin: ".2rem 0 0" }} />
                      <span style={{ flex: 1, minWidth: 0 }}><strong>{tx(m.label)}</strong><br /><span className="e2e-hint">{tx(METHOD_HINT[m.key] || "")}</span></span>
                      {on && <span className="e2e-badge e2e-badge--success">{tx("actief")}</span>}
                    </label>
                  );
                })}
              </div>
              {lic.billing?.method === "auto" && (
                <div style={{ display: "flex", alignItems: "center", gap: ".8rem", flexWrap: "wrap", padding: ".8rem 1rem", borderRadius: "var(--radius, 10px)", background: "var(--bg)", border: "1px solid var(--line)" }} data-easy2edit-tag="ui-button-variants">
                  <span><strong>{tx("Abonnement")}</strong> <span className={`e2e-badge ${lic.billing?.sub_status === "active" ? "e2e-badge--success" : ""}`}>{lic.billing?.sub_status === "active" ? tx("actief") : lic.billing?.sub_status === "cancelled" ? tx("gestopt") : tx("niet gestart")}</span>{lic.billing?.sub_provider && <span className="e2e-hint"> · {lic.billing.sub_provider}</span>}</span>
                  <span style={{ marginLeft: "auto", display: "inline-flex", gap: ".5rem", flexWrap: "wrap" }}>
                    {lic.billing?.sub_status !== "active"
                      ? <button type="button" className="e2e-btn e2e-btn--sm" onClick={() => sub("start")}>{tx("Abonnement maken (automatische incasso)")}</button>
                      : <button type="button" className="e2e-btn e2e-btn--outline e2e-btn--sm" onClick={() => sub("stop")}>{tx("Abonnement stoppen")}</button>}
                  </span>
                </div>
              )}
              {lic.billing?.method === "invoice" && (
                <div style={{ display: "flex", alignItems: "center", gap: ".8rem", flexWrap: "wrap", padding: ".8rem 1rem", borderRadius: "var(--radius, 10px)", background: "var(--bg)", border: "1px solid var(--line)" }}>
                  <span className="e2e-hint">{tx("De factuur wordt iedere 1e van de maand verstuurd.")}</span>
                  <button type="button" className="e2e-btn e2e-btn--outline e2e-btn--sm" style={{ marginLeft: "auto" }} onClick={invoicePaid}>{tx("Factuur betaald: licentie verlengen")}</button>
                </div>
              )}
              <span className="e2e-hint">{lic.billing?.provider ? `${tx("Betaallink")}: ${lic.billing.provider}` : tx("Er is nog geen betaallink (Mollie of Stripe) gekoppeld bij Admin → API keys; met de sandbox aan kun je het testen.")}</span>
            </section>
            <section className="e2e-stack" style={{ gap: ".8rem", padding: "1.2rem 1.3rem", border: "1px solid var(--line)", borderRadius: "var(--radius, 12px)", background: "var(--card)" }}>
              <div>
                <h3 style={{ margin: 0 }}>{tx("Wat ziet de beheerder")}</h3>
                <span className="e2e-hint">{tx("Welke manieren van betalen krijgt de beheerder te zien (Admin → Systeem → Licentie)?")}</span>
              </div>
              <div className="e2e-row" style={{ gap: "1.4rem", flexWrap: "wrap" }}>
                {(lic.billing?.methods || []).map((m) => {
                  const cur = lic.billing.allowed || [];
                  return (
                    <label key={m.key} className="e2e-switch" style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: ".6rem" }}>
                      <input type="checkbox" checked={cur.includes(m.key)} disabled={cur.includes(m.key) && (cur.length === 1 || lic.billing.method === m.key)}
                        onChange={(e) => { const next = e.target.checked ? [...cur, m.key] : cur.filter((x) => x !== m.key); setLic((x) => ({ ...x, billing: { ...x.billing, allowed: next, methods: x.billing.methods.map((y) => ({ ...y, offered: next.includes(y.key) })) } })); field("allowed_methods", next); }} />
                      <span>{tx(m.label)}</span>
                    </label>
                  );
                })}
              </div>
            </section>
            <StripeSettings setError={setError} />
          </div>
        </KitScope>
      )}
    </div>
  );
}

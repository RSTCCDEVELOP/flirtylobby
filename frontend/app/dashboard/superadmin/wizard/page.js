"use client";

import { useEffect, useMemo, useState } from "react";
import { api, errorText, apiBase, getToken } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { tx } from "../../../../lib/t";
import Tabs from "../../../../components/Tabs";
import PriceBlock from "../../../../components/PriceBlock";

const eur = (v) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(v));

// Installation and licence wizard: name and website, questions about what is needed, the modules and plugins that follow from it, the price per month, quarter and year, and then set up.
export default function Wizard() {
  const [conf, setConf] = useState(null);
  const [step, setStep] = useState(0);
  const [cu, setCu] = useState({ company: "", first_name: "", last_name: "", email: "", phone: "", mobile: "", street: "", postal_code: "", city: "", country: "Nederland", kvk: "", vat_id: "" });
  const [rs, setRs] = useState({ company: "Studio2", first_name: "Ronald", last_name: "Stolk", email: "info@studio2.nl", phone: "085 201 77 85", mobile: "", street: "Ambachtsweg 46", postal_code: "3542 DH", city: "Utrecht", country: "Nederland", website: "https://www.studio2.nl" });
  const setR = (k) => (e) => setRs({ ...rs, [k]: e.target.value });
  const [tab0, setTab0] = useState("customer");
  const setC = (k) => (e) => setCu({ ...cu, [k]: e.target.value });
  const name = cu.company;
  const [site, setSite] = useState("");
  const [answers, setAnswers] = useState({ hosting: "shared", email: 0 });
  const [plan, setPlan] = useState(null);
  const [period, setPeriod] = useState("year");
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState("nl");
  const [mailTo, setMailTo] = useState("");
  const [cfgDoc, setCfgDoc] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api("/system/wizard/").then((c) => { setConf(c); setAnswers((a) => ({ ...a, hosting: c.default_hosting, email: Number(c.default_email) || 0 })); setCu((x) => ({ ...x, company: c.settings.client || x.company })); if (c.reseller) setRs((x) => ({ ...x, ...c.reseller })); setSite(c.settings.site_name || ""); }).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, []);
  const key = JSON.stringify(answers);
  useEffect(() => { if (step >= 3) api("/system/wizard/", { method: "POST", body: { answers } }).then(setPlan).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, [step, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const mailTier = (n) => { let per = 0; (conf?.email?.tiers || []).forEach((t) => { if (n >= t.from) per = t.price; }); return per; };
  const mailPer = mailTier(Number(answers.email) || 0), mailPrice = mailPer * (Number(answers.email) || 0);
  const visible = useMemo(() => (conf?.questions || []).filter((q) => (q.requires || []).every((r) => answers[r])), [conf, answers]);
  if (!conf) return msg ? <div className="alert">{msg.text}</div> : null;
  const STEPS = [tx("Gegevens"), tx("Vragen"), tx("Hosting en e-mail"), tx("Overzicht en prijs"), tx("Installeren")];
  const run = async () => {
    if (!(await confirmDialog(tx("De modules en plugins worden nu ingesteld zoals in het overzicht. Je gegevens blijven bestaan. Doorgaan?"), { okLabel: tx("Installeren"), cancelLabel: tx("Annuleren") }))) return;
    setBusy(true); setMsg(null);
    try { await api("/system/wizard/", { method: "POST", body: { answers, apply: true, customer: cu, reseller: rs, site_name: site, period, lang } }); setStep(4); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const body = () => ({ answers, customer: cu, reseller: rs, site_name: site, period, lang });
  const download = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`${apiBase()}/api/system/wizard/pdf/`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Token ${getToken()}` }, body: JSON.stringify({ ...body(), mode: "download" }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `${tx("Het maken van de PDF is mislukt.")} (${res.status})`);
      const a = document.createElement("a"); a.href = URL.createObjectURL(await res.blob()); a.download = `easy2edit-offerte-${[cu.company, site].filter(Boolean).filter((x, i, l) => l.indexOf(x) === i).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "website"}.pdf`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };
  const mail = async () => {
    setBusy(true); setMsg(null);
    try { const r = await api("/system/wizard/pdf/", { method: "POST", body: { ...body(), mode: "mail", email: mailTo || cu.email } }); setMsg({ ok: true, text: tx("De offerte is gemaild naar {0}.", r.sent) }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const downloadConfig = async () => {
    setMsg(null);
    try {
      const doc = await api("/system/wizard/", { method: "POST", body: { ...body(), config: true } });
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" })); a.download = `easy2edit-installatie-${[cu.company, site].filter(Boolean).filter((x, i, l) => l.indexOf(x) === i).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "website"}.json`; document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  const chosen = plan?.periods?.find((p) => p.key === period);
  return (
    <>
      <h1 style={{ marginBottom: "1.4rem" }}>{tx("Installatie en licentie")}</h1>
      <ol className="wz-steps">{STEPS.map((l, i) => <li key={l} className={step === i ? "on" : step > i ? "done" : ""}><button type="button" disabled={i > step} onClick={() => setStep(i)}><span className="wz-n">{step > i ? "✓" : i + 1}</span><span>{l}</span></button></li>)}</ol>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}

      {step === 0 && (
        <div className="card wz-card" style={{ maxWidth: 900 }}>
          <h2 style={{ margin: 0 }}>{tx("Voor wie is deze website?")}</h2>
          <p className="muted" style={{ margin: 0 }}>{tx("De belangrijkste gegevens. KvK- en btw-nummer vragen we aan het eind.")}</p>
          <Tabs tabs={[["customer", tx("Klant")], ["reseller", tx("Reseller")]]} value={tab0} onChange={setTab0} />
          {tab0 === "customer" ? (
          <div className="pe-cols">
            <label>{tx("Bedrijfsnaam")}<input value={cu.company} onChange={setC("company")} maxLength={200} autoFocus /></label>
            <label>{tx("Naam van de website")}<input value={site} onChange={(e) => setSite(e.target.value)} maxLength={100} /></label>
            <label>{tx("Voornaam")}<input value={cu.first_name} onChange={setC("first_name")} maxLength={100} autoComplete="given-name" /></label>
            <label>{tx("Achternaam")}<input value={cu.last_name} onChange={setC("last_name")} maxLength={100} autoComplete="family-name" /></label>
            <label>{tx("Adres (straat en huisnummer)")}<input value={cu.street} onChange={setC("street")} autoComplete="street-address" /></label>
            <label>{tx("Postcode")}<input value={cu.postal_code} onChange={setC("postal_code")} autoComplete="postal-code" /></label>
            <label>{tx("Plaats")}<input value={cu.city} onChange={setC("city")} autoComplete="address-level2" /></label>
            <label>{tx("Land")}<input value={cu.country} onChange={setC("country")} autoComplete="country-name" /></label>
            <label>{tx("E-mailadres")}<input type="email" value={cu.email} onChange={setC("email")} maxLength={200} autoComplete="email" /></label>
            <label>{tx("Telefoonnummer")}<input type="tel" value={cu.phone} onChange={setC("phone")} autoComplete="tel" /></label>
            <label>{tx("Mobiel")}<input type="tel" value={cu.mobile} onChange={setC("mobile")} autoComplete="tel" /></label>
          </div>
          ) : (
          <div className="pe-cols">
            <label>{tx("Naam van de reseller (bedrijf)")}<input value={rs.company} onChange={setR("company")} maxLength={200} /></label>
            <label>{tx("Voornaam")}<input value={rs.first_name} onChange={setR("first_name")} maxLength={100} /></label>
            <label>{tx("Achternaam")}<input value={rs.last_name} onChange={setR("last_name")} maxLength={100} /></label>
            <label>{tx("Adres (straat en huisnummer)")}<input value={rs.street} onChange={setR("street")} autoComplete="street-address" /></label>
            <label>{tx("Postcode")}<input value={rs.postal_code} onChange={setR("postal_code")} autoComplete="postal-code" /></label>
            <label>{tx("Plaats")}<input value={rs.city} onChange={setR("city")} autoComplete="address-level2" /></label>
            <label>{tx("Land")}<input value={rs.country} onChange={setR("country")} autoComplete="country-name" /></label>
            <label>{tx("E-mailadres")}<input type="email" value={rs.email} onChange={setR("email")} maxLength={200} autoComplete="email" /></label>
            <label>{tx("Telefoonnummer")}<input type="tel" value={rs.phone} onChange={setR("phone")} autoComplete="tel" /></label>
            <label>{tx("Mobiel")}<input type="tel" value={rs.mobile} onChange={setR("mobile")} autoComplete="tel" /></label>
                      <label>{tx("Website")}<input value={rs.website} onChange={setR("website")} placeholder="https://" /></label>
          </div>
          )}
          <div><button type="button" className="btn primary" disabled={!cu.company.trim() || !site.trim() || !cu.first_name.trim() || !cu.last_name.trim() || !cu.email.includes("@")} onClick={() => setStep(1)}>{tx("Volgende")}</button></div>
        </div>
      )}

      {step === 1 && (
        <div className="stack" style={{ gap: "2rem", maxWidth: 980 }}>
          <div>
            <h2 style={{ margin: 0 }}>{tx("Wat heb je nodig?")}</h2>
            <p className="muted" style={{ margin: ".3rem 0 0" }}>{tx("Zet aan wat voor jou geldt. De basis (website, bewerkmodus, media, thema's, talen en beveiliging) zit er altijd bij.")}</p>
          </div>
          <div className="wz-grid">
            {visible.map((q) => (
              <label key={q.key} className={`wz-q${answers[q.key] ? " on" : ""}`}>
                <span className="switch"><input type="checkbox" checked={!!answers[q.key]} onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.checked })} /><span /></span>
                <span className="wz-text"><strong>{tx(q.label)}</strong>{q.help && <small className="muted">{tx(q.help)}</small>}</span>
              </label>
            ))}
          </div>
          <div className="row" style={{ gap: ".5rem" }}><button type="button" className="btn" onClick={() => setStep(0)}>{tx("Terug")}</button><button type="button" className="btn primary" onClick={() => setStep(2)}>{tx("Volgende")}</button></div>
        </div>
      )}

      {step === 2 && (
        <div className="stack" style={{ gap: "2rem", maxWidth: 980 }}>
          <div>
            <h2 style={{ margin: "0 0 .3rem" }}>{tx("Welke hosting wil je?")}</h2>
            <p className="muted" style={{ margin: 0 }}>{tx("Shared is het goedkoopst. Met een eigen VPS heb je meer snelheid en ruimte.")}</p>
          </div>
          <div className="wz-grid">
            {conf.hosting.map((h) => (
              <label key={h.key} className={`wz-q${answers.hosting === h.key ? " on" : ""}`}>
                <input type="radio" name="hosting" checked={answers.hosting === h.key} onChange={() => setAnswers({ ...answers, hosting: h.key })} style={{ marginTop: ".3rem" }} />
                <span className="wz-text"><strong>{tx(h.label)} · {eur(h.price)} <small className="muted">{tx("per maand ex btw")}</small></strong><small className="muted">{tx(h.desc)}</small></span>
              </label>
            ))}
          </div>
          <div>
            <h2 style={{ margin: "0 0 .3rem" }}>{tx("E-mail op je eigen domein")}</h2>
            <p className="muted" style={{ margin: 0 }}>{tx("Kies hoeveel e-mailadressen je wilt, bijvoorbeeld info@jouwbedrijf.nl.")}</p>
          </div>
          <div className="wz-slider">
            <div className="wz-slider-top">
              <div><strong className="wz-count">{answers.email}</strong> <span className="muted">{tx("e-mailadressen")}</span></div>
              <div className="wz-slider-price">{Number(answers.email) ? <><strong>{eur(mailPrice)}</strong> <small className="muted">{tx("per maand ex btw")} · {eur(mailPer)} {tx("per adres")}</small></> : <span className="muted">{tx("Geen e-mail: gratis")}</span>}</div>
            </div>
            <div className="row" style={{ gap: ".8rem", flexWrap: "nowrap" }}>
              <button type="button" className="btn sm" aria-label={tx("Minder")} onClick={() => setAnswers({ ...answers, email: Math.max(0, Number(answers.email) - 1) })}>−</button>
              <input type="range" min="0" max={conf.email.max} step="1" value={answers.email} onChange={(e) => setAnswers({ ...answers, email: Number(e.target.value) })} style={{ flex: 1 }} aria-label={tx("Aantal e-mailadressen")} />
              <button type="button" className="btn sm" aria-label={tx("Meer")} onClick={() => setAnswers({ ...answers, email: Math.min(conf.email.max, Number(answers.email) + 1) })}>+</button>
            </div>
            <small className="muted">{conf.email.tiers.map((t, i) => `${tx("vanaf")} ${t.from}: ${eur(t.price)}`).join(" · ")} {tx("per adres. Hoe meer adressen, hoe lager de prijs per adres.")}</small>
          </div>
          <div className="row" style={{ gap: ".5rem" }}><button type="button" className="btn" onClick={() => setStep(1)}>{tx("Terug")}</button><button type="button" className="btn primary" onClick={() => setStep(3)}>{tx("Volgende")}</button></div>
        </div>
      )}

      {step === 3 && plan && (
        <div className="stack" style={{ gap: "2rem" }}>
          <div className="card wz-card" style={{ maxWidth: 980 }}>
            <h2 style={{ margin: 0 }}>{tx("Wat je krijgt")}</h2>
            <small className="muted">{plan.modules.length} {tx("modules")}{plan.plugins.length ? ` · ${tx("plugins")}: ${plan.plugins.join(", ")}` : ""}</small>
            <div className="pr-lines big">
              {plan.lines.map((l) => <div key={l.label}><span>{tx(l.label)}</span><span>{eur(l.price)} <small className="muted">{tx("per maand")}</small></span></div>)}
              <div className="total"><span>{tx("Totaal per maand")}</span><span>{eur(plan.monthly)}</span></div>
            </div>
          </div>
          <div style={{ maxWidth: 980 }}><PriceBlock price={plan} period={period} onPeriod={setPeriod} /></div>
          <div className="card wz-card" style={{ maxWidth: 980 }}>
            <h2 style={{ margin: 0 }}>{tx("Offerte als PDF")}</h2>
            <div className="pe-cols">
              <label>{tx("Taal van de offerte")}<select value={lang} onChange={(e) => setLang(e.target.value)}>{[["nl", "Nederlands"], ["en", "English"], ["de", "Deutsch"], ["fr", "Français"], ["es", "Español"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label>{tx("E-mailadres om de offerte naartoe te sturen")}<input type="email" value={mailTo || cu.email} onChange={(e) => setMailTo(e.target.value)} placeholder="naam@bedrijf.nl" /></label>
            </div>
            <div className="row" style={{ gap: ".6rem", flexWrap: "wrap" }}>
              <button type="button" className="btn" disabled={busy} onClick={download}>⬇ {tx("PDF downloaden")}</button>
              <button type="button" className="btn" disabled={busy || !(mailTo || cu.email).includes("@")} onClick={mail}>✉ {tx("PDF mailen")}</button>
            </div>
            <small className="muted">{tx("De offerte heeft de huisstijl van Easy2edit, met de gekozen looptijd gemarkeerd. De namen van de onderdelen staan in het Nederlands.")}</small>
          </div>
          <div className="card wz-card" style={{ maxWidth: 980 }}>
            <h2 style={{ margin: 0 }}>{tx("Nog twee gegevens voor de facturatie")}</h2>
            <div className="pe-cols">
              <label>{tx("KvK-nummer")}<input value={cu.kvk} onChange={setC("kvk")} /></label>
              <label>{tx("Btw-nummer")}<input value={cu.vat_id} onChange={setC("vat_id")} /></label>
            </div>
            <div><button type="button" className="btn" onClick={downloadConfig}>⬇ {tx("Configuratie downloaden (JSON)")}</button> <small className="muted">{tx("Daarmee kun je later op een server installeren: python manage.py install_config bestand.json")}</small></div>
          </div>
          <div className="row" style={{ gap: ".5rem" }}><button type="button" className="btn" onClick={() => setStep(2)}>{tx("Terug")}</button><button type="button" className="btn primary" disabled={busy} onClick={run}>{busy ? tx("Bezig…") : `${tx("Installeren")}${chosen ? ` (${tx(chosen.label).toLowerCase()})` : ""}`}</button></div>
        </div>
      )}

      {step === 4 && (
        <div className="card wz-card" style={{ maxWidth: 560 }}>
          <h2 style={{ margin: 0 }}>✓ {tx("Klaar")}</h2>
          <p style={{ margin: 0 }}>{tx("De website {0} is ingesteld voor {1}. De licentie staat op de gekozen periode.", site, name)}</p>
          <div><button type="button" className="btn primary" onClick={() => { window.location.href = "/dashboard/superadmin"; }}>{tx("Naar Super admin")}</button></div>
        </div>
      )}
    </>
  );
}

// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useMemo, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import PriceBlock from "./PriceBlock";
import VerifyEmail from "./VerifyEmail";
import { PresetIcon } from "./Icons";

const eur = (v) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(v));

// The calculation form as a system object on a page: the visitor picks what is needed, sees the price per month, quarter and year and has the quotation mailed as a PDF.
function Calc() {
  const [conf, setConf] = useState(null);
  const [answers, setAnswers] = useState({ hosting: "shared", email: 0 });
  const [plan, setPlan] = useState(null);
  const [period, setPeriod] = useState("year");
  const [form, setForm] = useState({ name: "", email: "", site_name: "", lang: "nl" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [ask, setAsk] = useState(false); // the pop-up that confirms the e-mail address
  const [inst, setInst] = useState("");
  const [proof, setProof] = useState({ token: "", email: "" });
  useEffect(() => { api("/sales/calculator/").then((c) => { setConf(c); setAnswers((a) => ({ ...a, hosting: c.default_hosting })); }).catch(() => setConf(false)); }, []);
  const key = JSON.stringify(answers);
  useEffect(() => { if (conf) api("/sales/calculator/plan/", { method: "POST", body: { answers } }).then(setPlan).catch(() => {}); }, [conf, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = useMemo(() => (conf?.questions || []).filter((q) => (q.requires || []).every((r) => answers[r])), [conf, answers]);
  if (conf === false) return null;
  if (!conf) return <p className="muted">{tx("Laden…")}</p>;
  const tier = (n) => { let per = 0; (conf.email?.tiers || []).forEach((t) => { if (n >= t.from) per = t.price; }); return per; };
  const mails = Number(answers.email) || 0;
  const post = async (token) => {
    setBusy(true); setMsg(null);
    try { const r = await api("/sales/calculator/quote/", { method: "POST", body: { ...form, answers, period, token, installation: (conf.installations || []).find((x) => x.key === inst)?.name || "" } }); setMsg({ ok: true, text: tx("De offerte is gemaild naar {0}.", r.sent) }); } catch (er) { setMsg({ ok: false, text: errorText(er) }); }
    setBusy(false);
  };
  const send = (e) => {
    e.preventDefault();
    if (conf.verify_email && !(proof.token && proof.email === form.email.trim().toLowerCase())) { setAsk(true); return; }
    post(proof.token);
  };
  const verified = (token, email) => { setAsk(false); setProof({ token, email: email.trim().toLowerCase() }); setForm((f) => ({ ...f, email })); post(token); };
  return (
    <div className="stack" style={{ gap: "1.6rem" }}>
      {(conf.installations || []).length > 0 && (
        <div>
          <h3 style={{ margin: "0 0 .6rem" }}>{tx("Kies een standaard installatie")}</h3>
          <div className="wz-grid">
            <label className={`wz-q${!inst ? " on" : ""}`}>
              <input type="radio" name="calc-inst" checked={!inst} onChange={() => setInst("")} />
              <span className="wz-text"><strong>{tx("Eigen samenstelling")}</strong><small className="muted">{tx("Je kiest zelf de onderdelen.")}</small></span>
            </label>
            {conf.installations.map((i) => (
              <label key={i.key} className={`wz-q${inst === i.key ? " on" : ""}`}>
                <input type="radio" name="calc-inst" checked={inst === i.key} onChange={() => { setInst(i.key); setAnswers((a) => ({ ...a, ...Object.fromEntries(conf.questions.map((q) => [q.key, false])), ...i.answers })); }} />
                <span className="wz-text"><strong><span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: ".4rem" }}><PresetIcon name={i.icon} /></span>{tx(i.name)}</strong><small className="muted">{tx(i.desc)}</small></span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="wz-grid">
        {visible.map((q) => (
          <label key={q.key} className={`wz-q${answers[q.key] ? " on" : ""}`}>
            <span className="switch"><input type="checkbox" checked={!!answers[q.key]} onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.checked })} /><span /></span>
            <span className="wz-text"><strong>{tx(q.label)}</strong>{q.help && <small className="muted">{tx(q.help)}</small>}</span>
          </label>
        ))}
      </div>
      <div>
        <h3 style={{ margin: "0 0 .6rem" }}>{tx("Welke hosting wil je?")}</h3>
        <div className="wz-grid">
          {conf.hosting.map((h) => (
            <label key={h.key} className={`wz-q${answers.hosting === h.key ? " on" : ""}`}>
              <input type="radio" name="calc-hosting" checked={answers.hosting === h.key} onChange={() => setAnswers({ ...answers, hosting: h.key })} />
              <span className="wz-text"><strong>{tx(h.label)} · {eur(h.price)} <small className="muted">{tx("per maand ex btw")}</small></strong><small className="muted">{tx(h.desc)}</small></span>
            </label>
          ))}
        </div>
      </div>
      {conf.email && <div className="wz-slider">
        <div className="wz-slider-top">
          <div><strong className="wz-count">{mails}</strong> <span className="muted">{tx("e-mailadressen")}</span></div>
          <div className="wz-slider-price">{mails ? <><strong>{eur(tier(mails) * mails)}</strong> <small className="muted">{tx("per maand ex btw")}</small></> : <span className="muted">{tx("Geen e-mail: gratis")}</span>}</div>
        </div>
        <input type="range" min="0" max={conf.email.max} step="1" value={mails} onChange={(e) => setAnswers({ ...answers, email: Number(e.target.value) })} aria-label={tx("Aantal e-mailadressen")} style={{ width: "100%" }} />
      </div>}
      {plan && (
        <>
          <div className="card wz-card">
            <h3 style={{ margin: 0 }}>{tx("Wat je krijgt")}</h3>
            <div className="pr-lines big">
              {plan.lines.map((l) => <div key={l.label}><span>{tx(l.label)}</span><span>{eur(l.price)} <small className="muted">{tx("per maand")}</small></span></div>)}
              <div className="total"><span>{tx("Totaal per maand")}</span><span>{eur(plan.monthly)}</span></div>
            </div>
          </div>
          <PriceBlock price={plan} period={period} onPeriod={setPeriod} purchase={false} />
          <form className="card wz-card" onSubmit={send}>
            <h3 style={{ margin: 0 }}>{tx("Offerte per e-mail")}</h3>
            <div className="pe-cols">
              <label>{tx("Je naam")}<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} required /></label>
              <label>{tx("E-mailadres")}<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={200} required /></label>
              <label>{tx("Naam van de website")}<input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} maxLength={100} /></label>
              <label>{tx("Taal van de offerte")}<select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })}>{[["nl", "Nederlands"], ["en", "English"], ["de", "Deutsch"], ["fr", "Français"], ["es", "Español"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            </div>
            {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
            <div><button type="submit" className="btn primary" disabled={busy}>{busy ? tx("Bezig…") : tx("Offerte mailen")}</button></div>
            {ask && <VerifyEmail email={form.email} method={conf.verify_method} onVerified={verified} onClose={() => setAsk(false)} />}
            <small className="muted">{tx("Alle prijzen zijn exclusief btw en inclusief domeinnaam. Hoe langer je afsluit, hoe lager de prijs.")}</small>
          </form>
        </>
      )}
    </div>
  );
}

// Four looks: 1 the whole form on the page · 2 two columns · 3 a button that opens the form in a window · 4 a banner that opens the form in a window.
export default function PriceCalculator({ layout = "1" }) {
  const [open, setOpen] = useState(false);
  if (layout === "2") return <div className="pc-two"><Calc /></div>;
  if (layout === "3" || layout === "4") {
    return (
      <>
        {layout === "3" ? (
          <button type="button" className="btn primary pc-open" onClick={() => setOpen(true)}>🧮 {tx("Bereken je prijs")}</button>
        ) : (
          <div className="pc-banner">
            <div><strong>{tx("Wat kost jouw website?")}</strong><small>{tx("Kies wat je nodig hebt en zie direct de prijs per maand, kwartaal en jaar.")}</small></div>
            <button type="button" className="btn" onClick={() => setOpen(true)}>🧮 {tx("Bereken je prijs")}</button>
          </div>
        )}
        {open && (
          <div className="overlay" onClick={() => setOpen(false)}>
            <div className="card modal pc-window" role="dialog" aria-label={tx("Bereken je prijs")} onClick={(e) => e.stopPropagation()}>
              <div className="row between"><h2 style={{ margin: 0 }}>{tx("Bereken je prijs")}</h2><button type="button" className="btn sm" onClick={() => setOpen(false)}>{tx("Sluiten")}</button></div>
              <Calc />
            </div>
          </div>
        )}
      </>
    );
  }
  return <Calc />;
}

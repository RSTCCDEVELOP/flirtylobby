// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { api, errorText } from "../lib/api";
import { resetIntegrationsCache } from "../lib/integrations";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { IconLock, IconRefresh } from "./Icons";
import Loading from "./Loading";
import CodeInput from "./CodeInput";

const STATE = { ok: ["Actueel", "ok"], update: ["Verandert", "warn"], missing: ["Nieuw", "warn"], local: ["Alleen hier", ""] };

// API keys -> Updaten (superadmin only): look at the API links of the easy2edit server, see which ones changed (keys are never shown) and bring them up to date.
// The keys travel encrypted from the server and are opened here.
export default function ApiLinksUpdate({ onChanged }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [gate, setGate] = useState(null);   // {methods} while a code by e-mail or SMS is asked first
  const [method, setMethod] = useState("email");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(null);
  const [mEmail, setMEmail] = useState("");  // the account on easy2edit.com (the master)
  const [mPass, setMPass] = useState("");
  const [mChallenge, setMChallenge] = useState(null);
  const [pw, setPw] = useState("");  // the password of the installation file (never kept)
  if (!user?.is_staff) return null;
  const check = async () => {
    setBusy(true); setMsg(null);
    try { setD(pw ? await api("/admin/integrations/links/", { method: "POST", body: { check: true, password: pw } }) : await api("/admin/integrations/links/")); setGate(null); }
    catch (e) { if (e?.data?.gate) { setGate({ methods: e.data.methods }); setMethod(e.data.methods?.email ? "email" : "sms"); setD(null); } else setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const start = () => { setOpen(true); setD(null); check(); };
  const update = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await api("/admin/integrations/links/", { method: "POST", body: { password: pw } });
      setD(r); resetIntegrationsCache(); onChanged?.();
      const n = (r.results || []).filter((x) => x.ok).length;
      setMsg({ ok: true, text: n ? tx("{0} koppelingen bijgewerkt.", String(n)) : tx("Alles is al actueel.") });
    } catch (e) { if (e?.data?.gate) { setGate({ methods: e.data.methods }); setD(null); } else setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const seal = async () => {
    setBusy(true); setMsg(null);
    try { const r = await api("/admin/integrations/links/", { method: "POST", body: { seal: true, password: pw } }); setMsg({ ok: true, text: `${tx("Installatiebestand gemaakt")}: ${r.sealed.join(", ")}. ${tx("Zet het bestand mee met je push (apps/integrations/default_links.enc).")}` }); } catch (e) { if (e?.data?.gate) { setGate({ methods: e.data.methods }); setD(null); } else setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const sendCode = async () => {
    setBusy(true); setMsg(null);
    try { const r = await api("/admin/integrations/links/", { method: "POST", body: { gate: "send", method } }); setSent(r); if (r.dev_code) setCode(r.dev_code); } catch (e) { if (e?.data?.gate) { setGate({ methods: e.data.methods }); setD(null); } else setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const masterLogin = async () => {
    setBusy(true); setMsg(null);
    try { setMChallenge(await api("/admin/integrations/links/", { method: "POST", body: { gate: "master_login", email: mEmail, password: mPass } })); setMPass(""); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const verifyCode = async (c = code) => {
    setBusy(true); setMsg(null);
    try { await api("/admin/integrations/links/", { method: "POST", body: method === "master" ? { gate: "master_verify", challenge: mChallenge?.challenge, code: c } : { gate: "verify", code: c } }); setGate(null); setSent(null); setMChallenge(null); setCode(""); await check(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); setCode(""); }
    setBusy(false);
  };
  const todo = (d?.links || []).filter((x) => x.state === "update" || x.state === "missing").length;
  return (
    <>
      <button type="button" className="btn" onClick={start} title={tx("De API-koppelingen controleren en bijwerken via de easy2edit-server")}><IconRefresh width={15} height={15} /> {tx("Updaten")}</button>
      {open && (
        <div className="overlay" onClick={() => !busy && setOpen(false)}>
          <div className="card modal" role="dialog" aria-label={tx("API-koppelingen bijwerken")} style={{ width: "min(720px, 96vw)", display: "grid", gap: ".9rem", maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>{tx("API-koppelingen bijwerken")}</h2>
              <button type="button" className="btn sm" onClick={() => !busy && setOpen(false)} aria-label={tx("Sluiten")}>×</button>
            </div>
            <p className="muted" style={{ margin: 0 }}>{tx("De koppelingen die de easy2edit-server voor elke website meegeeft (superadmin+). Hier zie je welke zijn veranderd op de server. Sleutels en instellingen worden versleuteld overgenomen; ze worden hier nooit getoond.")}</p>
            {gate && (
              <div className="eco-panel" style={{ gap: ".7rem" }}>
                <strong>{tx("Eerst bevestigen dat jij het bent")}</strong>
                <small className="muted">{tx("Voordat je de sleutels bij de easy2edit-server controleert of bijwerkt, sturen we een code naar jou als superadmin: per e-mail of per SMS.")}</small>
                <div className="row" style={{ gap: ".5rem", flexWrap: "wrap" }}>
                  <button type="button" className={`btn sm${method === "email" ? " primary" : ""}`} disabled={!gate.methods?.email || busy} onClick={() => setMethod("email")}>{tx("E-mail")}{gate.methods?.email_hint ? ` · ${gate.methods.email_hint}` : ""}</button>
                  <button type="button" className={`btn sm${method === "sms" ? " primary" : ""}`} disabled={!gate.methods?.sms || busy} onClick={() => setMethod("sms")} title={gate.methods?.sms ? "" : tx("SMS is niet beschikbaar (geen geteste SMS-koppeling of geen mobiel nummer).")}>{tx("SMS")}{gate.methods?.sms_hint ? ` · ${gate.methods.sms_hint}` : ""}</button>
                  <button type="button" className={`btn sm${method === "master" ? " primary" : ""}`} disabled={busy} onClick={() => setMethod("master")}>{tx("Account op easy2edit.com")}</button>
                  {method !== "master" && <button type="button" className="btn" disabled={busy || (!gate.methods?.email && !gate.methods?.sms)} onClick={sendCode}>{sent ? tx("Code opnieuw versturen") : tx("Code versturen")}</button>}
                </div>
                {method === "master" && (
                  <div style={{ display: "grid", gap: ".5rem", maxWidth: 420 }}>
                    <small className="muted">{tx("Log in met je account op easy2edit.com (de master-server). Daarna krijgt dat account een code om te bevestigen.")}</small>
                    {!mChallenge ? (
                      <>
                        <input type="email" autoComplete="off" value={mEmail} onChange={(e) => setMEmail(e.target.value)} placeholder={tx("E-mailadres van je account")} />
                        <input type="password" autoComplete="off" value={mPass} onChange={(e) => setMPass(e.target.value)} placeholder={tx("Wachtwoord")} />
                        <div><button type="button" className="btn primary" disabled={busy || !mEmail || !mPass} onClick={masterLogin}>{tx("Inloggen en code versturen")}</button></div>
                      </>
                    ) : (
                      <>
                        <small className="muted">{tx("De code is verstuurd naar")} {mChallenge.hint}</small>
                        <CodeInput value={code} onChange={setCode} length={6} autoFocus onComplete={verifyCode} disabled={busy} />
                        <div><button type="button" className="btn primary" disabled={busy || code.length < 6} onClick={() => verifyCode()}>{tx("Bevestigen")}</button></div>
                      </>
                    )}
                  </div>
                )}
                {method !== "master" && sent && <div style={{ display: "grid", gap: ".5rem", justifyItems: "start" }}>
                  <small className="muted">{sent.dev_code ? tx("Testomgeving: de code is hieronder ingevuld.") : tx("De code is verstuurd. Vul hem hieronder in.")}</small>
                  <CodeInput value={code} onChange={setCode} length={6} autoFocus onComplete={verifyCode} disabled={busy} />
                  <button type="button" className="btn primary" disabled={busy || code.length < 6} onClick={() => verifyCode()}>{tx("Bevestigen")}</button>
                </div>}
              </div>
            )}
            <div className="eco-panel" style={{ gap: ".5rem", display: gate ? "none" : undefined }}>
              <strong>{tx("Installatiebestand (versleuteld)")}</strong>
              <small className="muted">{tx("De koppelingen met hun sleutels gaan versleuteld mee met de installatie. Hier maak je dat bestand (op deze installatie) of pak je het uit (op de bestemming). Het wachtwoord wordt nergens bewaard; zet het op de server als EASY2EDIT_LINKS_PASSPHRASE.")}</small>
              <div className="row" style={{ gap: ".5rem", flexWrap: "wrap", alignItems: "center" }}>
                <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={tx("Wachtwoord van het bestand (minstens 12 tekens)")} style={{ flex: "1 1 260px" }} />
                <button type="button" className="btn" disabled={busy || pw.length < 12} onClick={seal}>{tx("Installatiebestand maken")}</button>
              </div>
            </div>
            {msg && <div className={msg.ok ? "alert ok" : "alert"} role="status">{msg.text}</div>}
            {busy && !d ? <Loading compact /> : d && !d.ok ? <div className="alert" role="alert">{d.error}</div> : d && (
              <div className="table-wrap" style={{ border: 0 }}>
                <table>
                  <thead><tr><th>{tx("Koppeling")}</th><th>{tx("Status")}</th><th>{tx("Wat verandert")}</th></tr></thead>
                  <tbody>
                    {d.links.map((x) => {
                      const diff = x.fields.filter((f) => f.differs);
                      return (
                        <tr key={x.slug}>
                          <td><strong>{x.name}</strong><br /><small className="muted">{x.provider}</small></td>
                          <td><span className={`badge ${STATE[x.state]?.[1] || ""}`}>{tx(STATE[x.state]?.[0] || x.state)}</span></td>
                          <td>{diff.length ? diff.map((f) => <span key={f.field} className="badge" style={{ marginRight: ".3rem" }}>{f.field}{f.secret ? <> <IconLock width={11} height={11} /></> : null}</span>) : <span className="muted">–</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="row" style={{ justifyContent: "flex-end", gap: ".6rem" }}>
              <button type="button" className="btn" disabled={busy} onClick={check}>{tx("Opnieuw controleren")}</button>
              <button type="button" className="btn primary" disabled={busy || !d?.ok || !todo} onClick={update}>{busy ? tx("Bezig…") : todo ? `${tx("Bijwerken")} (${todo})` : tx("Alles is actueel")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

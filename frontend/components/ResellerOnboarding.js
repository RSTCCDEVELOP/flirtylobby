// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api, errorText, setToken } from "../lib/api";
import { homeAfterLogin } from "../lib/levelHome";
import { tx } from "../lib/t";
import CodeInput from "./CodeInput";

// An installation that is still empty (no users at all): a button starts the onboarding as a reseller of easy2edit. The master site (easy2edit) looks up the reseller by e-mail address
// and sends a code; with the right code the person becomes the first superuser of this installation and the onboarding goes on (installation, design ...).
// The first time the screen is opened the question "Do the onboarding for this installation?" is asked.
export default function ResellerOnboarding() {
  const router = useRouter();
  const [empty, setEmpty] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("ask");   // ask | email | code
  const [email, setEmail] = useState("");
  const [ch, setCh] = useState(null);        // {challenge, hint}
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    api("/system/first-run/").then((d) => {
      setEmpty(!!d.empty);
      let seen = false; try { seen = sessionStorage.getItem("resellerOnboardingAsked") === "1"; } catch {}
      if (d.empty && !seen) { setStep("ask"); setOpen(true); try { sessionStorage.setItem("resellerOnboardingAsked", "1"); } catch {} }
    }).catch(() => {});
  }, []);
  if (!empty) return null;
  const send = async (e) => {
    e?.preventDefault();
    setBusy(true); setErr("");
    try { setCh(await api("/system/first-run/send/", { method: "POST", body: { email } })); setCode(""); setStep("code"); }
    catch (x) { setErr(errorText(x)); }
    setBusy(false);
  };
  const verify = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await api("/system/first-run/verify/", { method: "POST", body: { challenge: ch.challenge, code } });
      setToken(r.token);
      router.push(await homeAfterLogin());
    } catch (x) { setErr(errorText(x)); setBusy(false); }
  };
  const close = () => { if (!busy) setOpen(false); };
  return (<>
    <div className="rob-box">
      <strong>{tx("Deze installatie is nog niet ingericht")}</strong>
      <p className="muted" style={{ margin: 0 }}>{tx("Meld je aan als reseller van easy2edit om te beginnen met de onboarding.")}</p>
      <button type="button" className="btn primary" onClick={() => { setStep("email"); setErr(""); setOpen(true); }}>{tx("Onboarding als reseller")}</button>
    </div>
    {open && createPortal(
      <div className="overlay" onClick={close}>
        <div className="card modal form" role="dialog" aria-label={tx("Onboarding als reseller")} style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
          <h2 style={{ marginTop: 0 }}>{tx("Reseller onboarding")}</h2>
          {step === "ask" && (<>
            <p style={{ marginTop: 0 }}>{tx("Deze installatie is nog leeg. Wil je de onboarding doen voor deze installatie? Je meldt je aan als reseller van easy2edit, daarna richt je de installatie in.")}</p>
            <div className="row"><button type="button" className="btn" onClick={close}>{tx("Nu niet")}</button><button type="button" className="btn primary" onClick={() => setStep("email")}>{tx("Ja, onboarding doen")}</button></div>
          </>)}
          {step === "email" && (
            <form className="form" onSubmit={send}>
              <p className="muted" style={{ marginTop: 0 }}>{tx("Vul het e-mailadres in waarmee je bij easy2edit als reseller bekend bent. Je krijgt een code om je te verifiëren.")}</p>
              <label>{tx("E-mailadres")}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="email" /></label>
              {err && <div className="alert">{err}</div>}
              <div className="row"><button type="button" className="btn" onClick={close}>{tx("Annuleren")}</button><button className="btn primary" disabled={busy || !email.trim()}>{busy ? tx("Bezig…") : tx("Code sturen")}</button></div>
            </form>
          )}
          {step === "code" && (
            <form className="form" onSubmit={verify}>
              <p className="muted" style={{ marginTop: 0 }}>{tx("Er is een code gestuurd naar")} <strong>{ch?.hint}</strong>.</p>
              <div className="code-field"><span>{tx("Code")}</span><CodeInput value={code} onChange={setCode} autoFocus invalid={!!err} kind="owner" onResend={() => send()} /></div>
              <p className="muted" style={{ margin: 0 }}>{tx("Na de code log je in met het wachtwoord van je reseller-login bij easy2edit. Heb je daar nog geen login, dan maakt easy2edit er een en mailt het wachtwoord naar je. Verandert je wachtwoord daar, dan verandert het hier mee.")}</p>
              {err && <div className="alert">{err}</div>}
              <div className="row"><button type="button" className="btn" onClick={() => { setStep("email"); setErr(""); }}>{tx("Terug")}</button><button className="btn primary" disabled={busy || code.length < 6}>{busy ? tx("Bezig…") : tx("Aanmelden en beginnen")}</button></div>
            </form>
          )}
        </div>
      </div>, document.body)}
  </>);
}

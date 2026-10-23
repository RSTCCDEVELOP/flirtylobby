// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import CodeImage from "./CodeImage";

// Super admin → Prijzen → Sales: try one method of confirmation (a mail with a code, a mail with a link, or the code on the screen) before visitors use it.
export default function SalesTest({ method, email: start = "", onClose }) {
  const [email, setEmail] = useState(start);
  const [step, setStep] = useState("ask"); // ask · code · link · done
  const [data, setData] = useState(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);
  const NAME = { code: tx("Code per e-mail"), screen: tx("Code op het scherm"), link: tx("Link in de e-mail") };
  useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); return () => { document.removeEventListener("keydown", k); clearInterval(timer.current); }; }, [onClose]);

  const begin = async (e) => {
    e?.preventDefault(); setBusy(true); setMsg(null);
    try {
      const r = await api("/system/sales/test/", { method: "POST", body: { method, email } });
      setData(r); setTyped("");
      if (r.method === "link") {
        setStep("link");
        clearInterval(timer.current);
        timer.current = setInterval(async () => { try { const s = await api("/sales/calculator/verify/status/", { method: "POST", body: { nonce: r.nonce, email } }); if (s.token) { clearInterval(timer.current); setStep("done"); setMsg({ ok: true, text: tx("De link is geopend: de bevestiging werkt.") }); } } catch {} }, 3000);
      } else setStep("code");
    } catch (er) { setMsg({ ok: false, text: errorText(er) }); }
    setBusy(false);
  };
  const check = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const r = await api("/system/sales/test/check/", { method: "POST", body: { email, challenge: data.challenge, code: typed } });
      if (r.ok) { setStep("done"); setMsg({ ok: true, text: tx("De code klopt: de bevestiging werkt.") }); } else setMsg({ ok: false, text: r.detail || tx("Deze code klopt niet.") });
    } catch (er) { setMsg({ ok: false, text: errorText(er) }); }
    setBusy(false);
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal verify-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0 }}>{tx("Test")}: {NAME[method]}</h2>
        {step === "ask" && (
          <form className="stack" style={{ gap: ".8rem" }} onSubmit={begin}>
            <p className="muted" style={{ margin: 0 }}>{method === "screen" ? tx("Je ziet een code in een plaatje en typt die over, zoals een bezoeker dat doet.") : method === "link" ? tx("Er gaat een e-mail met een link naar dit adres. Open de link; hier zie je dan dat het werkt.") : tx("Er gaat een e-mail met een code naar dit adres. Typ de code hier over.")}</p>
            <label>{tx("E-mailadres voor de test")}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
            {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
            <div className="row"><button type="button" className="btn" onClick={onClose}>{tx("Sluiten")}</button><button type="submit" className="btn primary" disabled={busy || !email.includes("@")}>{busy ? tx("Bezig…") : method === "screen" ? tx("Code tonen") : tx("Test versturen")}</button></div>
          </form>
        )}
        {step === "code" && (
          <form className="stack" style={{ gap: ".8rem" }} onSubmit={check}>
            {method === "screen" ? <CodeImage code={data.code} label={tx("Beveiligingscode")} /> : <p className="muted" style={{ margin: 0 }}>{tx("De test-e-mail is verstuurd naar {0}.", data.sent_to)}</p>}
            <label>{tx("Typ de code")}<input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} maxLength={12} autoFocus autoComplete="off" style={{ textTransform: "uppercase", letterSpacing: ".2em", fontWeight: 700 }} /></label>
            {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
            <div className="row"><button type="button" className="btn" onClick={begin}>{tx("Nieuwe code")}</button><button type="submit" className="btn primary" disabled={busy || typed.length < 4}>{tx("Controleren")}</button></div>
          </form>
        )}
        {step === "link" && (
          <div className="stack" style={{ gap: ".8rem" }}>
            <p className="muted" style={{ margin: 0 }}>{tx("De test-e-mail is verstuurd naar {0}. Open de link; deze pagina gaat daarna vanzelf verder.", data.sent_to)}</p>
            <div className="verify-wait" aria-hidden="true"><span /><span /><span /></div>
            <div className="row"><button type="button" className="btn" onClick={onClose}>{tx("Sluiten")}</button></div>
          </div>
        )}
        {step === "done" && (
          <div className="stack" style={{ gap: ".8rem" }}>
            <div className="alert ok">{msg?.text}</div>
            <div className="row"><button type="button" className="btn primary" onClick={onClose}>{tx("Sluiten")}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

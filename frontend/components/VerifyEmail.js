"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { IconX } from "./Icons";
import CodeImage from "./CodeImage";

const LEN = 6;

// Pop-up that confirms an e-mail address: first the address, then the code of 6 letters and digits that was mailed. onVerified(token, email) when it is right.
export default function VerifyEmail({ email: start = "", method = "code", onVerified, onClose }) {
  const [step, setStep] = useState("ask");
  const [email, setEmail] = useState(start);
  const [challenge, setChallenge] = useState("");
  const [nonce, setNonce] = useState("");
  const [shown, setShown] = useState(""); // the code to read from the picture (method "screen")
  const [chars, setChars] = useState(Array(LEN).fill(""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(0); // seconds before a new code can be asked
  const boxes = useRef([]);
  useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  useEffect(() => { if (wait <= 0) return undefined; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
  useEffect(() => { if (step === "code") boxes.current[0]?.focus(); }, [step]);
  useEffect(() => { if (method === "screen" && start.includes("@")) send(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // the link method: the form waits until the link in the mail was opened
  useEffect(() => {
    if (step !== "link" || !nonce) return undefined;
    let alive = true;
    const t = setInterval(async () => {
      try { const r = await api("/sales/calculator/verify/status/", { method: "POST", body: { nonce, email } }); if (alive && r.token) { alive = false; clearInterval(t); onVerified(r.token, email); } } catch (er) { if (alive) { setErr(errorText(er)); } }
    }, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [step, nonce, email]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (e) => {
    e?.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await api(method === "screen" ? "/sales/calculator/verify/screen/" : "/sales/calculator/verify/", { method: "POST", body: { email } });
      if (r.method === "screen") { setShown(r.code); setChallenge(r.challenge); setChars(Array(LEN).fill("")); setStep("code"); }
      else if (r.method === "link") { setNonce(r.nonce); setStep("link"); } else { setChallenge(r.challenge); setChars(Array(LEN).fill("")); setStep("code"); }
      if (r.method !== "screen") setWait(30);
    } catch (er) { setErr(errorText(er)); }
    setBusy(false);
  };
  const code = chars.join("");
  const check = async (e, value = code) => {
    e?.preventDefault(); if (value.length < LEN) return;
    setBusy(true); setErr("");
    try { const r = await api("/sales/calculator/verify/check/", { method: "POST", body: { email, challenge, code: value } }); onVerified(r.token, email); } catch (er) { setErr(errorText(er)); setChars(Array(LEN).fill("")); boxes.current[0]?.focus(); }
    setBusy(false);
  };
  const put = (i, v) => {
    const clean = v.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!clean) { setChars((c) => c.map((x, j) => (j === i ? "" : x))); return; }
    const next = [...chars];
    clean.slice(0, LEN - i).split("").forEach((ch, k) => { next[i + k] = ch; }); // also a pasted code
    setChars(next);
    const at = Math.min(i + clean.length, LEN - 1);
    boxes.current[at]?.focus();
    if (next.every(Boolean)) check(null, next.join(""));
  };
  const key = (i, e) => { if (e.key === "Backspace" && !chars[i] && i > 0) boxes.current[i - 1]?.focus(); };

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="card modal verify-modal" role="dialog" aria-label={tx("E-mailadres bevestigen")} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn info-x" onClick={onClose} aria-label={tx("Sluiten")}><IconX /></button>
        <div className="verify-ico" aria-hidden="true">✉</div>
        {step === "ask" ? (
          <form className="stack" style={{ gap: ".9rem" }} onSubmit={send}>
            <h2 style={{ margin: 0, textAlign: "center" }}>{tx("Bevestig je e-mailadres")}</h2>
            <p className="muted" style={{ margin: 0, textAlign: "center" }}>{method === "link" ? tx("We sturen een link naar je e-mailadres. Open die link om je adres te bevestigen; daarna gaat de offerte op weg.") : tx("We sturen een code van 6 letters en cijfers naar je e-mailadres. Daarna gaat de offerte op weg.")}</p>
            <label>{tx("E-mailadres")}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@bedrijf.nl" autoFocus required autoComplete="email" /></label>
            {err && <div className="alert">{err}</div>}
            <button type="submit" className="btn primary" disabled={busy || !email.includes("@")}>{busy ? tx("Bezig…") : method === "link" ? tx("Link sturen") : tx("Code sturen")}</button>
          </form>
        ) : step === "link" ? (
          <div className="stack" style={{ gap: ".9rem" }}>
            <h2 style={{ margin: 0, textAlign: "center" }}>{tx("Controleer je e-mail")}</h2>
            <p className="muted" style={{ margin: 0, textAlign: "center" }}>{tx("We hebben een link gestuurd naar {0}. Open die link; dit venster gaat daarna vanzelf verder.", email)}</p>
            <div className="verify-wait" aria-hidden="true"><span /><span /><span /></div>
            {err && <div className="alert">{err}</div>}
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button type="button" className="link-btn" onClick={() => { setStep("ask"); setErr(""); }}>{tx("Ander e-mailadres")}</button>
              <button type="button" className="link-btn" disabled={busy || wait > 0} onClick={send}>{wait > 0 ? tx("Nieuwe link over {0} s", wait) : tx("Nieuwe link sturen")}</button>
            </div>
          </div>
        ) : (
          <form className="stack" style={{ gap: ".9rem" }} onSubmit={check}>
            <h2 style={{ margin: 0, textAlign: "center" }}>{tx("Typ de code")}</h2>
            {method === "screen" ? (
              <>
                <p className="muted" style={{ margin: 0, textAlign: "center" }}>{tx("Typ de code uit het plaatje over met je toetsenbord. Het zijn hoofdletters en cijfers.")}</p>
                <CodeImage code={shown} label={tx("Beveiligingscode")} />
              </>
            ) : <p className="muted" style={{ margin: 0, textAlign: "center" }}>{tx("De code is gemaild naar {0}. Hij is 10 minuten geldig.", email)}</p>}
            <div className="verify-code" onPaste={(e) => { e.preventDefault(); put(0, e.clipboardData.getData("text")); }}>
              {chars.map((c, i) => (
                <input key={i} ref={(el) => { boxes.current[i] = el; }} value={c} inputMode="text" autoCapitalize="characters" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={LEN} aria-label={`${tx("Teken")} ${i + 1}`}
                  onChange={(e) => put(i, e.target.value)} onKeyDown={(e) => key(i, e)} onFocus={(e) => e.target.select()} />
              ))}
            </div>
            {err && <div className="alert">{err}</div>}
            <button type="submit" className="btn primary" disabled={busy || code.length < LEN}>{busy ? tx("Bezig…") : tx("Bevestigen")}</button>
            <div className="row" style={{ justifyContent: "space-between" }}>
              {method === "screen" ? <span /> : <button type="button" className="link-btn" onClick={() => { setStep("ask"); setErr(""); }}>{tx("Ander e-mailadres")}</button>}
              <button type="button" className="link-btn" disabled={busy || wait > 0} onClick={send}>{method === "screen" ? tx("Nieuwe code") : wait > 0 ? tx("Nieuwe code over {0} s", wait) : tx("Nieuwe code sturen")}</button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

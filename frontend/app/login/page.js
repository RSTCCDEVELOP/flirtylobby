// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../../lib/t";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "../../components/BrandingContext";
import ThemeToggle from "../../components/ThemeToggle";
import { useEffect } from "react";
import { api, setToken, errorText, ApiError } from "../../lib/api";
import { EditableText } from "../../components/EditMode";
import CodeInput from "../../components/CodeInput";
import SsoButtons from "../../components/SsoButtons";


export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // only on your own computer (localhost): "@" in the e-mail field fills in the login of DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD (backend/.env); the backend gives it only to localhost in DEBUG
  const devFill = async (value) => {
    if (value !== "@" || typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return;
    try {
      const d = await api("/auth/dev-login/");
      if (d?.configured) { setEmail(d.email); setPassword(d.password); setError(""); }
      else setError(tx("Zet DEV_LOGIN_EMAIL en DEV_LOGIN_PASSWORD in backend/.env om met @ in te vullen."));
    } catch {}
  };
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [canRegister, setCanRegister] = useState(false);
  const [hydrated, setHydrated] = useState(false); // before the page is alive a submit would reload it (the person then has to log in again)
  useEffect(() => setHydrated(true), []);
  const [challenge, setChallenge] = useState(null); // {challenge, method, destination} after the password step
  const [code, setCode] = useState("");
  const [info, setInfo] = useState("");
  const [failed, setFailed] = useState(false); // the e-mail address / password were not accepted: offer to reset the password
  const [reset, setReset] = useState(null); // null | {step: "ask"} | {step: "code", sandbox_code}
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  useEffect(() => { api("/auth/register/config/").then((c) => setCanRegister(!!c.enabled)).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      // read what is really in the fields: a password manager or autofill (iPhone, Safari) fills them without telling the page, and the state is still empty (then the first try failed and the second worked)
      const f = new FormData(e.currentTarget);
      const r = await api("/auth/login/", { method: "POST", body: { email: String(f.get("email") || email).trim(), password: String(f.get("password") || password) } });
      if (r.twofa_required) { setChallenge(r); setBusy(false); return; }
      setToken(r.token);
      router.push("/dashboard");
    } catch (err) {
      setError(errorText(err));
      setFailed(err instanceof ApiError && err.status === 400);
      setBusy(false);
    }
  }

  // forgot the password: 1. a code goes to the e-mail address, 2. the code with a new password: the new password is active at once
  async function askCode(e) {
    e?.preventDefault();
    setBusy(true); setError(""); setInfo("");
    try {
      const r = await api("/auth/password-reset/request/", { method: "POST", body: { email: email.trim(), lang: (typeof document !== "undefined" && document.documentElement.lang) || "nl" } });
      setReset({ step: "code", sandbox_code: r.sandbox_code });
      setInfo(r.detail || "");
      setCode(""); setNewPw(""); setNewPw2("");
    } catch (err) { setError(errorText(err)); }
    setBusy(false);
  }
  async function saveNewPassword(e) {
    e.preventDefault();
    if (newPw !== newPw2) return setError(tx("De twee wachtwoorden zijn niet gelijk."));
    setBusy(true); setError(""); setInfo("");
    try {
      await api("/auth/password-reset/confirm/", { method: "POST", body: { email: email.trim(), code, password: newPw } });
      setReset(null); setFailed(false); setPassword(""); setCode(""); setNewPw(""); setNewPw2("");
      setInfo(tx("Je nieuwe wachtwoord is actief. Log nu in."));
    } catch (err) { setError(errorText(err)); }
    setBusy(false);
  }

  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { token } = await api("/auth/login/verify/", { method: "POST", body: { challenge: challenge.challenge, code } });
      setToken(token);
      router.push("/dashboard");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  async function resend() {
    setError(""); setInfo("");
    try { const r = await api("/auth/login/resend/", { method: "POST", body: { challenge: challenge.challenge } }); if (r.sandbox_code) setChallenge((x) => ({ ...x, sandbox_code: r.sandbox_code })); setInfo(tx("Nieuwe code verstuurd.")); }
    catch (err) { setError(errorText(err)); }
  }

  if (reset) {
    return (
      <main className="login-page">
        <div className="login-theme"><ThemeToggle /></div>
        {reset.step === "ask" ? (
          <form className="card login-card" onSubmit={askCode}>
            <Logo />
            <h1>{tx("Wachtwoord resetten")}</h1>
            <p className="muted" style={{ margin: 0 }}>{tx("We sturen een code naar het e-mailadres van je account. Met die code kies je een nieuw wachtwoord.")}</p>
            <label>{tx("E-mailadres")}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="username" autoCapitalize="none" />
            </label>
            {error && <div className="alert">{error}</div>}
            <button className="btn primary" disabled={busy || !email.trim()}>{busy ? tx("Bezig…") : tx("Code sturen")}</button>
            <button type="button" className="muted center" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => { setReset(null); setError(""); setInfo(""); }}>{tx("← Terug")}</button>
          </form>
        ) : (
          <form className="card login-card" onSubmit={saveNewPassword}>
            <Logo />
            <h1>{tx("Nieuw wachtwoord")}</h1>
            {info && <div className="alert ok">{info}</div>}
            <div className="code-field"><span>{tx("Code")}</span><CodeInput value={code} onChange={setCode} autoFocus invalid={!!error} /></div>
            {reset.sandbox_code && <div className="alert ok" style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>{tx("Sandbox: je code is")} <strong style={{ letterSpacing: ".15em" }}>{reset.sandbox_code}</strong><button type="button" className="btn sm" onClick={() => setCode(reset.sandbox_code)}>{tx("Invullen")}</button></div>}
            <label>{tx("Nieuw wachtwoord")}
              <input type={show ? "text" : "password"} value={newPw} onChange={(e) => setNewPw(e.target.value)} required autoComplete="new-password" />
            </label>
            <label>{tx("Herhaal wachtwoord")}
              <input type={show ? "text" : "password"} value={newPw2} onChange={(e) => setNewPw2(e.target.value)} required autoComplete="new-password" />
            </label>
            <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> {tx("Toon wachtwoord")}</label>
            {error && <div className="alert">{error}</div>}
            <button className="btn primary" disabled={busy || code.length < 6 || !newPw || !newPw2}>{busy ? tx("Bezig…") : tx("Wachtwoord opslaan")}</button>
            <button type="button" className="btn" disabled={busy} onClick={askCode}>{tx("Code opnieuw sturen")}</button>
            <button type="button" className="muted center" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => { setReset(null); setError(""); setInfo(""); }}>{tx("← Terug")}</button>
          </form>
        )}
      </main>
    );
  }

  if (challenge) {
    return (
      <main className="login-page">
        <div className="login-theme"><ThemeToggle /></div>
        <form className="card login-card" onSubmit={verify}>
          <Logo />
          <h1>{challenge.email_verify ? tx("E-mailadres bevestigen") : tx("Verificatiecode")}</h1>
          <p className="muted" style={{ margin: 0 }}>{challenge.method === "app" ? tx("Open je authenticator-app en vul de 6-cijferige code in.") : <>{tx("We hebben een code gestuurd naar")} {challenge.destination} ({challenge.method === "sms" ? "sms" : "e-mail"}).</>}</p>
          <div className="code-field"><span>{tx("Code")}</span><CodeInput value={code} onChange={setCode} autoFocus invalid={!!error} /></div>
          {error && <div className="alert">{error}</div>}
          {info && <div className="alert ok">{info}</div>}
          {challenge.sandbox_code && <div className="alert ok" style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>{tx("Sandbox: je code is")} <strong style={{ letterSpacing: ".15em" }}>{challenge.sandbox_code}</strong> <button type="button" className="btn sm" onClick={() => setCode(challenge.sandbox_code)}>{tx("Invullen")}</button></div>}
          <button className="btn primary" disabled={busy || code.length < 6}>{busy ? tx("Bezig…") : tx("Bevestigen")}</button>
          {challenge.method !== "app" && <button type="button" className="btn" onClick={resend}>{tx("Code opnieuw sturen")}</button>}
          <button type="button" className="muted center" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => { setChallenge(null); setCode(""); setError(""); setInfo(""); }}>{tx("← Terug")}</button>
        </form>
      </main>
    );
  }

  return (
    <main className="login-page">
      <div className="login-theme"><ThemeToggle /></div>
      <form className="card login-card" onSubmit={submit}>
        <Logo />
        <EditableText id="login.title" as="h1" fallbacks={{ nl: "Inloggen", en: "Log in", de: "Anmelden", fr: "Connexion", es: "Iniciar sesión", pt: "Entrar", zh: "登录", ar: "تسجيل الدخول" }} fallback="Inloggen" />
        <EditableText id="login.intro" as="p" fallback="" className="muted" />
        <label>{tx("E-mailadres")}
          <input type="email" name="email" value={email} onChange={(e) => { setEmail(e.target.value); devFill(e.target.value); }} onInput={(e) => setEmail(e.target.value)} required autoFocus autoComplete="username" autoCapitalize="none" autoCorrect="off" />
        </label>
        <label>{tx("Wachtwoord")}
          <input type={show ? "text" : "password"} name="password" value={password} onChange={(e) => setPassword(e.target.value)} onInput={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> {tx("Toon wachtwoord")}</label>
        {error && <div className="alert">{error}</div>}
        {info && <div className="alert ok">{info}</div>}
        {failed && email.trim() && <button type="button" className="btn" onClick={() => { setReset({ step: "ask" }); setError(""); setInfo(""); }}>{tx("Wachtwoord resetten")}</button>}
        <button className="btn primary" disabled={busy || !hydrated}>{busy ? tx("Bezig…") : tx("Inloggen")}</button>
        <SsoButtons onLogin={(r) => { setToken(r.token); router.push("/dashboard"); }} onError={setError} />
        {canRegister && <Link href="/registreren" className="center">{tx("Nog geen account? Aanmelden")}</Link>}
        <Link href="/" className="muted center">{tx("← Terug naar website")}</Link>
      </form>
    </main>
  );
}

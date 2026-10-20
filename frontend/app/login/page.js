"use client";

import { tx } from "../../lib/t";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "../../components/BrandingContext";
import ThemeToggle from "../../components/ThemeToggle";
import { useEffect } from "react";
import { api, setToken, errorText } from "../../lib/api";
import { EditableText } from "../../components/EditMode";
import CodeInput from "../../components/CodeInput";


export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [canRegister, setCanRegister] = useState(false);
  const [hydrated, setHydrated] = useState(false); // before the page is alive a submit would reload it (the person then has to log in again)
  useEffect(() => setHydrated(true), []);
  const [challenge, setChallenge] = useState(null); // {challenge, method, destination} after the password step
  const [code, setCode] = useState("");
  const [info, setInfo] = useState("");
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
      setBusy(false);
    }
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
          <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} onInput={(e) => setEmail(e.target.value)} required autoFocus autoComplete="username" autoCapitalize="none" autoCorrect="off" />
        </label>
        <label>{tx("Wachtwoord")}
          <input type={show ? "text" : "password"} name="password" value={password} onChange={(e) => setPassword(e.target.value)} onInput={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> {tx("Toon wachtwoord")}</label>
        {error && <div className="alert">{error}</div>}
        <button className="btn primary" disabled={busy || !hydrated}>{busy ? tx("Bezig…") : tx("Inloggen")}</button>
        {canRegister && <Link href="/registreren" className="center">{tx("Nog geen account? Aanmelden")}</Link>}
        <Link href="/" className="muted center">{tx("← Terug naar website")}</Link>
      </form>
    </main>
  );
}

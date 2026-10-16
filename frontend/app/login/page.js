"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "../../components/BrandingContext";
import ThemeToggle from "../../components/ThemeToggle";
import { useEffect } from "react";
import { api, setToken, errorText } from "../../lib/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [canRegister, setCanRegister] = useState(false);
  const [challenge, setChallenge] = useState(null); // {challenge, method, destination} after the password step
  const [code, setCode] = useState("");
  const [info, setInfo] = useState("");
  useEffect(() => { api("/auth/register/config/").then((c) => setCanRegister(!!c.enabled)).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/auth/login/", { method: "POST", body: { email, password } });
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
    try { await api("/auth/login/resend/", { method: "POST", body: { challenge: challenge.challenge } }); setInfo("Nieuwe code verstuurd."); }
    catch (err) { setError(errorText(err)); }
  }

  if (challenge) {
    return (
      <main className="login-page">
        <div className="login-theme"><ThemeToggle /></div>
        <form className="card login-card" onSubmit={verify}>
          <Logo />
          <h1>Verificatiecode</h1>
          <p className="muted" style={{ margin: 0 }}>We hebben een code gestuurd naar {challenge.destination} ({challenge.method === "sms" ? "sms" : "e-mail"}).</p>
          <label>Code
            <input value={code} onChange={(e) => setCode(e.target.value)} required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={8} />
          </label>
          {error && <div className="alert">{error}</div>}
          {info && <div className="alert ok">{info}</div>}
          <button className="btn primary" disabled={busy}>{busy ? "Bezig…" : "Bevestigen"}</button>
          <button type="button" className="btn" onClick={resend}>Code opnieuw sturen</button>
          <button type="button" className="muted center" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => { setChallenge(null); setCode(""); setError(""); setInfo(""); }}>← Terug</button>
        </form>
      </main>
    );
  }

  return (
    <main className="login-page">
      <div className="login-theme"><ThemeToggle /></div>
      <form className="card login-card" onSubmit={submit}>
        <Logo />
        <h1>Inloggen</h1>
        <label>E-mailadres
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="username" />
        </label>
        <label>Wachtwoord
          <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Toon wachtwoord</label>
        {error && <div className="alert">{error}</div>}
        <button className="btn primary" disabled={busy}>{busy ? "Bezig…" : "Inloggen"}</button>
        {canRegister && <Link href="/registreren" className="center">Nog geen account? Aanmelden</Link>}
        <Link href="/" className="muted center">← Terug naar website</Link>
      </form>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "../../components/BrandingContext";
import ThemeToggle from "../../components/ThemeToggle";
import { api, setToken, errorText } from "../../lib/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { token } = await api("/auth/login/", { method: "POST", body: { email, password } });
      setToken(token);
      router.push("/dashboard");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
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
        <Link href="/" className="muted center">← Terug naar website</Link>
      </form>
    </main>
  );
}

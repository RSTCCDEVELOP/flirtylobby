"use client";

import { tx } from "../../../lib/t";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "../../../components/BrandingContext";
import DirectConnection from "../../../components/DirectConnection";
import ThemeToggle from "../../../components/ThemeToggle";
import { api, errorText } from "../../../lib/api";

// Page behind an invitation link / QR code: no account needed.
export default function DirectGuest() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [secret, setSecret] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(`direct:${token}`)); } catch {}
    const q = saved?.key ? `?key=${encodeURIComponent(saved.key)}` : "";
    api(`/direct/${token}/${q}`).then((d) => { setInfo(d); if (saved?.key && d.role === "guest") setSecret(saved.key); if (d.role === "owner") setError(tx("Dit is je eigen uitnodiging. Open hem op een ander apparaat of stuur de link door.")); })
      .catch((e) => setError(errorText(e)));
  }, [token]);

  async function join(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await api(`/direct/${token}/join/`, { method: "POST", body: { name } });
      try { sessionStorage.setItem(`direct:${token}`, JSON.stringify({ key: r.key })); } catch {}
      setSecret(r.key);
    } catch (err) { setError(errorText(err)); setBusy(false); }
  }

  return (
    <main className="login-page" style={{ alignItems: "flex-start", paddingTop: "2rem" }}>
      <div className="login-theme"><ThemeToggle /></div>
      <div className="card login-card" style={{ maxWidth: 640, width: "100%" }}>
        <Logo />
        <h1>{tx("Directe verbinding")}</h1>
        {!info && !error && <p className="muted">{tx("Laden…")}</p>}
        {error && <div className="alert">{error}</div>}
        {error && !secret && <Link href="/direct" className="btn primary">{tx("Verbind opnieuw")}</Link>}
        {info && !info.role && !info.taken && !error && !secret && (
          <form className="form" onSubmit={join}>
            <p><strong>{info.owner_name}</strong> {tx("nodigt je uit voor een rechtstreekse verbinding: chat, foto's en video.")}</p>
            <label>{tx("Jouw naam")}<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoFocus /></label>
            <button className="btn primary" disabled={busy}>{busy ? tx("Bezig…") : tx("Verbinden")}</button>
          </form>
        )}
        {info?.taken && !secret && <div className="alert">{tx("Er is al iemand verbonden met deze uitnodiging.")}</div>}
        {secret && info && <DirectConnection token={token} role="guest" secret={secret} info={info} onClosed={(why) => { setSecret(null); try { sessionStorage.removeItem(`direct:${token}`); } catch {} setError(why === "left" ? tx("Je hebt de verbinding verbroken.") : tx("De verbinding is verbroken of de uitnodiging is gesloten.")); }} />}
        {!secret && <Link href="/direct" className="muted center">{tx("Heb je een code? Verbind zonder link")}</Link>}
        <Link href="/" className="muted center">{tx("← Naar de website")}</Link>
      </div>
    </main>
  );
}

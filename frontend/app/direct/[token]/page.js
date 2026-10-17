"use client";

import { tx } from "../../../lib/t";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Logo } from "../../../components/BrandingContext";
import DirectDataForm from "../../../components/DirectDataForm";
import DirectConnection from "../../../components/DirectConnection";
import { IconHome } from "../../../components/Icons";
import LanguageSwitcher from "../../../components/LanguageSwitcher";
import ThemeToggle from "../../../components/ThemeToggle";
import { api, errorText } from "../../../lib/api";

// Page behind an invitation link / QR code: no account needed.
// Shown when the invitation is already taken: the visitor can pass the site on to somebody else (WhatsApp, share sheet or copy the link)
// the QR code of this invitation, in the place of the logo
function TakenQr() {
  const [qr, setQr] = useState("");
  useEffect(() => { QRCode.toDataURL(window.location.href, { margin: 1, width: 360 }).then(setQr).catch(() => {}); }, []);
  /* eslint-disable-next-line @next/next/no-img-element */
  return qr ? <img src={qr} alt={tx("QR-code van de uitnodiging")} style={{ width: 180, height: 180, background: "#fff", padding: 8, borderRadius: 12, alignSelf: "center" }} /> : null;
}

function InviteSomeone({ code }) {

  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.origin : "";
  const nice = code ? `${code.slice(0, 3)} ${code.slice(3)}` : "";
  const text = code ? `${tx("Kom ook kijken:")} ${url}/direct — ${tx("Code")}: ${nice}` : `${tx("Kom ook kijken:")} ${url}`;
  const [codeCopied, setCodeCopied] = useState(false);
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); }
    catch { const t = document.createElement("textarea"); t.value = code; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch {} t.remove(); }
    setCodeCopied(true); setTimeout(() => setCodeCopied(false), 1500);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); }
    catch { const t = document.createElement("textarea"); t.value = url; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch {} t.remove(); }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="card" style={{ display: "grid", gap: ".6rem", textAlign: "center" }}>
      <strong>{tx("Iemand anders uitnodigen")}</strong>
      <small className="muted">{tx("Stuur de link door naar iemand anders.")}</small>
      {code && <div><small className="muted">{tx("Jouw code")}</small><div className="code-input" style={{ fontSize: "1.5rem" }}>{nice}</div><button type="button" className="btn" onClick={copyCode}>{codeCopied ? tx("Gekopieerd") : tx("Code kopiëren")}</button></div>}
      <a className="btn primary" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">{tx("Sturen via WhatsApp")}</a>
      {typeof navigator !== "undefined" && navigator.share && <button type="button" className="btn" onClick={() => navigator.share({ title: document.title, text, url }).catch(() => {})}>{tx("Delen…")}</button>}
      <button type="button" className="btn" onClick={copy}>{copied ? tx("Gekopieerd") : tx("Link kopiëren")}</button>
    </div>
  );
}

export default function DirectGuest() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [secret, setSecret] = useState(null);
  const [busy, setBusy] = useState(false);
  const [chatting, setChatting] = useState(false); // chat started: the logo and title make room for the chat

  useEffect(() => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(`direct:${token}`)); } catch {}  // kept on this device, so coming back needs no code
    const q = saved?.key ? `?key=${encodeURIComponent(saved.key)}` : "";
    api(`/direct/${token}/${q}`).then((d) => { setInfo(d); if (saved?.key && d.role === "guest") setSecret(saved.key); if (d.role === "owner") setError(tx("Dit is je eigen uitnodiging. Open hem op een ander apparaat of stuur de link door.")); })
      .catch((e) => setError(errorText(e)));
  }, [token]);

  async function join(data) {
    setBusy(true); setError("");
    try {
      const r = await api(`/direct/${token}/join/`, { method: "POST", body: data });
      try { localStorage.setItem(`direct:${token}`, JSON.stringify({ key: r.key })); localStorage.setItem("direct:last", token); } catch {}
      setSecret(r.key);
    } catch (err) { setError(errorText(err)); }
    setBusy(false);
  }

  return (
    <main className="login-page" style={{ alignItems: "center", padding: "2rem 1rem" }}>
      <div className="login-theme"><LanguageSwitcher flags /><Link href="/" className="icon-btn" aria-label={tx("Naar de homepage")} title={tx("Naar de homepage")}><IconHome /></Link><ThemeToggle /></div>
      <div className="card login-card" style={{ maxWidth: 640, width: "100%" }}>
        {!chatting && (info?.taken && !secret ? <TakenQr /> : <Logo className="direct-logo" />)}
        {!chatting && <h1>{tx("Directe verbinding")}</h1>}
        {!info && !error && <p className="muted">{tx("Laden…")}</p>}
        {error && <div className="alert">{error}</div>}
        {error && !secret && <Link href="/direct" className="btn primary">{tx("Verbind opnieuw")}</Link>}
        {info && !info.role && !info.taken && !error && !secret && (
          <DirectDataForm busy={busy} submitLabel={tx("Verbinden")} onSubmit={join}
            intro={<p><strong>{info.owner_name}</strong> {tx("nodigt je uit voor een rechtstreekse verbinding: chat, foto's en video.")}</p>} />
        )}
        {info?.taken && !secret && <><div className="alert">{tx("Er is al iemand verbonden met deze uitnodiging.")}</div><InviteSomeone code={info.code} /></>}
        {secret && info && <DirectConnection token={token} role="guest" secret={secret} info={info} onChat={setChatting} onClosed={(why) => { setSecret(null); try { localStorage.removeItem(`direct:${token}`); localStorage.removeItem("direct:last"); } catch {} setError(why === "left" ? tx("Je hebt de verbinding verbroken.") : tx("De verbinding is verbroken of de uitnodiging is gesloten.")); }} />}
        {!secret && <Link href="/direct" className="muted center">{tx("Heb je een code? Verbind zonder link")}</Link>}
        {!chatting && <Link href="/" className="muted center">{tx("← Naar de website")}</Link>}
      </div>
    </main>
  );
}

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
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "../../components/BrandingContext";
import DirectConnection from "../../components/DirectConnection";
import DirectDataForm from "../../components/DirectDataForm";
import { IconHome } from "../../components/Icons";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import ThemeToggle from "../../components/ThemeToggle";
import { api, errorText } from "../../lib/api";

const KEY = "directchat:own"; // {token, key, code}: this device's own chat, so a reload picks it up again

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); }
  catch { const a = document.createElement("textarea"); a.value = t; a.style.position = "fixed"; a.style.opacity = "0"; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } catch {} a.remove(); }
}

// Start a chat without an account: name and gender, then a code, link and QR code to hand out; the chat itself opens below.
export default function DirectChatStart() {
  const router = useRouter();
  const [step, setStep] = useState("profile"); // profile (name + gender) -> choose (host or connect)
  const [me, setMe] = useState({ name: "", gender: "m", languages: [] }); // from the Gegevens screen
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [own, setOwn] = useState(null); // {token, key, code}
  const [info, setInfo] = useState(null);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState("");
  const [ready, setReady] = useState(false);
  const [chatting, setChatting] = useState(false);

  const link = own && typeof window !== "undefined" ? `${window.location.origin}/direct/${own.token}` : "";
  const nice = own ? `${own.code.slice(0, 3)} ${own.code.slice(3)}` : "";

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved?.token) setOwn(saved);
    } catch {}
    setReady(true);
  }, []);

  const forget = useCallback(() => { try { localStorage.removeItem(KEY); } catch {} setOwn(null); setInfo(null); setChatting(false); }, []);

  useEffect(() => {
    if (!own) return;
    api(`/direct/${own.token}/?key=${encodeURIComponent(own.key)}`).then((d) => (d.role === "owner" ? setInfo(d) : forget())).catch(forget);
  }, [own, forget]);
  useEffect(() => { if (link) QRCode.toDataURL(link, { margin: 1, width: 360 }).then(setQr).catch(() => {}); }, [link]);

  const next = (d) => { setMe(d); setStep("choose"); };
  async function host() {
    setBusy(true); setError("");
    try {
      const r = await api("/direct/anon/", { method: "POST", body: me });
      const o = { token: r.token, key: r.key, code: r.code };
      localStorage.setItem(KEY, JSON.stringify(o));
      setOwn(o);
    } catch (err) { setError(errorText(err)); }
    setBusy(false);
  }
  const copy = async (what, t) => { await copyText(t); setCopied(what); setTimeout(() => setCopied(""), 1500); };
  const text = own ? `${tx("Chat met mij:")} ${link} — ${tx("Code")}: ${nice}` : "";
  const closeRoom = async () => { try { await api(`/direct/${own.token}/owner-leave/`, { method: "POST", body: { key: own.key, act: "close" } }); } catch {} forget(); };

  return (
    <main className="login-page" style={{ alignItems: "center", padding: "2rem 1rem" }}>
      <div className="login-theme"><LanguageSwitcher flags /><Link href="/" className="icon-btn" aria-label={tx("Naar de homepage")} title={tx("Naar de homepage")}><IconHome /></Link><ThemeToggle /></div>
      <div className="card login-card" style={{ maxWidth: 640, width: "100%" }}>
        {!chatting && <Logo className="direct-logo" />}
        {!chatting && <h1>{tx(own || step === "choose" ? "Directe verbinding" : "Chat starten")}</h1>}
        {error && <div className="alert">{error}</div>}

        {ready && !own && step === "profile" && (
          <DirectDataForm intro={<p className="muted" style={{ margin: 0 }}>{tx("Vul je gegevens in. Daarna kies je of je zelf iemand uitnodigt of verbindt met een ander.")}</p>} submitLabel={tx("Verder")} onSubmit={next} />
        )}

        {ready && !own && step === "choose" && (
          <div className="form">
            <p className="muted" style={{ margin: 0 }}>{tx("Hoi {0}, wat wil je doen?", me.name)}</p>
            <button type="button" className="btn primary" disabled={busy} onClick={host}>{busy ? tx("Bezig…") : tx("Iemand uitnodigen (ik ben de host)")}</button>
            <small className="muted" style={{ marginTop: "-.4rem" }}>{tx("Je krijgt een code, link en QR-code om te delen.")}</small>
            <button type="button" className="btn" disabled={busy} onClick={() => router.push("/direct")}>{tx("Verbinden met een ander (code of link)")}</button>
            <small className="muted" style={{ marginTop: "-.4rem" }}>{tx("Je vult de code in of scant de QR-code die je hebt gekregen.")}</small>
            <button type="button" className="btn" onClick={() => setStep("profile")}>{tx("← Gegevens wijzigen")}</button>
          </div>
        )}

        {own && info && (
          <>
            {!chatting && (
              <div className="card" style={{ display: "grid", gap: ".6rem", textAlign: "center" }}>
                {qr && /* eslint-disable-next-line @next/next/no-img-element */ <img src={qr} alt={tx("QR-code van de uitnodiging")} style={{ width: 180, height: 180, background: "#fff", padding: 8, borderRadius: 12, justifySelf: "center" }} />}
                <div><small className="muted">{tx("Jouw code")}</small><div className="code-input" style={{ fontSize: "1.8rem" }}>{nice}</div></div>
                <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label={tx("Link")} />
                <div className="row" style={{ justifyContent: "center" }}>
                  <button type="button" className="btn" onClick={() => copy("code", own.code)}>{copied === "code" ? tx("Gekopieerd") : tx("Code kopiëren")}</button>
                  <button type="button" className="btn" onClick={() => copy("link", link)}>{copied === "link" ? tx("Gekopieerd") : tx("Link kopiëren")}</button>
                </div>
                <a className="btn primary" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">{tx("Sturen via WhatsApp")}</a>
                {typeof navigator !== "undefined" && navigator.share && <button type="button" className="btn" onClick={() => navigator.share({ title: document.title, text, url: link }).catch(() => {})}>{tx("Delen…")}</button>}
                <small className="muted">{tx("De chat start zodra de ander de link opent of de code invult.")}</small>
              </div>
            )}
            <DirectConnection token={own.token} role="owner" secret={own.key} info={info} onChat={setChatting} onClosed={forget} />
            {!chatting && <button type="button" className="btn danger" onClick={closeRoom}>{tx("Uitnodiging intrekken")}</button>}
          </>
        )}
        {!chatting && !own && step === "profile" && <Link href="/direct" className="muted center">{tx("Heb je een code? Verbind zonder link")}</Link>}
        {!chatting && <Link href="/" className="muted center">{tx("← Naar de website")}</Link>}
      </div>
    </main>
  );
}

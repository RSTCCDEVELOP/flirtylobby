"use client";

import { tx } from "../../lib/t";
import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "../../components/BrandingContext";
import DirectConnection from "../../components/DirectConnection";
import ThemeToggle from "../../components/ThemeToggle";
import { api, errorText } from "../../lib/api";

const KEY = "directchat:own"; // {token, key, code}: this device's own chat, so a reload picks it up again

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); }
  catch { const a = document.createElement("textarea"); a.value = t; a.style.position = "fixed"; a.style.opacity = "0"; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } catch {} a.remove(); }
}

// Start a chat without an account: name and gender, then a code, link and QR code to hand out; the chat itself opens below.
export default function DirectChatStart() {
  const [name, setName] = useState("");
  const [gender, setGender] = useState("m");
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
      const n = localStorage.getItem("direct_name"), g = localStorage.getItem("direct_gender");
      if (n) setName(n);
      if (["m", "f", "x"].includes(g)) setGender(g);
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

  async function start(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      localStorage.setItem("direct_name", name); localStorage.setItem("direct_gender", gender);
      const r = await api("/direct/anon/", { method: "POST", body: { name, gender } });
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
    <main className="login-page" style={{ alignItems: "flex-start", paddingTop: "2rem" }}>
      <div className="login-theme"><ThemeToggle /></div>
      <div className="card login-card" style={{ maxWidth: 640, width: "100%" }}>
        {!chatting && <Logo className="direct-logo" />}
        {!chatting && <h1>{tx("Chat starten")}</h1>}
        {error && <div className="alert">{error}</div>}

        {ready && !own && (
          <form className="form" onSubmit={start}>
            <p className="muted" style={{ margin: 0 }}>{tx("Vul je naam in en kies je geslacht. Daarna krijg je een code, een link en een QR-code om aan iemand te geven.")}</p>
            <label>{tx("Jouw naam")}<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoFocus autoComplete="name" /></label>
            <div>
              <span style={{ fontWeight: 600, fontSize: ".9rem" }}>{tx("Geslacht")}</span>
              <div className="gender-pick" role="radiogroup" aria-label={tx("Geslacht")} style={{ marginTop: ".35rem" }}>
                {[["m", "Man"], ["f", "Vrouw"], ["x", "Overig"]].map(([k, l]) => <button type="button" key={k} data-g={k} role="radio" aria-checked={gender === k} className={gender === k ? "on" : ""} onClick={() => setGender(k)}>{tx(l)}</button>)}
              </div>
            </div>
            <button className="btn primary" disabled={busy || !name.trim()}>{busy ? tx("Bezig…") : tx("Chat starten")}</button>
          </form>
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
        {!chatting && <Link href="/direct" className="muted center">{tx("Heb je een code? Verbind zonder link")}</Link>}
      </div>
    </main>
  );
}

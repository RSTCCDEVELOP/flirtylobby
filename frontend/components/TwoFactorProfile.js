"use client";

import { tx } from "../lib/t";
import { useState } from "react";
import QRCode from "qrcode";
import { api, errorText } from "../lib/api";
import { useAuth } from "./AuthContext";
import { enableWithDialog } from "../lib/enable";
import CodeInput from "../components/CodeInput";


// Profile: switch for logging in with two-step verification (code by e-mail or sms).
// Off -> on: pick a way, enter the code we send. On -> off: confirm with the password.
export default function TwoFactorProfile() {
  const { user, setUser } = useAuth();
  const tf = user.twofa || {};
  const [panel, setPanel] = useState(""); // "" | "enable" | "disable"
  const [sentTo, setSentTo] = useState("");
  const [phone, setPhone] = useState(user.phone || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [app, setApp] = useState(null); // {secret, uri, qr} while the authenticator app is being set up
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [switched, setSwitched] = useState(false); // system setting switched on here: the button is gone

  const available = tf.enabled_system && (tf.available || []).length > 0;
  const locked = !tf.active && !available;      // cannot be switched on (system off or nothing to send with)
  const fixed = tf.active && tf.required;       // cannot be switched off (required by the site)
  const reset = () => { setApp(null); setPanel(""); setSentTo(""); setCode(""); setPassword(""); };
  const run = async (fn) => { setBusy(true); setMsg(null); try { await fn(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } setBusy(false); };

  const toggle = () => { setMsg(null); if (tf.active) setPanel(panel === "disable" ? "" : "disable"); else if (panel === "enable") reset(); else setPanel("enable"); };
  const start = (m) => run(async () => { const r = await api("/auth/2fa/start/", { method: "POST", body: { method: m, phone } }); setSentTo(r.destination); setCode(""); });
  const startApp = () => run(async () => {
    const r = await api("/auth/2fa/start/", { method: "POST", body: { method: "app" } });
    setApp({ secret: r.secret, uri: r.uri, qr: await QRCode.toDataURL(r.uri, { margin: 1, width: 360 }) }); setCode("");
  });
  // for password managers: put the key on the clipboard (fallback for browsers without the clipboard API)
  const copy = async () => {
    try { await navigator.clipboard.writeText(app.secret); }
    catch { const t = document.createElement("textarea"); t.value = app.secret; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const confirmApp = (e) => { e.preventDefault(); run(async () => {
    setUser(await api("/auth/2fa/confirm/", { method: "POST", body: { method: "app", code } })); reset(); setMsg({ ok: true, text: tx("Twee-staps verificatie staat aan.") });
  }); };
  const confirm = (e) => { e.preventDefault(); run(async () => { setUser(await api("/auth/2fa/confirm/", { method: "POST", body: { code } })); reset(); setMsg({ ok: true, text: tx("Twee-staps verificatie staat aan.") }); }); };
  const disable = (e) => { e.preventDefault(); run(async () => { setUser(await api("/auth/2fa/disable/", { method: "POST", body: { password } })); reset(); setMsg({ ok: true, text: tx("Twee-staps verificatie staat uit.") }); }); };

  // superadmin: switch the system setting on right here, no trip to the Security page
  const enableSystem = () => run(async () => {
    const done = await enableWithDialog({ title: tx("Twee-staps verificatie"), message: tx("Wil je twee-staps verificatie aanzetten voor de hele website?"), related: "twofa" }, async () => {
      // the module itself must be on too, otherwise the setting counts as off
      await api("/modules/twofa/", { method: "PATCH", body: { enabled: true } });
      await api("/security/settings/", { method: "PUT", body: { twofa: { enabled: true } } });
    });
    if (done) { const u = await api("/auth/me/"); setUser(u); setSwitched(!!u.twofa?.enabled_system); }
  });

  const on = tf.active || panel === "enable";
  return (
    <div className="form">
      <label className="check sec-toggle">
        <span className="switch"><input type="checkbox" checked={on} disabled={busy || locked || fixed} onChange={toggle} /><span /></span>
        <span>{tx("Inloggen met 2-staps verificatie")}
          <small className="muted"> {tf.active ? (tf.method === "app" ? tx("Authenticator-app") : `${tf.method === "sms" ? "sms" : tx("e-mail")} → ${tf.destination}`) : `${tx("na je wachtwoord vragen we om een code")}${(tf.available || []).length ? ` (${tf.available.map((m) => (m === "sms" ? "sms" : m === "app" ? tx("authenticator-app") : tx("e-mail"))).join(", ")})` : ""}`}</small>
        </span>
      </label>
      {locked && <p className="muted" style={{ margin: 0 }}>{!tf.enabled_system ? <>{tx("Twee-staps verificatie is uitgeschakeld door de beheerder.")} {user.is_staff && !switched && <button type="button" className="btn sm" disabled={busy} onClick={enableSystem}>{tx("Nu aanzetten")}</button>}</> : tx("Nog niet beschikbaar: er is geen e-mail- of sms-koppeling actief.")}</p>}
      {fixed && <p className="muted" style={{ margin: 0 }}>{tx("Twee-staps verificatie is verplicht voor jouw account.")}</p>}

      {panel === "enable" && !sentTo && !app && (
        <div className="row" style={{ justifyContent: "flex-start", flexWrap: "nowrap", alignItems: "end" }}>
          {tf.available.includes("sms") && (
            <label style={{ flex: 1, maxWidth: 260 }}>{tx("Telefoon (met landcode)")}
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+31612345678" />
            </label>
          )}
          {tf.available.includes("email") && <button type="button" className="btn primary" disabled={busy} onClick={() => start("email")}>{tx("Code per e-mail")}</button>}
          {tf.available.includes("sms") && <button type="button" className="btn" disabled={busy || !phone} onClick={() => start("sms")}>{tx("Code per sms")}</button>}
          {tf.available.includes("app") && <button type="button" className="btn" disabled={busy} onClick={startApp}>{tx("Authenticator-app")}</button>}
          <button type="button" className="btn" onClick={reset}>{tx("Annuleren")}</button>
        </div>
      )}
      {panel === "enable" && app && (
        <form className="form totp-setup" onSubmit={confirmApp}>
          <p className="muted" style={{ margin: 0 }}>{tx("Scan de QR-code met je authenticator-app (Google Authenticator, Microsoft Authenticator, Authy…) of kopieer de sleutel naar je wachtwoordmanager.")}</p>
          <div className="totp-box">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="qr" src={app.qr} alt={tx("QR-code voor je authenticator-app")} />
            <div className="totp-key">
              <small className="muted">{tx("Sleutel")}</small>
              <code>{app.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
              <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
                <button type="button" className="btn sm" onClick={copy}>{copied ? tx("Gekopieerd") : tx("Kopieer sleutel")}</button>
                <a className="btn sm" href={app.uri}>{tx("Open in authenticator-app")}</a>
              </div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: "flex-start", flexWrap: "nowrap", alignItems: "end" }}>
            <div className="code-field" style={{ flex: 1 }}><span>{tx("Code uit de app")}</span><CodeInput value={code} onChange={setCode} autoFocus /></div>
            <button className="btn primary" disabled={busy || code.length < 6}>{tx("Bevestigen")}</button>
            <button type="button" className="btn" onClick={reset}>{tx("Annuleren")}</button>
          </div>
        </form>
      )}
      {panel === "enable" && sentTo && (
        <form className="form" onSubmit={confirm}>
          <p className="muted" style={{ margin: 0 }}>{tx("We hebben een code gestuurd naar")} {sentTo}.</p>
          <div className="row" style={{ justifyContent: "flex-start", flexWrap: "nowrap", alignItems: "end" }}>
            <div className="code-field" style={{ flex: 1 }}><span>{tx("Code")}</span><CodeInput value={code} onChange={setCode} autoFocus /></div>
            <button className="btn primary" disabled={busy || code.length < 6}>{tx("Bevestigen")}</button>
            <button type="button" className="btn" onClick={reset}>{tx("Annuleren")}</button>
          </div>
        </form>
      )}
      {panel === "disable" && (
        <form className="form" onSubmit={disable}>
          <div className="row" style={{ justifyContent: "flex-start", flexWrap: "nowrap", alignItems: "end" }}>
            <label style={{ flex: 1, maxWidth: 320 }}>{tx("Wachtwoord")}
              <input type="text" name="username" value={user?.email || ""} autoComplete="username" readOnly tabIndex={-1} aria-hidden="true" style={{ position: "absolute", width: 1, height: 1, margin: -1, padding: 0, border: 0, overflow: "hidden", clip: "rect(0 0 0 0)" }} />
              <input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus autoComplete="current-password" />
            </label>
            <button className="btn danger" disabled={busy || !password}>{tx("Uitschakelen")}</button>
            <button type="button" className="btn" onClick={reset}>{tx("Annuleren")}</button>
          </div>
        </form>
      )}
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
    </div>
  );
}

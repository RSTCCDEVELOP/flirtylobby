"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { loginWithPasskey, passkeysSupported } from "../lib/webauthn";

const load = (src) => new Promise((resolve, reject) => {
  if (document.querySelector(`script[src="${src}"]`)) return resolve();
  const s = document.createElement("script");
  s.src = src; s.async = true; s.onload = resolve; s.onerror = reject;
  document.head.appendChild(s);
});

// Under the login form: log in with a passkey, with Google or with Apple (only what the administrator switched on and filled in).
export default function SsoButtons({ onLogin, onError }) {
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const googleBox = useRef(null);
  useEffect(() => { api("/auth/sso/config/").then(setCfg).catch(() => setCfg(null)); }, []);

  const done = async (call) => {
    setBusy(true); onError("");
    try { onLogin(await call()); } catch (e) { if (e?.name !== "NotAllowedError") onError(errorText(e)); setBusy(false); }  // NotAllowedError: the person cancelled
  };

  useEffect(() => {
    if (!cfg?.google || !googleBox.current) return;
    load("https://accounts.google.com/gsi/client").then(() => {
      window.google.accounts.id.initialize({ client_id: cfg.google.client_id, callback: (r) => done(() => api("/auth/google/", { method: "POST", body: { credential: r.credential } })) });
      window.google.accounts.id.renderButton(googleBox.current, { theme: "outline", size: "large", text: "continue_with", shape: "rectangular", width: 300 });
    }).catch(() => {});
  }, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const apple = () => done(async () => {
    await load("https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js");
    window.AppleID.auth.init({ clientId: cfg.apple.client_id, scope: "name email", redirectURI: `${window.location.origin}/login`, usePopup: true });
    const r = await window.AppleID.auth.signIn();
    const n = r.user?.name;
    return api("/auth/apple/", { method: "POST", body: { id_token: r.authorization.id_token, name: n ? `${n.firstName || ""} ${n.lastName || ""}`.trim() : "" } });
  });

  const passkey = cfg?.passkey && passkeysSupported();
  if (!cfg || !(passkey || cfg.google || cfg.apple)) return null;
  return (
    <div className="sso-box">
      <div className="sso-or"><span>{tx("of")}</span></div>
      {passkey && <button type="button" className="btn sso-btn" disabled={busy} onClick={() => done(loginWithPasskey)}>🔑 {tx("Inloggen met een passkey")}</button>}
      {cfg.google && <div ref={googleBox} className="sso-google" />}
      {cfg.apple && <button type="button" className="btn sso-btn" disabled={busy} onClick={apple}>&#63743; {tx("Doorgaan met Apple")}</button>}
    </div>
  );
}

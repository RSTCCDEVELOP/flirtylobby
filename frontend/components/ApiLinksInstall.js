// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";

// A superadmin logs in and the Easy2edit links (Stripe, Postmark, Claude) are not there yet: ask for the password of the locked file in resource/api and install and switch them on.
export default function ApiLinksInstall() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!user?.is_staff) return;
    api("/admin/integrations/syslinks/").then((s) => { if (s.needed) setOpen(true); }).catch(() => {});
  }, [user]);
  if (!open || typeof document === "undefined") return null;
  const go = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await api("/admin/integrations/syslinks/install/", { method: "POST", body: { password: pw } }); window.location.reload(); }
    catch (x) { setErr(errorText(x)); setBusy(false); }
  };
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tx("Easy2edit API-koppelingen installeren")}>
      <form className="card modal form" style={{ maxWidth: 460 }} onSubmit={go}>
        <h2 style={{ margin: 0 }}>{tx("Easy2edit API-koppelingen installeren")}</h2>
        <p style={{ margin: 0 }}>{tx("De koppelingen met Stripe, Postmark en Claude zijn nog niet geladen. Vul het wachtwoord van het bestand met de API-koppelingen in om ze te installeren en aan te zetten.")}</p>
        <label>{tx("Wachtwoord")}<input type="password" autoFocus autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        {err && <div className="alert">{err}</div>}
        <div className="row" style={{ justifyContent: "flex-end", gap: ".5rem" }}>
          <button type="button" className="btn" onClick={() => setOpen(false)}>{tx("Later")}</button>
          <button type="submit" className="btn primary" disabled={busy || !pw}>{tx("Installeren")}</button>
        </div>
      </form>
    </div>, document.body);
}

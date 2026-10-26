// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { useAuth } from "./AuthContext";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";

// The alert for an error. When the error is "this module is off" (msg.module) a superadmin gets a button to switch the module on.
export default function ModuleOffAlert({ msg, onDone, style }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!msg) return null;
  const enable = async () => {
    setBusy(true); setErr("");
    try { await api(`/modules/${msg.module}/`, { method: "PATCH", body: { enabled: true } }); window.dispatchEvent(new Event("plugins-changed")); window.location.reload(); onDone?.(); }
    catch (e) { setErr(errorText(e)); setBusy(false); }
  };
  return (
    <div className={msg.ok ? "alert ok" : "alert"} style={style}>
      {msg.text}
      {!msg.ok && msg.module && user?.is_staff && (
        <div className="row" style={{ marginTop: ".6rem" }}>
          <button type="button" className="btn primary" disabled={busy} onClick={enable}>{busy ? tx("Bezig…") : tx("Aanzetten")}</button>
          {err && <span>{err}</span>}
        </div>
      )}
    </div>
  );
}

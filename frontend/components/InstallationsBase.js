// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net


"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";

// The basis of the standard installations (superadmins): which ones are offered at the first installation, which ones administrators see, and what was changed in them.
// "Opslaan als basis" writes backend/apps/core/installations.json (it goes into git); every site that gets that file applies it by itself the next time the server starts.
export default function InstallationsBase() {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const load = () => api("/system/installations-config/").then(setInfo).catch(() => setInfo({ exists: false }));
  useEffect(() => { load(); }, []);
  const run = async (action) => {
    const ask = action === "capture"
      ? tx("De keuzes over de standaard installaties van deze site opslaan als basis? Het bestand gaat mee in git; alle sites die het krijgen, gebruiken dan dezelfde keuzes.")
      : tx("De opgeslagen basis nu toepassen? De keuzes van deze site over de standaard installaties worden vervangen.");
    if (!(await confirmDialog(ask, { okLabel: action === "capture" ? tx("Opslaan") : tx("Toepassen"), cancelLabel: tx("Annuleren"), danger: action === "apply" }))) return;
    setBusy(action); setMsg(null);
    try {
      const r = await api("/system/installations-config/", { method: "POST", body: { action } });
      setInfo(r);
      setMsg({ ok: true, text: action === "capture" ? tx("De basis is opgeslagen. Neem het bestand mee in git.") : tx("De basis is toegepast.") });
      if (action === "apply") window.dispatchEvent(new Event("presets-changed"));
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  return (
    <div className="card" style={{ display: "grid", gap: ".5rem" }}>
      <strong>{tx("Basis voor alle Easy2edit-sites")}</strong>
      <small className="muted">
        {info?.exists ? `${tx("Opgeslagen op")} ${new Date(info.saved_at).toLocaleString()} · ${info.same ? tx("gelijk aan deze site") : tx("verschilt van deze site")}` : tx("Nog niets opgeslagen")}
      </small>
      <div className="row" style={{ gap: ".5rem", flexWrap: "wrap", justifyContent: "flex-start" }}>
        <button type="button" className="btn primary" disabled={!!busy} onClick={() => run("capture")}>{busy === "capture" ? tx("Bezig…") : tx("Opslaan als basis")}</button>
        {info?.exists && <button type="button" className="btn" disabled={!!busy || info.same} onClick={() => run("apply")}>{busy === "apply" ? tx("Bezig…") : tx("Basis toepassen")}</button>}
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";

// Super admin -> Systeem: save the settings of this site as the defaults (security, look, community, languages, dashboard, refresh rate). A reset or a new installation starts with them.
export default function SaveDefaults() {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  useEffect(() => { api("/system/site-defaults/").then(setInfo).catch(() => setInfo({ exists: false })); }, []);
  const run = async (action) => {
    const ask = action === "capture"
      ? tx("De huidige instellingen opslaan als standaard? Een reset en een nieuwe installatie starten daar dan mee. De vorige standaard wordt vervangen.")
      : tx("De opgeslagen standaard instellingen nu toepassen? Je huidige instellingen van beveiliging, vormgeving, community, talen en dashboard worden vervangen.");
    if (!(await confirmDialog(ask, { okLabel: action === "capture" ? tx("Opslaan") : tx("Toepassen"), cancelLabel: tx("Annuleren"), danger: action === "apply" }))) return;
    setBusy(action); setMsg(null);
    try {
      const r = await api("/system/site-defaults/", { method: "POST", body: { action } });
      setInfo({ exists: r.exists, captured_at: r.captured_at, sections: r.sections });
      setMsg({ ok: true, text: action === "capture" ? tx("De instellingen zijn opgeslagen als standaard.") : tx("De standaard instellingen zijn toegepast. Laad de pagina opnieuw om alles te zien.") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  return (
    <div className="card stat" style={{ display: "grid", gap: ".5rem", alignContent: "start" }}>
      <span>{tx("Standaard instellingen")}</span>
      <strong style={{ fontSize: "1.25rem" }}>{tx("Instellingen als standaard")}</strong>
      <small>{info?.exists ? `${tx("Opgeslagen op")} ${new Date(info.captured_at).toLocaleString()}` : tx("Nog niets opgeslagen")}</small>
      <div className="row" style={{ gap: ".5rem", flexWrap: "wrap" }}>
        <button type="button" className="btn primary" disabled={!!busy} onClick={() => run("capture")}>{busy === "capture" ? tx("Bezig…") : tx("Save defaults")}</button>
        {info?.exists && <button type="button" className="btn" disabled={!!busy} onClick={() => run("apply")}>{busy === "apply" ? tx("Bezig…") : tx("Standaard toepassen")}</button>}
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
    </div>
  );
}

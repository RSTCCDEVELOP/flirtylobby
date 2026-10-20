"use client";

import { Busy } from "./PageLoader";
import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";

// Superadmin: which profile themes the community admins may choose from. Only the basic theme is on by default; the theme in use stays on.
export default function ProfileThemeSwitches() {
  const [list, setList] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api("/community/theme-switches/").then((d) => setList(d.themes)).catch((e) => setMsg(errorText(e))); }, []);
  async function toggle(key, on) {
    const next = list.map((t) => (t.key === key ? { ...t, enabled: on } : t));
    setList(next);
    try { const d = await api("/community/theme-switches/", { method: "PUT", body: { enabled: next.filter((t) => t.enabled).map((t) => t.key) } }); setList(d.themes); setMsg(null); } catch (e) { setMsg(errorText(e)); api("/community/theme-switches/").then((d) => setList(d.themes)).catch(() => {}); }
  }
  if (!list) return msg ? <div className="alert">{msg}</div> : <Busy />;
  return (
    <div className="form">
      {msg && <div className="alert">{msg}</div>}
      <p className="muted" style={{ margin: 0 }}>{tx("Welke profielthema's de beheerders van de community mogen kiezen (Admin → Community → Profielthema en velden). Standaard staat alleen het basisthema aan. Het thema dat nu in gebruik is blijft aan.")}</p>
      <div className="plugin-items">
        {list.map((t) => (
          <div key={t.key} className="plugin-item">
            <span className="pi-main"><strong>{tx(t.label)}</strong>{t.active && <span className="badge ok" style={{ marginLeft: ".5rem", display: "inline-block", width: "auto", flex: "none" }}>{tx("In gebruik")}</span>}<span className="pi-desc">{tx(t.desc)} · {t.fields} {tx("eigen velden")}</span></span>
            <span className="pi-actions">
              <label className="check sec-toggle" title={t.locked ? tx(t.active ? "Dit thema is in gebruik" : "Het basisthema staat altijd aan") : undefined}>
                <span className="switch"><input type="checkbox" checked={t.enabled} disabled={t.locked} onChange={(e) => toggle(t.key, e.target.checked)} /><span /></span>
                <span>{t.enabled ? tx("Aan") : tx("Uit")}</span>
              </label>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

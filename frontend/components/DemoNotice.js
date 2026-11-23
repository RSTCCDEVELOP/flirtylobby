// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { useAuth } from "./AuthContext";
import { tx } from "../lib/t";

// Demo mode: a message shortly before the demo is put back, and a screen while it is being restored (the page loads again by itself when it is ready).
export default function DemoNotice() {
  const [d, setD] = useState(null);
  const was = useRef(false);
  const { user } = useAuth() || {};
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const choose = async (key) => {
    setBusy(key); setErr("");
    try { await api("/demo/installation/", { method: "POST", body: { key } }); window.location.reload(); } catch (e) { setErr(errorText(e)); setBusy(""); }
  };
  useEffect(() => {
    let stop = false, timer;
    const tick = async () => {
      let next = null;
      try { next = (await api("/sandbox/status/"))?.demo || null; } catch { next = was.current ? { enabled: true, restoring: true } : null; }  // the server does not answer while it is restoring
      if (stop) return;
      if (was.current && next && next.enabled && !next.restoring) { window.location.reload(); return; }  // ready: the page is drawn again with the restored data
      was.current = !!(next && next.restoring);
      setD(next && next.enabled ? next : null);
      timer = setTimeout(tick, next?.restoring ? 4000 : next?.warn ? 15000 : 60000);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, []);
  if (!d?.enabled) return null;
  if (d.restoring) {
    return (
      <div role="alert" style={{ position: "fixed", inset: 0, zIndex: 4000, display: "grid", placeItems: "center", background: "rgba(20,30,25,.82)", color: "#fff", padding: "1.5rem", textAlign: "center" }}>
        <div style={{ display: "grid", gap: ".6rem", maxWidth: 460 }}>
          <strong style={{ fontSize: "1.4rem" }}>{tx("De demo wordt hersteld")}</strong>
          <span>{tx("Alles wat is gedaan wordt teruggezet naar het begin. Een moment geduld: de pagina laadt vanzelf weer.")}</span>
        </div>
      </div>
    );
  }
  const switcher = user?.demo_switch && (d.installations || []).length > 1 ? (
    <div style={{ position: "fixed", left: 0, bottom: "7rem", zIndex: 3085 }}>
      {pick ? (
        <div className="card" role="dialog" aria-label={tx("Kies een installatie")} style={{ width: "min(360px, 92vw)", display: "grid", gap: ".5rem", padding: ".9rem 1rem", boxShadow: "0 14px 44px rgba(0,0,0,.32)", borderRadius: "0 14px 14px 0" }}>
          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong>{tx("Kies een installatie")}</strong><button type="button" className="btn sm" aria-label={tx("Sluiten")} onClick={() => setPick(false)}>×</button></span>
          {d.installations.map((i) => (
            <button key={i.key} type="button" className="btn" disabled={!!busy || i.key === d.installation} onClick={() => choose(i.key)} style={{ justifyContent: "flex-start", textAlign: "left", display: "grid" }}>
              <strong>{i.name}{i.key === d.installation ? ` · ${tx("nu actief")}` : ""}</strong>
            </button>
          ))}
          {err && <small className="error" role="alert">{err}</small>}
        </div>
      ) : (
        <button type="button" onClick={() => setPick(true)} style={{ padding: ".55rem .8rem .55rem .6rem", border: "1px solid #2f7d5b", borderLeft: 0, borderRadius: "0 14px 14px 0", background: "#2f7d5b", color: "#fff", cursor: "pointer", font: "inherit", boxShadow: "0 6px 20px rgba(0,0,0,.25)" }}>{tx("Demo")} ›</button>
      )}
    </div>
  ) : null;
  if (!d.warn) return switcher;
  const m = Math.max(1, Math.ceil((d.seconds_left || 0) / 60));
  return <>{switcher}<div role="status" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", top: 8, zIndex: 3995, padding: ".5rem 1rem", borderRadius: 99, background: "#d98f2b", color: "#fff", fontWeight: 600, boxShadow: "0 6px 20px rgba(0,0,0,.25)" }}>{tx("De demo wordt over {0} min hersteld: wat je nu doet gaat verloren.", String(m))}</div></>;
}

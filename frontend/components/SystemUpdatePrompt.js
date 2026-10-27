// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import RunPopup from "./RunPopup";

const KEY = "sysupdate-later";

// After an update of Easy2edit (a new build): an administrator or superadmin is asked whether the site may be checked and brought up to date.
// The window shows each step (copy of the content, database, plugins, themes, languages, pages) with a progress bar. Content is never removed.
export default function SystemUpdatePrompt() {
  const { user } = useAuth() || {};
  const [info, setInfo] = useState(null);
  const [run, setRun] = useState(null);

  useEffect(() => {
    if (!user) return;
    try { if (sessionStorage.getItem(KEY)) return; } catch {}
    api("/system/update/").then((r) => { if (r?.needed) setInfo(r); }).catch(() => {});
  }, [user]);

  const later = () => { try { sessionStorage.setItem(KEY, "1"); } catch {} setInfo(null); };

  async function start() {
    const steps = info.steps.map((s) => ({ ...s, status: "wait" }));
    setInfo(null);
    const notes = [];
    let failed = 0;
    setRun({ title: tx("Site controleren en bijwerken"), steps, error: "", done: false, notes });
    for (const s of steps) {
      setRun((x) => ({ ...x, steps: x.steps.map((y) => (y.key === s.key ? { ...y, status: "busy" } : y)) }));
      let r;
      try { r = await api("/system/update/", { method: "POST", body: { step: s.key } }); } catch (e) { r = { ok: false, message: errorText(e) }; }
      if (!r.ok) failed++;
      if (r.message) notes.push(`${tx(s.label)}: ${tx(r.message)}`);
      setRun((x) => ({ ...x, notes: [...notes], steps: x.steps.map((y) => (y.key === s.key ? { ...y, status: r.ok ? "ok" : "error" } : y)) }));
    }
    setRun((x) => ({ ...x, done: true, note: failed ? tx("Klaar, maar {0} stap(pen) hebben aandacht nodig: zie hieronder.", failed) : tx("Alles is gecontroleerd en actueel. Je pagina's en teksten zijn niet gewijzigd.") }));
  }

  return (
    <>
      <RunPopup run={run} onClose={() => { setRun(null); window.location.reload(); }} />
      {info && (
        <div className="overlay" role="dialog" aria-modal="true" onClick={later}>
          <div className="card modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{tx("Nieuwe versie van Easy2edit")}</h2>
            <p>{tx("Easy2edit is bijgewerkt naar versie {0}, build {1}. Wil je je site laten controleren en bijwerken, zodat alles compatibel blijft?", info.version, info.build)}</p>
            <ul className="muted" style={{ margin: ".2rem 0 .8rem", paddingLeft: "1.1rem" }}>
              {info.steps.map((s) => <li key={s.key}>{tx(s.label)}</li>)}
            </ul>
            <p className="muted" style={{ margin: 0 }}>{tx("Je pagina's, ontwerpen en teksten worden eerst bewaard in de sitemap en blijven staan: er wordt niets overschreven.")}</p>
            <div className="row" style={{ marginTop: "1rem", justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={later}>{tx("Later")}</button>
              <button type="button" className="btn primary" onClick={start}>{tx("Nu controleren en bijwerken")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

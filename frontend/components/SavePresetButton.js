// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { useSession } from "./Session";

// Edit mode, superadmins only: save this page as it is now in a standard installation (the active one or another one). Setting that installation later puts the page back.
export default function SavePresetButton() {
  const { user, editing } = useSession();
  const path = usePathname() || "/";
  const [state, setState] = useState(null); // {page, presets}
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (!editing || !user?.is_staff || path.startsWith("/dashboard")) return null;

  async function open() {
    setBusy(true); setMsg(null);
    try {
      const [pg, presets] = await Promise.all([api(`/pages/by-url/?path=${encodeURIComponent(path)}`), api("/system/presets/")]);
      setState({ page: pg, presets });
      setPick((presets.find((p) => p.active) || presets[0] || {}).key || "");
    } catch (e) { setState(null); setMsg({ ok: false, text: /404|niet gevonden|Not found/i.test(errorText(e)) ? tx("Deze pagina staat niet in Admin → Pagina's.") : errorText(e) }); }
    setBusy(false);
  }
  async function save() {
    setBusy(true); setMsg(null);
    try {
      await api(`/system/presets/${pick}/page/`, { method: "POST", body: { page: state.page.key } });
      const name = state.presets.find((p) => p.key === pick)?.name || pick;
      setMsg({ ok: true, text: tx("De pagina is opgeslagen in de installatie \"{0}\".", tx(name)) });
      setState(null);
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  }
  const active = state?.presets.find((p) => p.active);
  return (
    <>
      <button type="button" className="edit-save-preset-btn" onClick={open} disabled={busy} title={tx("Deze pagina opslaan in een standaard installatie")} aria-label={tx("Deze pagina opslaan in een standaard installatie")}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h11l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" /><path d="M7 3v5h8V3M7 21v-7h10v7" /></svg>
      </button>
      {msg && <div className={`edit-save-preset-msg ${msg.ok ? "ok" : "err"}`} role="status" onClick={() => setMsg(null)}>{msg.text}</div>}
      {state && (
        <div className="overlay" onClick={() => setState(null)}>
          <div className="card modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{tx("Pagina opslaan in een standaard installatie")}</h2>
            <p className="muted" style={{ marginTop: 0 }}>{tx("De blokken en teksten van deze pagina worden bewaard bij de gekozen installatie. Stel je die installatie later in, dan komt de pagina zo terug.")}</p>
            <div style={{ display: "grid", gap: ".4rem" }}>
              {active && (
                <label className="check"><input type="radio" name="presetpick" checked={pick === active.key} onChange={() => setPick(active.key)} /><span><strong>{tx("De actieve installatie")}</strong>: {tx(active.name)}</span></label>
              )}
              {state.presets.filter((p) => !p.active).map((p) => (
                <label className="check" key={p.key}><input type="radio" name="presetpick" checked={pick === p.key} onChange={() => setPick(p.key)} /><span>{tx(p.name)}{p.saved_pages?.includes(state.page.key) ? <small className="muted"> · {tx("heeft deze pagina al (wordt vervangen)")}</small> : null}</span></label>
              ))}
            </div>
            <div className="row" style={{ marginTop: "1rem", gap: ".5rem" }}>
              <button type="button" className="btn" onClick={() => setState(null)}>{tx("Annuleren")}</button>
              <button type="button" className="btn primary" disabled={busy || !pick} onClick={save}>{busy ? tx("Bezig…") : tx("Opslaan")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

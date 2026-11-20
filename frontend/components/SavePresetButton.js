// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { useSession } from "./Session";

// Edit mode, superadmins only: save this page as it is now in a standard installation (the active one or another one). Setting that installation later puts the page back.
export default function SavePresetButton() {
  const { user, editing } = useSession();
  const path = usePathname() || "/";
  const [open, setOpen] = useState(false);   // the pop-up
  const [step, setStep] = useState("choose");  // choose: save this page or as the standard page | pick: the standard installations (the menu)
  const [state, setState] = useState(null); // {page, presets}
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState(null);
  useEffect(() => {  // the save button at the bottom of the left panel asks the same question
    const ask = () => { setMsg(null); setStep("choose"); setOpen(true); };
    window.addEventListener("pb-save-ask", ask);
    return () => window.removeEventListener("pb-save-ask", ask);
  }, []);
  useEffect(() => {  // the message goes away by itself: "saved" after 3 seconds, an error after 8 (a new message starts its own time; the timer is cleared when the message changes or the button goes)
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(null), msg.ok ? 3000 : 8000);
    return () => clearTimeout(t);
  }, [msg]);
  if (!editing || !user?.is_staff || path.startsWith("/dashboard")) return null;

  const close = () => { setOpen(false); setStep("choose"); setState(null); setErr(""); };
  function savePage() {  // the page as it is now, on this website (what waits in the delay of the editor goes out at once)
    close(); setBusy(true); setMsg(null);
    let answered = false;
    const done = (ok) => { answered = true; setBusy(false); setMsg(ok ? { ok: true, text: tx("De pagina is opgeslagen.") } : { ok: false, text: tx("Opslaan mislukt") }); };
    window.dispatchEvent(new CustomEvent("pb-flush", { detail: { done } }));
    setTimeout(() => { if (!answered) done(true); }, 1500);  // a page without blocks (only texts): those are saved while typing
  }
  async function showMenu() {  // the menu with the standard installations, in this same pop-up
    setStep("pick"); setBusy(true); setErr(""); setState(null);
    try {
      const [pg, presets] = await Promise.all([api(`/pages/by-url/?path=${encodeURIComponent(path)}`), api("/system/presets/")]);
      setState({ page: pg, presets });
      setPick((presets.find((p) => p.active) || presets[0] || {}).key || "");
    } catch (e) { setErr(/404|niet gevonden|Not found/i.test(errorText(e)) ? tx("Deze pagina staat niet in Admin → Pagina's.") : errorText(e)); }
    setBusy(false);
  }
  async function saveStandard() {
    setBusy(true); setErr("");
    try {
      await api(`/system/presets/${pick}/page/`, { method: "POST", body: { page: state.page.key } });
      const name = state.presets.find((p) => p.key === pick)?.name || pick;
      close();
      setMsg({ ok: true, text: tx("De pagina is opgeslagen in de installatie \"{0}\".", tx(name)) });
    } catch (e) { setErr(errorText(e)); }
    setBusy(false);
  }
  const active = state?.presets.find((p) => p.active);
  const optionStyle = { display: "grid", gap: ".15rem", textAlign: "left", padding: ".8rem 1rem" };
  return (
    <>
      <button type="button" className="edit-save-preset-btn" onClick={() => { setMsg(null); setStep("choose"); setOpen(true); }} disabled={busy && !open} title={tx("Opslaan")} aria-label={tx("Opslaan")}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h11l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" /><path d="M7 3v5h8V3M7 21v-7h10v7" /></svg>
      </button>
      {msg && <div className={`edit-save-preset-msg ${msg.ok ? "ok" : "err"}`} role="status" onClick={() => setMsg(null)}>{msg.text}</div>}
      {open && (
        <div className="overlay" onClick={close}>
          <div className="card modal" role="dialog" aria-label={tx("Opslaan")} style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            {step === "choose" ? (
              <>
                <h2 style={{ marginTop: 0 }}>{tx("Waar wil je de pagina opslaan?")}</h2>
                <div style={{ display: "grid", gap: ".6rem" }}>
                  <button type="button" className="btn primary" style={optionStyle} onClick={savePage} autoFocus>
                    <strong>{tx("Deze pagina opslaan")}</strong>
                    <small style={{ fontWeight: 400, opacity: 0.9 }}>{tx("Bewaart de pagina zoals hij nu is op deze website.")}</small>
                  </button>
                  <button type="button" className="btn" style={optionStyle} onClick={showMenu}>
                    <strong>{tx("Opslaan als standaardpagina")}</strong>
                    <small className="muted" style={{ fontWeight: 400 }}>{tx("Bewaart de pagina in een standaard installatie, zodat hij daar later terugkomt.")}</small>
                  </button>
                </div>
                <div className="row" style={{ marginTop: "1rem", justifyContent: "flex-end" }}><button type="button" className="btn" onClick={close}>{tx("Annuleren")}</button></div>
              </>
            ) : (
              <>
                <h2 style={{ marginTop: 0 }}>{tx("Opslaan als standaardpagina")}</h2>
                <p className="muted" style={{ marginTop: 0 }}>{tx("De blokken en teksten van deze pagina worden bewaard bij de gekozen installatie. Stel je die installatie later in, dan komt de pagina zo terug.")}</p>
                {!state && busy && <p className="muted">{tx("Laden…")}</p>}
                {err && <div className="alert">{err}</div>}
                {state && (
                  <div style={{ display: "grid", gap: ".4rem" }} role="radiogroup" aria-label={tx("Kies een installatie")}>
                    {active && (
                      <label className="check"><input type="radio" name="presetpick" checked={pick === active.key} onChange={() => setPick(active.key)} /><span><strong>{tx("De actieve installatie")}</strong>: {tx(active.name)}{active.saved_pages?.includes(state.page.key) ? <small className="muted"> · {tx("heeft deze pagina al (wordt vervangen)")}</small> : null}</span></label>
                    )}
                    {state.presets.filter((p) => !p.active).map((p) => (
                      <label className="check" key={p.key}><input type="radio" name="presetpick" checked={pick === p.key} onChange={() => setPick(p.key)} /><span>{tx(p.name)}{p.saved_pages?.includes(state.page.key) ? <small className="muted"> · {tx("heeft deze pagina al (wordt vervangen)")}</small> : null}</span></label>
                    ))}
                  </div>
                )}
                <div className="row" style={{ marginTop: "1rem", gap: ".5rem", justifyContent: "space-between" }}>
                  <button type="button" className="btn" onClick={() => { setStep("choose"); setErr(""); setState(null); }}>{tx("Terug")}</button>
                  <span className="row" style={{ gap: ".5rem" }}>
                    <button type="button" className="btn" onClick={close}>{tx("Annuleren")}</button>
                    <button type="button" className="btn primary" disabled={busy || !state || !pick} onClick={saveStandard}>{busy && state ? tx("Bezig…") : tx("Opslaan")}</button>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { useSession } from "./Session";
import TbSlot from "./TbSlot";

// Edit mode, superadmins only: save this page as it is now in a standard installation (the active one or another one). Setting that installation later puts the page back.
export default function SavePresetButton() {
  const { user, editing } = useSession();
  const path = usePathname() || "/";
  const [open, setOpen] = useState(false);   // the pop-up
  const [choice, setChoice] = useState("page");  // page: this page on this website | standard: in a standard installation
  const [step, setStep] = useState("choose");  // choose: save this page or as the standard page | pick: the standard installations (the menu)
  const [state, setState] = useState(null); // {page, presets}
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState(null);
  const askRef = useRef(null);
  useEffect(() => {  // the save button at the bottom of the left panel asks the same question
    const ask = () => askRef.current?.();
    window.addEventListener("pb-save-ask", ask);
    return () => window.removeEventListener("pb-save-ask", ask);
  }, []);
  useEffect(() => {  // the message goes away by itself: "saved" after 3 seconds, an error after 8 (a new message starts its own time; the timer is cleared when the message changes or the button goes)
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(null), msg.ok ? 3000 : 8000);
    return () => clearTimeout(t);
  }, [msg]);
  if (!editing || !user?.is_staff || path.startsWith("/dashboard")) return null;

  // Saving: the choice (this page on this website, or in a standard installation) is only shown to a superadmin+ while the sandbox mode is on; everybody else just saves the page for the website
  async function askSave() {
    setMsg(null); setStep("choose");
    let choose = false;
    if (user?.is_superadmin_plus) { try { choose = !!(await api("/sandbox/status/"))?.enabled; } catch { choose = false; } }
    if (choose) setOpen(true); else savePage();
  }
  askRef.current = askSave;
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
      <TbSlot><button type="button" className="edit-save-preset-btn" onClick={askSave} disabled={busy && !open} title={tx("Opslaan")} aria-label={tx("Opslaan")}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h11l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" /><path d="M7 3v5h8V3M7 21v-7h10v7" /></svg>
      </button></TbSlot>
      {msg && <div className={`edit-save-preset-msg ${msg.ok ? "ok" : "err"}`} role="status" onClick={() => setMsg(null)}>{msg.text}</div>}
      {open && (
        <div className="overlay" onClick={close}>
          <div className="card modal" role="dialog" aria-label={tx("Opslaan")} style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            {step === "choose" ? (
              <>
                <h2 style={{ marginTop: 0 }}>{tx("Waar wil je de pagina opslaan?")}</h2>
                <div className="sp-options" role="radiogroup" aria-label={tx("Waar wil je de pagina opslaan?")}>
                  {[["page", "Deze pagina opslaan", "Bewaart de pagina zoals hij nu is op deze website."], ["standard", "Opslaan als standaardpagina", "Bewaart de pagina in een standaard installatie, zodat hij daar later terugkomt."]].map(([k, title, hint]) => (
                    <button type="button" key={k} role="radio" aria-checked={choice === k} className={`sp-option${choice === k ? " on" : ""}`} onClick={() => setChoice(k)} onDoubleClick={() => (k === "page" ? savePage() : showMenu())} autoFocus={k === "page"}>
                      <span className="sp-check" aria-hidden="true">{choice === k && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}</span>
                      <span className="sp-text"><strong>{tx(title)}</strong><small>{tx(hint)}</small></span>
                    </button>
                  ))}
                </div>
                <div className="row" style={{ marginTop: "1.1rem", gap: ".5rem", justifyContent: "flex-end" }}>
                  <button type="button" className="btn" onClick={close}>{tx("Annuleren")}</button>
                  <button type="button" className="btn primary" onClick={() => (choice === "page" ? savePage() : showMenu())}>{choice === "page" ? tx("Opslaan") : tx("Verder")}</button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ marginTop: 0 }}>{tx("Opslaan als standaardpagina")}</h2>
                <p className="muted" style={{ marginTop: 0 }}>{tx("De blokken en teksten van deze pagina worden bewaard bij de gekozen installatie. Stel je die installatie later in, dan komt de pagina zo terug.")}</p>
                {!state && busy && <p className="muted">{tx("Laden…")}</p>}
                {err && <div className="alert">{err}</div>}
                {state && (
                  <div className="sp-options" role="radiogroup" aria-label={tx("Kies een installatie")}>
                    {active && (
                      <button type="button" role="radio" aria-checked={pick === active.key} className={`sp-option${pick === active.key ? " on" : ""}`} onClick={() => setPick(active.key)}>
                        <span className="sp-check" aria-hidden="true">{pick === active.key && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}</span>
                        <span className="sp-text"><strong>{tx("De actieve installatie")}</strong>: {tx(active.name)}{active.saved_pages?.includes(state.page.key) ? <small className="muted"> · {tx("heeft deze pagina al (wordt vervangen)")}</small> : null}</span>
                      </button>
                    )}
                    {state.presets.filter((p) => !p.active).map((p) => (
                      <button type="button" key={p.key} role="radio" aria-checked={pick === p.key} className={`sp-option${pick === p.key ? " on" : ""}`} onClick={() => setPick(p.key)}>
                        <span className="sp-check" aria-hidden="true">{pick === p.key && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}</span>
                        <span className="sp-text">{tx(p.name)}{p.saved_pages?.includes(state.page.key) ? <small className="muted"> · {tx("heeft deze pagina al (wordt vervangen)")}</small> : null}</span>
                      </button>
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

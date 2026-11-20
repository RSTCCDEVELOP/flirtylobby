// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { markPlan, startWizardLoading } from "../lib/planFlag";
import { tx } from "../lib/t";
import { IconCheck } from "./Icons";

// The onboarding is not finished until its last step (the design wizard) was started. After every login it goes on where it was left (every step looks at what is really there).
// When it is still not finished one hour later, a superadmin is asked to go on: "Verder" opens the first screen that is still to do, "Later" asks again in an hour.
const HOUR = 60 * 60 * 1000;
const LAST = "e2e_onb_last";
const autoDone = {}; // what was opened by itself since this page was loaded: each step once; a reload (or the Verder button) lets it come again
const SESSION_KEYS = ["default-install-later", "e2e_setup_skipped"]; // the "later" of the screens of this login: cleared so they come again

export default function OnboardingNag({ user }) {
  const [st, setSt] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!user?.is_staff) return undefined;
    let alive = true;
    const read = () => api("/system/onboarding/").then((s) => { if (alive) setSt(s); }).catch(() => {});
    const events = ["setup-saved", "presets-changed", "entity-changed", "focus"];
    events.forEach((e) => window.addEventListener(e, read)); // the banner follows what was just done
    const quick = setInterval(read, 15 * 1000);
    try { if (!sessionStorage.getItem(LAST)) sessionStorage.setItem(LAST, String(Date.now())); } catch { /* no storage */ }
    read();
    const t = setInterval(() => {
      read();
      let last = Date.now();
      try { last = Number(sessionStorage.getItem(LAST)) || Date.now(); } catch { /* no storage */ }
      if (Date.now() - last >= HOUR) setOpen(true);
    }, 60 * 1000);
    return () => { alive = false; clearInterval(t); clearInterval(quick); events.forEach((e) => window.removeEventListener(e, read)); };
  }, [user?.is_staff]);
  // Where the onboarding stands decides what comes next, whatever the other screens did (the installation that was chosen in the set-up form, for instance, skips the installation screen that used to lead on):
  // next = the AI credit explanation: it opens; next = the design wizard: Website ontwerpen opens with its wizard. Once per visit each.
  useEffect(() => {
    if (!st || st.complete || !user?.is_staff) return undefined;
    const once = (k) => { if (autoDone[k]) return false; autoDone[k] = true; return true; };
    const t = setTimeout(() => {
      if (st.next === "ai" && once("ai")) window.dispatchEvent(new Event("open-ai-welcome"));
      else if (st.next === "design" && once("design")) {
        markPlan();
        if (!window.location.pathname.startsWith("/dashboard/admin/siteimport")) { startWizardLoading(); window.location.href = "/dashboard/admin/siteimport"; }
        else if (!document.querySelector(`[aria-label="${tx("Wizard")}"]`)) { startWizardLoading(); window.location.reload(); }  // already there with the wizard open (the usual way here): no second load
      }
    }, 2500); // (a moment for the screens that are open to finish)
    return () => clearTimeout(t);
  }, [st, user?.is_staff]);
  const later = () => { try { sessionStorage.setItem(LAST, String(Date.now())); } catch { /* no storage */ } setOpen(false); };
  // "Verder met onboarding": goes straight to the next step that is still to do (it used to only load the same page again, so nothing seemed to happen)
  const goOn = () => {
    const next = st?.next || "";
    try {
      SESSION_KEYS.forEach((k) => sessionStorage.removeItem(k));
      Object.keys(autoDone).forEach((k) => delete autoDone[k]);
      Object.keys(sessionStorage).filter((k) => k.startsWith("licprompt:")).forEach((k) => sessionStorage.removeItem(k));
      sessionStorage.setItem(LAST, String(Date.now()));
    } catch { /* no storage */ }
    setOpen(false);
    if (next === "ai") { window.dispatchEvent(new Event("open-ai-welcome")); return; }
    if (next === "design") { markPlan(); startWizardLoading(); window.location.href = "/dashboard/admin/siteimport"; return; }
    if (next === "licence") { window.dispatchEvent(new Event("open-setup-wizard")); return; }
    window.location.reload(); // welcome, terms, manual, installation: the screens look at what is there and come again
  };
  if (!st || st.complete) return null;
  const banner = (  // always there while the onboarding is not finished (also after "Later" on a screen): where it stands and a way to go on
    <div className="alert" role="status" style={{ display: "flex", gap: ".8rem", alignItems: "center", flexWrap: "wrap", margin: "0 0 1rem" }}>
      <span style={{ flex: 1, minWidth: 220 }}><strong>{tx("Onboarding niet afgerond")}</strong>{" · "}{tx("Volgende stap: {0}", tx(st.next_label))}</span>
      <button type="button" className="btn sm primary" onClick={goOn}>{tx("Verder met onboarding")}</button>
    </div>
  );
  if (!open) return banner;
  return (
    <><div className="overlay" role="dialog" aria-modal="true" aria-label={tx("Onboarding afronden")} onClick={later}>
      <div className="card modal" style={{ maxWidth: 480, display: "grid", gap: ".8rem" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0 }}>{tx("De onboarding is nog niet afgerond")}</h2>
        <p style={{ margin: 0 }}>{tx("Ga verder met de onboarding: elke stap die al klaar is hoef je niet opnieuw te doen.")}</p>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: ".3rem" }}>
          {st.steps.map((s) => (
            <li key={s.key} style={{ display: "flex", alignItems: "center", gap: ".5rem", opacity: s.done ? 0.6 : 1, fontWeight: s.key === st.next ? 700 : 400 }}>
              <span style={{ width: 16, height: 16, display: "inline-flex" }}>{s.done ? <IconCheck width={16} height={16} /> : <span style={{ width: 12, height: 12, border: "2px solid currentColor", borderRadius: "50%", margin: 2 }} />}</span>
              {tx(s.label)}
            </li>
          ))}
        </ul>
        <div className="row" style={{ justifyContent: "flex-end", gap: ".5rem" }}>
          <button type="button" className="btn" onClick={later}>{tx("Over een uur opnieuw")}</button>
          <button type="button" className="btn primary" onClick={goOn}>{tx("Verder met onboarding")}</button>
        </div>
      </div>
    </div></>
  );
}
// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { canAdmin } from "../lib/perms";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { useModules } from "./Modules";
import { useSession } from "./Session";
import { setLicenseOpen, useSandboxFirst } from "../lib/firstRun";
import { PHASE_NOW, PHASE_NEXT } from "../lib/licencePhase";

// Every time an administrator logs in and the website has no licence: ask to arrange it now (the payment page, or contact the reseller).
const keyOf = () => `licprompt:${(localStorage.getItem("token") || "").slice(-10)}`;

export default function LicensePrompt({ site }) {
  const dash = useAuth(), site_ = useSession(); // in the dashboard the AuthContext knows the person, on the website the Session
  const user = dash?.user ?? site_?.user ?? null, ready = site_?.ready ?? true;
  const mods = useModules();
  const [lic, setLic] = useState(null);
  const { welcomeOpen } = useSandboxFirst(false);  // the very first question (language, light or dark) comes before this one
  const admin = !!user && (user.is_staff || canAdmin(user, mods));
  useEffect(() => {
    const ph = site?.license_phase?.phase || 0;  // a licence that has ended: every login the administrator is told where it stands, with a button to update it
    if (!ready || !admin || !(site?.license_missing || ph > 0)) return undefined;
    try { if (sessionStorage.getItem(keyOf())) return undefined; } catch { return undefined; }
    setLicenseOpen(true); // the other questions wait for this one, from the first moment
    if (ph > 0) { setLic({ ended: site.license_phase }); return () => setLicenseOpen(false); }
    api("/system/license/status/").then((s) => { if (!s.has) setLic(s); else setLicenseOpen(false); }).catch(() => setLicenseOpen(false));
    return () => setLicenseOpen(false);
  }, [ready, admin, site?.license_missing, site?.license_phase?.phase]);
  const dismiss = () => { try { sessionStorage.setItem(keyOf(), "1"); } catch {} setLic(null); setLicenseOpen(false); }; // asked once per login
  // "Licentie regelen" starts the set-up wizard (basic data, costs and the licence); on a page outside the dashboard it is opened there
  const arrange = () => {
    dismiss();
    try { sessionStorage.setItem("e2e_open_setup", "1"); } catch { /* no storage */ }
    if (window.location.pathname.startsWith("/dashboard")) { try { sessionStorage.removeItem("e2e_open_setup"); } catch { /* no storage */ } window.dispatchEvent(new Event("open-setup-wizard")); } else window.location.assign("/dashboard");
  };
  if (!lic || welcomeOpen) return null;
  const r = lic.reseller || {};
  if (lic.ended) {
    const ph = lic.ended;
    return (
      <div className="overlay" onClick={dismiss}>
        <div className="card modal" role="dialog" aria-label={tx("Licentie niet actief")} onClick={(e) => e.stopPropagation()} style={{ display: "grid", gap: ".8rem", maxWidth: 500 }}>
          <h2 style={{ margin: 0 }}>{tx("De licentie is niet actief: verlopen")}</h2>
          <p style={{ margin: 0 }}>{tx("De licentie is {0} dagen geleden verlopen.", ph.days_over)} {tx(PHASE_NOW[ph.phase])}</p>
          {PHASE_NEXT[ph.phase] && ph.days_left != null && <p className="muted" style={{ margin: 0 }}>{tx("Over {0} dagen:", ph.days_left)} {tx(PHASE_NEXT[ph.phase])}.</p>}
          <div className="row" style={{ flexWrap: "nowrap", gap: ".5rem", justifyContent: "flex-end" }}>
            {ph.phase < 3 && <button type="button" className="btn" onClick={dismiss}>{tx("Later")}</button>}
            <Link className="btn primary" href="/dashboard/license" onClick={dismiss}>{tx("Licentie bijwerken")}</Link>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="overlay" onClick={dismiss}>
      <div className="card modal" role="dialog" aria-label={tx("Geen licentie")} onClick={(e) => e.stopPropagation()} style={{ display: "grid", gap: ".8rem", maxWidth: 480 }}>
        <h2 style={{ margin: 0 }}>{tx("Er is geen licentie ingesteld")}</h2>
        <p className="muted" style={{ margin: 0 }}>{tx("De website werkt ook zonder licentie, maar onderaan elke pagina staat dan dat er geen licentie in gebruik is. Regel je licentie nu.")}</p>
        {r.name && <p style={{ margin: 0 }}>{tx("Reseller")}: <strong>{r.name}</strong></p>}
        <div className="row" style={{ flexWrap: "nowrap", gap: ".5rem", justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={dismiss}>{tx("Later")}</button>
          {(r.email || r.url) && (r.url ? <a className="btn" href={r.url} target="_blank" rel="noopener noreferrer">{tx("Contact met reseller")}</a> : <a className="btn" href={`mailto:${r.email}`}>{tx("Contact met reseller")}</a>)}
          <button type="button" className="btn primary" onClick={arrange}>{tx("Licentie regelen")}</button>
        </div>
      </div>
    </div>
  );
}

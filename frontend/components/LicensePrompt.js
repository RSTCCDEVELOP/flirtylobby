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
import { setLicenseOpen } from "../lib/firstRun";

// Every time an administrator logs in and the website has no licence: ask to arrange it now (the payment page, or contact the reseller).
const keyOf = () => `licprompt:${(localStorage.getItem("token") || "").slice(-10)}`;

export default function LicensePrompt({ site }) {
  const dash = useAuth(), site_ = useSession(); // in the dashboard the AuthContext knows the person, on the website the Session
  const user = dash?.user ?? site_?.user ?? null, ready = site_?.ready ?? true;
  const mods = useModules();
  const [lic, setLic] = useState(null);
  const admin = !!user && (user.is_staff || canAdmin(user, mods));
  useEffect(() => {
    if (!ready || !admin || !site?.license_missing) return undefined;
    try { if (sessionStorage.getItem(keyOf())) return undefined; } catch { return undefined; }
    setLicenseOpen(true); // the other questions wait for this one, from the first moment
    api("/system/license/status/").then((s) => { if (!s.has) setLic(s); else setLicenseOpen(false); }).catch(() => setLicenseOpen(false));
    return () => setLicenseOpen(false);
  }, [ready, admin, site?.license_missing]);
  const dismiss = () => { try { sessionStorage.setItem(keyOf(), "1"); } catch {} setLic(null); setLicenseOpen(false); }; // asked once per login
  if (!lic) return null;
  const r = lic.reseller || {};
  return (
    <div className="overlay" onClick={dismiss}>
      <div className="card modal" role="dialog" aria-label={tx("Geen licentie")} onClick={(e) => e.stopPropagation()} style={{ display: "grid", gap: ".8rem", maxWidth: 480 }}>
        <h2 style={{ margin: 0 }}>{tx("Er is geen licentie ingesteld")}</h2>
        <p className="muted" style={{ margin: 0 }}>{tx("De website werkt ook zonder licentie, maar onderaan elke pagina staat dan dat er geen licentie in gebruik is. Regel je licentie nu.")}</p>
        {r.name && <p style={{ margin: 0 }}>{tx("Reseller")}: <strong>{r.name}</strong></p>}
        <div className="row" style={{ flexWrap: "nowrap", gap: ".5rem", justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={dismiss}>{tx("Later")}</button>
          {(r.email || r.url) && (r.url ? <a className="btn" href={r.url} target="_blank" rel="noopener noreferrer">{tx("Contact met reseller")}</a> : <a className="btn" href={`mailto:${r.email}`}>{tx("Contact met reseller")}</a>)}
          <Link className="btn primary" href="/dashboard/license" onClick={dismiss}>{tx("Licentie regelen")}</Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { tx } from "../lib/t";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api, clearToken } from "../lib/api";
import { canAdmin } from "../lib/perms";
import { useModules } from "./Modules";
import { useSession } from "./Session";
import Link from "next/link";
import MaintenanceNotice from "./MaintenanceNotice";

// Maintenance mode (Basisgegevens): visitors get the maintenance page (the server sends them to /onderhoud); a member who is still logged in is logged out and sees the notice too.
// Only the login page stays open, and administrators (superadmins and people with edit rights) keep working, with a thin bar to remind them.
export default function MaintenanceGate({ site }) {
  const { user, ready } = useSession();
  const mods = useModules();
  const path = usePathname() || "/";
  const [loginPaths, setLoginPaths] = useState(["/login"]); // the login page has an address per language (/log-in, /anmelden ...)
  useEffect(() => { if (site?.maintenance) api("/pages/aliases/").then((d) => setLoginPaths(["/login", ...Object.entries(d.aliases || {}).filter(([, v]) => v === "/login").map(([k]) => k)])).catch(() => {}); }, [site?.maintenance]);
  const onLogin = loginPaths.some((p) => path === p || path.startsWith(p + "/"));
  const admin = !!user && (user.is_staff || canAdmin(user, mods));
  const blocked = !!site?.maintenance && !admin && !onLogin && !path.startsWith("/onderhoud");
  useEffect(() => { if (site?.maintenance && ready && user && !admin) clearToken(); }, [site?.maintenance, ready, user, admin]);
  // administrators see the real website: the server cannot see the login, so a cookie tells it (only the page; the data stays protected by the API)
  useEffect(() => {
    if (!ready) return;
    const has = document.cookie.includes("maint_ok=1");
    if (site?.maintenance && admin) {
      if (!has) { document.cookie = "maint_ok=1; path=/; max-age=43200; SameSite=Lax"; if (!path.startsWith("/onderhoud")) window.location.reload(); }
    } else if (has) document.cookie = "maint_ok=; path=/; max-age=0; SameSite=Lax";
  }, [site?.maintenance, ready, admin, path]);
  if (site?.license_expired && admin && !onLogin) return <div className="maintenance-bar">{tx("De licentie is verlopen: bezoekers zien de onderhoudspagina.")} <Link href="/dashboard/license">{tx("Licentie verlengen")}</Link></div>;
  if (site?.maintenance && admin && !onLogin) return <div className="maintenance-bar">{tx("Onderhoudsmodus staat aan: bezoekers zien de onderhoudspagina.")}</div>;
  if (!blocked) return null;
  return (
    <div className="maintenance" role="alert">
      <MaintenanceNotice site={site} />
    </div>
  );
}

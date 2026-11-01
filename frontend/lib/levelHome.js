// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { api } from "./api";

// After logging in: on a new installation (or after a reset: the server has a new "epoch" that this browser has not seen yet) everybody goes to the dashboard of their own level:
// a superadmin to Super admin, an admin (edit rights somewhere) to Admin, everybody else to the dashboard. Otherwise the usual /dashboard.
export async function homeAfterLogin() {
  try {
    const st = await api("/sandbox/status/");
    const epoch = String(st?.epoch || "");
    const seen = localStorage.getItem("ui-epoch");
    if (!epoch || seen === epoch) return "/dashboard";
    const me = await api("/auth/me/");
    const u = me?.user || me;
    if (u?.is_staff) return "/dashboard/superadmin";
    if (Object.values(u?.module_levels || {}).some((v) => v >= 2)) return "/dashboard/admin";
  } catch {}
  return "/dashboard";
}

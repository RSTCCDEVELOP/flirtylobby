// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "../lib/api";
import { useModule } from "./Modules";
import { useSession } from "./Session";

// Paths that stay open while the website needs a subscription (so people can log in, subscribe and read the rules).
const OPEN = ["/login", "/registreren", "/uitnodiging", "/abonnementen", "/dashboard/subscriptions", "/privacy", "/cookies", "/bestelling", "/sandbox", "/geo-blocked", "/404", "/doneren", "/direct", "/directconnect"];

// "Toegang tot de website" (Admin -> Abonnementen -> Instellingen): without a subscription people only reach the open paths above.
export default function SiteGate() {
  const subsOn = useModule("subscriptions");
  const donOn = useModule("donations");
  const on = subsOn || donOn;
  const { user, ready } = useSession();
  const path = usePathname() || "/";
  const router = useRouter();
  useEffect(() => {
    if (!on || !ready || OPEN.some((p) => path === p || path.startsWith(p + "/"))) return;
    if (user?.is_staff) return;
    let alive = true;
    (user ? api("/subscriptions/me/").then((m) => m.site_locked) : api("/subscriptions/plans/").then((p) => p.site_gate))
      .then((locked) => { if (alive && locked) router.replace(user ? "/abonnementen?locked=1" : "/login?next=/abonnementen"); })
      .catch(() => {});
    return () => { alive = false; };
  }, [on, ready, user, path, router]);
  return null;
}

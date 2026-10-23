// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "./Session";

// A closed website (an intranet, Beveiliging -> Algemeen): without logging in only the login screens are open; everything else leads to the login page.
// The server answers nothing else either (ClosedSiteMiddleware), this only takes the visitor to the right place and keeps the page covered meanwhile.
const OPEN = ["/login", "/uitnodiging", "/geo-blocked", "/404", "/sandbox"];

export default function ClosedGate({ closed }) {
  const { user, ready } = useSession();
  const path = usePathname() || "/";
  const router = useRouter();
  const open = OPEN.some((p) => path === p || path.startsWith(p + "/"));
  const blocked = !!closed && !user && !open;
  useEffect(() => { if (blocked && ready) router.replace("/login"); }, [blocked, ready, router]);
  return blocked ? <div style={{ position: "fixed", inset: 0, zIndex: 5000, background: "var(--bg, #0b1120)" }} aria-hidden="true" /> : null;
}

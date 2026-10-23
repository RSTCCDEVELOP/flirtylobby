// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { usePathname } from "next/navigation";
import BackButton from "./BackButton";

// A "back" button on every page of the website (not on the home page): to the page the visitor came from, else to the home page.
// (The dashboard has its own, in its menu bar.)
export default function SiteBack() {
  const pathname = usePathname();
  if (!pathname || pathname === "/" || pathname.startsWith("/dashboard")) return null;
  return <div className="site-back"><BackButton pathname={pathname} fallback="/" /></div>;
}

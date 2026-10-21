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

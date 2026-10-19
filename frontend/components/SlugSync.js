"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { getLanguage } from "../lib/t";

// A page has an address in every language (/subscriptions, /abos, /abonnementen ...). When the language changes, the address follows.
export default function SlugSync() {
  const pathname = usePathname();
  const router = useRouter();
  const map = useRef(null);
  useEffect(() => {
    let alive = true;
    const go = async () => {
      if (!map.current) { try { map.current = await api("/pages/aliases/"); } catch { return; } }
      if (!alive || !map.current) return;
      const here = pathname.replace(/\/+$/, "") || "/";
      const hit = Object.values(map.current.pages || {}).find((p) => p.canonical === here || Object.values(p.urls || {}).includes(here));
      const want = hit?.urls?.[getLanguage()];
      if (want && want !== here) router.replace(`${want}${window.location.search}`);
    };
    go();
    const on = () => go();
    window.addEventListener("langchange", on);
    return () => { alive = false; window.removeEventListener("langchange", on); };
  }, [pathname, router]);
  return null;
}

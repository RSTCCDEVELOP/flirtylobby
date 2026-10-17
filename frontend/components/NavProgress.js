"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

// Instant feedback on a click on an internal link: a thin bar at the top until the next page is there.
// (The next page may still be loading its data; without this it looks as if nothing happened and people click again.)
function Bar() {
  const path = usePathname();
  const search = useSearchParams();
  const [on, setOn] = useState(false);
  useEffect(() => setOn(false), [path, search]);
  useEffect(() => {
    const click = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const u = new URL(a.href, window.location.href);
      if (u.origin !== window.location.origin || (u.pathname === window.location.pathname && u.search === window.location.search)) return;
      setOn(true);
    };
    document.addEventListener("click", click, true);
    const stop = setTimeout(() => {}, 0);
    return () => { document.removeEventListener("click", click, true); clearTimeout(stop); };
  }, []);
  useEffect(() => { if (!on) return; const t = setTimeout(() => setOn(false), 15000); return () => clearTimeout(t); }, [on]);
  return on ? <div className="nav-progress" role="progressbar" aria-label="Laden"><i /></div> : null;
}

export default function NavProgress() {
  return <Suspense fallback={null}><Bar /></Suspense>;
}

// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { tx } from "../lib/t";
import { IconHelp, IconX } from "./Icons";
import FaqPage from "./FaqPage";
import { useModules } from "./Modules";
import { useSession } from "./Session";
import { useFaqSettings } from "../lib/faq-settings";
import UserFaq from "./UserFaq";

// The FAQ icon in the header: opens the FAQ in a panel at the side and keeps you on the page you are on.
// On the website it shows the FAQ of the site; in the dashboard the help of Easy2edit for the part you are in (user, admin or super admin).
// Switched on or off at Admin → FAQ → Instellingen (on by default).
export default function FaqDrawer({ dashboard = false }) {
  const fs = useFaqSettings();
  const mods = useModules();
  const { user } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => { if (!open) return undefined; const k = (e) => { if (e.key === "Escape") setOpen(false); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [open]);
  const on = fs.header_icon !== false && (dashboard ? mods.help !== false : mods.faq !== false);
  if (!on || (dashboard && !user)) return null;
  const layer = pathname.startsWith("/dashboard/superadmin") ? "super" : pathname.startsWith("/dashboard/admin") ? "admin" : "user";
  return (
    <>
      <button type="button" className="icon-btn faq-icon" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={tx("FAQ")} title={tx("FAQ")}><IconHelp /></button>
      {open && <div className="faq-backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <aside className="faq-drawer" role="dialog" aria-label={tx("FAQ")}>
          <button type="button" className="icon-btn faq-drawer-x" onClick={() => setOpen(false)} aria-label={tx("Sluiten")}><IconX /></button>
          {dashboard ? <FaqPage layer={layer} withTitle={false} single /> : <UserFaq />}
        </aside>
      )}
    </>
  );
}

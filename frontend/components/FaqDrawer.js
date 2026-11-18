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
import { IconHelp, IconInfo, IconX } from "./Icons";
import FaqPage from "./FaqPage";
import { useModules } from "./Modules";
import { useSession } from "./Session";
import { useFaqSettings } from "../lib/faq-settings";
import UserFaq from "./UserFaq";

// The FAQ icon in the header: opens the FAQ in a panel at the side and keeps you on the page you are on.
// On the website it shows the FAQ of the site; in the dashboard the help of easy2edit for the part you are in (user, admin or super admin).
// Switched on or off at Admin → FAQ → Instellingen (on by default).
export default function FaqDrawer({ dashboard = false }) {
  const fs = useFaqSettings();
  const mods = useModules();
  const { user } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);  // in the dashboard the "?" gives two choices: Help site menu (the help of easy2edit) and Item help (point at a tile or button for an explanation)
  const [itemOn, setItemOn] = useState(false);
  useEffect(() => { const f = (e) => setItemOn(!!e.detail); window.addEventListener("item-help-state", f); return () => window.removeEventListener("item-help-state", f); }, []);
  useEffect(() => { if (!menu) return undefined; const away = (e) => { if (!e.target.closest?.(".faq-menu-wrap")) setMenu(false); }; const k = (e) => { if (e.key === "Escape") setMenu(false); }; document.addEventListener("mousedown", away); document.addEventListener("keydown", k); return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", k); }; }, [menu]);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => { if (!open) return undefined; const k = (e) => { if (e.key === "Escape") setOpen(false); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [open]);
  const on = fs.header_icon !== false && (dashboard ? mods.help !== false : mods.faq !== false);
  if (!on || (dashboard && !user)) return null;
  const layer = pathname.startsWith("/dashboard/superadmin") ? "super" : pathname.startsWith("/dashboard/admin") ? "admin" : "user";
  return (
    <>
      {dashboard ? (
        <span className="faq-menu-wrap" style={{ position: "relative", display: "inline-flex" }}>
          <button type="button" className="icon-btn faq-icon" onClick={() => (itemOn ? window.dispatchEvent(new Event("item-help")) : setMenu(!menu))} aria-expanded={menu} aria-haspopup="menu" aria-label={tx("Help")} title={itemOn ? tx("Item help uitzetten") : tx("Help")}><IconHelp /></button>
          {menu && (
            <div className="faq-menu" role="menu">
              <button type="button" role="menuitem" className="faq-menu-item" onClick={() => { setMenu(false); setOpen(true); }}><span className="faq-menu-ico"><IconHelp /></span><span><strong>{tx("Help site menu")}</strong><small>{tx("De uitleg van easy2edit voor dit deel")}</small></span></button>
              <button type="button" role="menuitem" className="faq-menu-item" onClick={() => { setMenu(false); window.dispatchEvent(new Event("item-help")); }}><span className="faq-menu-ico"><IconInfo /></span><span><strong>{tx("Item help")}</strong><small>{tx("Wijs een tegel, menu-onderdeel of knop aan voor uitleg")}</small></span></button>
            </div>
          )}
        </span>
      ) : <button type="button" className="icon-btn faq-icon" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={tx("FAQ")} title={tx("FAQ")}><IconHelp /></button>}
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

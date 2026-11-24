// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { tx } from "../lib/t";
import { Logo } from "./BrandingContext";
import { MenuView, useMenu } from "./SiteMenu";
import { useSession } from "./Session";

// The side menu: when the theme value header_side is left or right and the visitor has scrolled the set amount (StickyHeader.js sets data-hsidenow on <html>), the header goes and this menu takes its
// place at the side: the logo and the same menu as a list, with an arrow at the edge that opens and closes it (the choice is remembered). Not shown while the page is edited, except as a preview while the tab Zijmenu of the header panel is open (data-hsidepreview).
const KEY = "sideMenuOpen";
export default function SideMenu() {
  const { items, settings: cfg } = useMenu();
  const { user } = useSession();
  const pathname = usePathname();
  const [state, setState] = useState({ side: "off", on: false, preview: false });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setOpen(sessionStorage.getItem(KEY) === "1"); } catch { /* ok */ }
    const root = document.documentElement;
    const read = () => setState({ side: root.dataset.hside || "off", on: root.dataset.hsidenow === "1", preview: root.dataset.hsidepreview === "1" });
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ["data-hside", "data-hsidenow", "data-hsidepreview"] });
    return () => mo.disconnect();
  }, []);
  const toggle = () => setOpen((o) => { const n = !o; try { sessionStorage.setItem(KEY, n ? "1" : "0"); } catch { /* ok */ } return n; });
  useEffect(() => { if (state.preview) setOpen(true); }, [state.preview]);  // the preview in the editor starts open
  if (state.side === "off" || !(state.on || state.preview)) return null;
  const forms = { desktop: "bar", tablet: "bar", mobile: "bar" }, sub = { desktop: "accordion", tablet: "accordion", mobile: "accordion" };  // the menu as a list with folding sub menus
  const right = state.side === "right";
  return (
    <aside className={`side-menu ${right ? "right" : "left"}${open ? " open" : ""}`} aria-label={tx("Zijmenu")}>
      <div className="side-card">
      <button type="button" className="side-arrow" aria-expanded={open} aria-label={open ? tx("Menu sluiten") : tx("Menu openen")} title={open ? tx("Menu sluiten") : tx("Menu openen")} onClick={toggle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: (right ? !open : open) ? "rotate(180deg)" : "none", transition: "transform .25s" }}><path d="M9 6l6 6-6 6" /></svg>
      </button>
      <div className="side-in">
        <Link href="/" className="brand side-brand"><Logo header /></Link>
        <MenuView items={items} cfg={{ ...cfg, forms, sub }} device="desktop" pathname={pathname} user={user} />
      </div>
      </div>
    </aside>
  );
}

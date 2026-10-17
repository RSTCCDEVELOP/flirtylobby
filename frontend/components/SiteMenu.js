"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { tx } from "../lib/t";
import { IconMenu, IconX } from "./Icons";
import { getLanguage } from "../lib/t";
import { useSession } from "./Session";

const MenuContext = createContext([]);
export const MenuProvider = ({ value, children }) => <MenuContext.Provider value={value || []}>{children}</MenuContext.Provider>;

// The label of a menu item in the visitor's language (fallback: Dutch, then any)
export const menuLabel = (titles = {}) => titles[getLanguage()] || titles.nl || titles.en || Object.values(titles)[0] || "";

function Item({ it, pathname, onLink }) {
  const target = it.new_tab ? { target: "_blank", rel: "noopener noreferrer" } : {};
  const external = /^(https?:|mailto:|tel:)/.test(it.url);
  const active = it.url === "/" ? pathname === "/" : !external && pathname.startsWith(it.url);
  const label = menuLabel(it.titles);
  const link = external ? <a href={it.url} className={active ? "active" : ""} {...target}>{label}</a> : <Link href={it.url} className={active ? "active" : ""} {...target}>{label}</Link>;
  if (!it.children?.length) return link;
  return (
    <span className="nav-drop">
      {link}
      <span className="nav-drop-menu">
        {it.children.map((c) => <Item key={c.id} it={{ ...c, children: [] }} pathname={pathname} />)}
      </span>
    </span>
  );
}

// Header menu of the website. Items come from Admin -> Pagina's (menu editor); only pages that are on are included.
export default function SiteMenu() {
  const items = useContext(MenuContext);
  const { user } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // small screens: the menu is a dropdown behind a button
  useEffect(() => setOpen(false), [pathname]);
  const show = (i) => i.audience === "all" || (i.audience === "members" && user) || (i.audience === "guests" && !user);
  const list = items.filter(show);
  if (!list.length) return null;
  return (
    <>
      <button type="button" className="icon-btn nav-toggle" aria-expanded={open} aria-label={open ? tx("Menu sluiten") : tx("Menu openen")} onClick={() => setOpen(!open)}>{open ? <IconX /> : <IconMenu />}</button>
      <nav className={`site-nav ${open ? "open" : ""}`}>
        {list.map((it) => <Item key={it.id} it={{ ...it, children: it.children.filter(show) }} pathname={pathname} />)}
      </nav>
    </>
  );
}

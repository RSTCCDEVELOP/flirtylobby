// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { tx } from "../lib/t";
import { IconMenu, IconX } from "./Icons";
import { getLanguage } from "../lib/t";
import { useSession } from "./Session";

// What the site needs for the header menu: the items (Admin -> Pagina's) and the look of the menu per device (Admin -> Pagina's -> Menu -> Instellingen)
export const DEFAULT_MENU = {
  breakpoints: { tablet: 1024, mobile: 700 },
  forms: { desktop: "bar", tablet: "bar", mobile: "hamburger" },
  align: { desktop: "left", tablet: "left", mobile: "left" }, toggle_pos: { desktop: "right", tablet: "right", mobile: "right" },
  sub: { desktop: "dropdown", tablet: "dropdown", mobile: "accordion" },
  open_on: { desktop: "hover", tablet: "click", mobile: "click" },
  item_style: "theme", size: "md", uppercase: false, arrows: true, overlay: true, close_on_click: true, sticky_bottom: true,
  height: { desktop: 0, tablet: 0, mobile: 0 }, bg: "", bg_opacity: 0.88, blur: 10, float: "none", float_after: 80,
};
const MenuContext = createContext({ items: [], settings: DEFAULT_MENU });
export const MenuProvider = ({ value, children }) => {
  const v = Array.isArray(value) ? { items: value, settings: null } : value || { items: [], settings: null };
  return <MenuContext.Provider value={{ items: v.items || [], settings: { ...DEFAULT_MENU, ...(v.settings || {}) } }}>{children}</MenuContext.Provider>;
};
export const useMenu = () => useContext(MenuContext);

// The label of a menu item in the visitor's language (fallback: Dutch, then any)
export const menuLabel = (titles = {}) => titles[getLanguage()] || titles.nl || titles.en || Object.values(titles)[0] || "";

// computer, tablet or phone: from the width of the window and the break points of the menu settings
export function useDevice(bp = DEFAULT_MENU.breakpoints) {
  const [dev, setDev] = useState(null);
  useEffect(() => {
    const pick = () => { const w = window.innerWidth; setDev(w <= bp.mobile ? "mobile" : w <= bp.tablet ? "tablet" : "desktop"); };
    pick();
    window.addEventListener("resize", pick);
    return () => window.removeEventListener("resize", pick);
  }, [bp.mobile, bp.tablet]);
  return dev;
}

const urlOf = (it) => (it.urls?.[getLanguage()] || it.url || "");

function Leaf({ it, pathname, onNavigate, cls = "", preview = false, top = false }) {
  const target = it.new_tab ? { target: "_blank", rel: "noopener noreferrer" } : {};
  const url = urlOf(it);
  const external = /^(https?:|mailto:|tel:)/.test(url);
  const active = url === "/" ? pathname === "/" : !!url && !external && (pathname.startsWith(url) || pathname.startsWith(it.url) || Object.values(it.urls || {}).some((u) => u !== "/" && pathname.startsWith(u)));
  const c = `${active ? "active " : ""}${it.cta ? "cta " : ""}${cls}`.trim();
  const label = menuLabel(it.titles);
  if (preview) return <a href="#" className={c} data-mid={it.id} data-top={top ? "1" : "0"} draggable={!!preview.draggable} onClick={(e) => e.preventDefault()}>{label}</a>;
  return external ? <a href={url} className={c} onClick={onNavigate} {...target}>{label}</a> : <Link href={url || "#"} className={c} onClick={onNavigate} {...target}>{label}</Link>;
}

function Item({ it, ctx }) {
  const { pathname, form, sub, openOn, arrows, onNavigate, openId, setOpenId, preview } = ctx;
  const kids = it.children || [];
  const isText = it.kind === "menu" && !it.label_link;
  if (!kids.length && !isText) return <Leaf it={it} pathname={pathname} onNavigate={onNavigate} preview={preview} top />;
  if (!kids.length) return <span className="hm-label" data-mid={preview ? it.id : undefined} data-top="1" draggable={preview ? !!preview.draggable : undefined}>{menuLabel(it.titles)}</span>;
  const accordion = sub === "accordion" || form !== "bar";
  const isOpen = openId === it.id;
  const toggle = (e) => { e.preventDefault(); setOpenId(isOpen ? null : it.id); };
  const label = isText ? <span className="hm-label" data-mid={preview ? it.id : undefined} data-top="1" draggable={preview ? !!preview.draggable : undefined} tabIndex={0} role="button" aria-expanded={isOpen} onClick={toggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggle(e); }}>{menuLabel(it.titles)}{arrows && <i className="hm-arrow" aria-hidden="true" />}</span> : (
    <span className="hm-split"><Leaf it={it} pathname={pathname} onNavigate={onNavigate} preview={preview} top />{arrows && <button type="button" className="hm-arrow-btn" aria-label={tx("Submenu")} aria-expanded={isOpen} onClick={toggle}><i className="hm-arrow" aria-hidden="true" /></button>}</span>
  );
  return (
    <span className={`hm-drop${isOpen ? " open" : ""}${accordion ? " acc" : ""} ${openOn === "hover" && !accordion ? "on-hover" : ""}`}>
      {label}
      <span className={`hm-sub ${sub === "mega" && !accordion ? "mega" : ""}`}>{kids.map((c) => <Leaf key={c.id} it={c} pathname={pathname} onNavigate={onNavigate} preview={preview} />)}</span>
    </span>
  );
}

// The menu itself, for one device: used by the site and by the preview in the admin (which also asks for it to be open, so items can be dragged)
export function MenuView({ items, cfg, device, pathname = "", user = null, preview = null }) {
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState(null);
  const dev = device || "desktop";
  const form = cfg.forms[dev], sub = cfg.sub[dev], openOn = cfg.open_on[dev], align = cfg.align[dev];
  useEffect(() => { setOpen(false); setOpenId(null); }, [pathname, device]);
  useEffect(() => { // click outside closes an open sub menu
    if (!openId) return undefined;
    const on = (e) => { if (!e.target.closest?.(".hm-drop")) setOpenId(null); };
    document.addEventListener("click", on);
    return () => document.removeEventListener("click", on);
  }, [openId]);
  const show = (i) => (preview || i.audience === "all" || (i.audience === "members" && user) || (i.audience === "guests" && !user)) && (i.devices?.[dev] !== false);
  const list = items.filter(show).map((i) => ({ ...i, children: (i.children || []).filter(show) }));
  if (!list.length) return preview ? <span className="muted">{tx("Het menu is leeg.")}</span> : null;
  const ctx = { pathname, form, sub, openOn, arrows: cfg.arrows, openId, setOpenId, preview, onNavigate: () => { if (cfg.close_on_click) { setOpen(false); setOpenId(null); } } };
  const cls = `hmenu f-${form} s-${cfg.item_style} z-${cfg.size} a-${align}${cfg.uppercase ? " upper" : ""}`;
  const nav = <nav className={cls} aria-label={tx("Hoofdmenu")}>{list.map((it) => <Item key={it.id} it={it} ctx={ctx} />)}</nav>;
  if (form === "bar" || form === "bottom") return nav;
  const isOpen = open; // in the preview too: click the button to open the menu, like a visitor does
  const panelCls = `hmenu-panel p-${form}${isOpen ? " open" : ""}`;
  return (
    <>
      <button type="button" className="icon-btn nav-toggle2" aria-expanded={isOpen} aria-label={isOpen ? tx("Menu sluiten") : tx("Menu openen")} onClick={() => setOpen(!open)}>{isOpen ? <IconX /> : <IconMenu />}</button>
      {open && cfg.overlay && form !== "hamburger" && !preview && <div className="hmenu-backdrop" onClick={() => setOpen(false)} />}
      <div className={panelCls}>
        {(form === "fullscreen" || form.startsWith("drawer")) && <button type="button" className="icon-btn hmenu-close" aria-label={tx("Menu sluiten")} onClick={() => setOpen(false)}><IconX /></button>}
        {nav}
      </div>
    </>
  );
}

// the look of the header: height, colour, see-through and what happens after scrolling (per the settings of the menu)
export const headerCss = (cfg, scope = ".site-header") => {
  const out = [];
  const h = cfg.height || {};
  const bp = cfg.breakpoints;
  if (h.desktop > 0) out.push(`${scope}{height:${h.desktop}px !important}`);
  if (h.tablet > 0) out.push(`@media (max-width:${bp.tablet}px){${scope}{height:${h.tablet}px !important}}`);
  if (h.mobile > 0) out.push(`@media (max-width:${bp.mobile}px){${scope}{height:${h.mobile}px !important}}`);
  const custom = cfg.bg || Math.abs((cfg.bg_opacity ?? 0.88) - 0.88) > 0.001 || (cfg.blur ?? 10) !== 10;
  if (custom) out.push(`${scope}{background:color-mix(in srgb, ${cfg.bg || "var(--card)"} ${Math.round((cfg.bg_opacity ?? 0.88) * 100)}%, transparent) !important;backdrop-filter:blur(${cfg.blur ?? 10}px) !important;-webkit-backdrop-filter:blur(${cfg.blur ?? 10}px) !important}`);
  return out.join("\n");
};

function MenuStyle({ cfg }) {
  const css = useMemo(() => headerCss(cfg), [cfg]);
  useEffect(() => { // after scrolling: a shadow, a floating bar, or the header goes away when scrolling down
    const root = document.documentElement;
    const mode = cfg.float || "none";
    root.setAttribute("data-hm", mode);
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      const scrolled = y > (cfg.float_after || 80);
      if (scrolled) root.setAttribute("data-hm-scrolled", "1"); else root.removeAttribute("data-hm-scrolled");
      if (mode === "hide" && scrolled && y > last + 4) root.setAttribute("data-hm-hidden", "1"); else if (y < last - 4 || !scrolled) root.removeAttribute("data-hm-hidden");
      last = y;
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); ["data-hm", "data-hm-scrolled", "data-hm-hidden"].forEach((a) => root.removeAttribute(a)); };
  }, [cfg.float, cfg.float_after]);
  return css ? <style>{css}</style> : null;
}

// Header menu of the website. Items come from Admin -> Pagina's (menu editor); only pages that are on are included.
// The form (bar, hamburger, side panel, full screen, bottom bar) is chosen per device in the settings of the menu.
export default function SiteMenu() {
  const { items, settings: cfg } = useMenu();
  const { user } = useSession();
  const pathname = usePathname();
  const device = useDevice(cfg.breakpoints);
  const [edHead, setEdHead] = useState(false); // the header layout "editorial": the menu is a button on the left that opens a side menu, on every device
  useEffect(() => {
    const root = document.documentElement, on = () => setEdHead(root.getAttribute("data-hl") === "editorial");
    on();
    const mo = new MutationObserver(on); mo.observe(root, { attributes: true, attributeFilter: ["data-hl"] });
    return () => mo.disconnect();
  }, []);
  const form = edHead ? "drawer-left" : cfg.forms[device || "desktop"];
  useEffect(() => { // the bottom bar needs room at the bottom of the page
    if (form === "bottom") document.documentElement.setAttribute("data-bottomnav", "1"); else document.documentElement.removeAttribute("data-bottomnav");
    return () => document.documentElement.removeAttribute("data-bottomnav");
  }, [form]);
  // A bar that does not fit (window made smaller than the menu needs) turns into the hamburger by itself, and back when there is room again
  const wrapRef = useRef(null);
  const [fitAt, setFitAt] = useState(0); // the window width at which the bar did not fit (0 = it fits)
  useEffect(() => {
    if (form !== "bar") return undefined;
    const check = () => {
      const wrap = wrapRef.current, head = wrap?.closest(".site-header"), nav = wrap?.querySelector(".hmenu.f-bar");
      if (!head || !nav) return;
      const first = nav.firstElementChild;
      const wrapped = first && nav.offsetHeight > first.offsetHeight * 1.6;
      const over = head.scrollWidth > head.clientWidth + 1;
      if (wrapped || over) setFitAt(window.innerWidth);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [form, items, user]);
  useEffect(() => { // wider than where it failed (with some room to spare): try the bar again
    if (!fitAt) return undefined;
    const on = () => { if (window.innerWidth > fitAt + 40) setFitAt(0); };
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [fitAt]);
  const dev = device || "desktop";
  const squeezed = form === "bar" && fitAt > 0 && !!device;
  const useCfg = edHead ? { ...cfg, forms: { desktop: "drawer-left", tablet: "drawer-left", mobile: "drawer-left" }, overlay: true } : squeezed ? { ...cfg, forms: { ...cfg.forms, [dev]: "hamburger" } } : cfg;
  return (
    <div ref={wrapRef} className={`hmenu-wrap tp-${cfg.toggle_pos?.[dev] || "right"}`} style={{ visibility: device ? "visible" : "hidden" }}>
      <MenuStyle cfg={cfg} />
      <MenuView items={items} cfg={useCfg} device={dev} pathname={pathname} user={user} />
    </div>
  );
}

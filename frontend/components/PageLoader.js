"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./BrandingContext";
import { useUi } from "./Ui";

// Page loaders in the style of the theme (colours, rounding and logo come from the theme): the pictures are CSS only
export const LOADER_STYLES = ["ring", "dots", "bar", "pulse", "orbit", "squares", "wave", "skeleton", "logo"];

// the number under the animation: it climbs while the page loads (slower and slower towards 90) and jumps to 100 when the loader ends
export function Percent({ done = false, running = true }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (done) { setN(100); return undefined; }
    if (!running) return undefined;
    setN(0);
    const t = setInterval(() => setN((v) => (v >= 90 ? v : v + Math.max(1, Math.round((90 - v) / 10)))), 120);
    return () => clearInterval(t);
  }, [done, running]);
  return <div className="ld-pct" aria-hidden="true">{n}%</div>;
}

export function LoaderArt({ kind = "ring", size = 56 }) {
  const st = { "--ld": `${size}px` };
  if (kind === "dots") return <span className="ld ld-dots" style={st}><i /><i /><i /></span>;
  if (kind === "bar") return <span className="ld ld-bar" style={st}><i /></span>;
  if (kind === "pulse") return <span className="ld ld-pulse" style={st}><i /><i /></span>;
  if (kind === "orbit") return <span className="ld ld-orbit" style={st}><i /><i /></span>;
  if (kind === "squares") return <span className="ld ld-squares" style={st}>{Array.from({ length: 9 }, (_, n) => <i key={n} style={{ animationDelay: `${(n % 3 + Math.floor(n / 3)) * 0.12}s` }} />)}</span>;
  if (kind === "wave") return <span className="ld ld-wave" style={st}>{[0, 1, 2, 3, 4].map((n) => <i key={n} style={{ animationDelay: `${n * 0.1}s` }} />)}</span>;
  if (kind === "skeleton") return <span className="ld ld-skeleton" style={st}><i className="a" /><i className="b" /><i className="c" /><i className="d" /></span>;
  if (kind === "logo") return <span className="ld ld-logo" style={st}><Logo /></span>;
  return <span className="ld ld-ring" style={st}><i /></span>;
}

// The loader over the page: at the first load, or also between pages. Server-rendered, so it is there before the page is.
export default function PageLoader() {
  const ui = useUi() || {};
  const on = ui.loader_on === "yes";
  const min = Number(ui.loader_min ?? 400);
  const always = ui.loader_when === "always";
  const pathname = usePathname();
  const [show, setShow] = useState(on);
  const loaded = useRef(false); // the first load is done
  const since = useRef(Date.now());
  const timer = useRef(null);
  const hideSoon = () => { clearTimeout(timer.current); timer.current = setTimeout(() => { loaded.current = true; setShow(false); }, Math.max(0, min - (Date.now() - since.current))); };

  // the first load: gone when the page is complete (and it was visible for the minimum time)
  useEffect(() => {
    if (!on) { setShow(false); return undefined; }
    if (loaded.current) return undefined;
    since.current = Date.now();
    setShow(true);
    if (document.readyState === "complete") hideSoon();
    else { const f = () => hideSoon(); window.addEventListener("load", f, { once: true }); return () => window.removeEventListener("load", f); }
    return () => clearTimeout(timer.current);
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps

  // between pages: it shows when a link is clicked and is gone when the new page is there
  useEffect(() => {
    if (!on || !always) return undefined;
    const click = (e) => {
      const a = e.target.closest?.("a[href]");
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || (a.target && a.target !== "_self")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      since.current = Date.now(); setShow(true);
      clearTimeout(timer.current); timer.current = setTimeout(() => setShow(false), 8000); // never stuck
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [on, always]);
  useEffect(() => { if (on && always && loaded.current) hideSoon(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!on || !show) return null;
  return (
    <div className={`page-loader bd-${ui.loader_backdrop || "page"}`} style={{ "--ldo": ui.loader_opacity ?? 100 }} role="status" aria-live="polite" aria-label="Laden">
      <div className="ld-stack"><LoaderArt kind={ui.loader_style || "ring"} size={Number(ui.loader_size) || 56} />{ui.loader_percent === "yes" && <Percent />}</div>
    </div>
  );
}

// Lazy load: pictures below the first screen are loaded when they are needed (the page opens faster)
export function LazyImages() {
  const ui = useUi() || {};
  useEffect(() => {
    if (ui.loader_lazy === "no") return undefined;
    const apply = () => document.querySelectorAll("img:not([loading])").forEach((img) => {
      if (img.getBoundingClientRect().top > window.innerHeight + 200) { img.loading = "lazy"; img.decoding = "async"; }
    });
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [ui.loader_lazy]);
  return null;
}

// shown in the admin: the loader as a tile and as a test over the page for a moment
export function LoaderTest({ values, onClose, ms = 3000 }) {
  const [on, setOn] = useState(true);
  useEffect(() => { const t = setTimeout(() => { setOn(false); onClose?.(); }, ms); return () => clearTimeout(t); }, [onClose, ms]);
  if (!on) return null;
  return (
    <div className={`page-loader bd-${values.loader_backdrop || "page"}`} style={{ cursor: "pointer", "--ldo": values.loader_opacity ?? 100 }} onClick={() => { setOn(false); onClose?.(); }} role="status">
      <div className="ld-stack"><LoaderArt kind={values.loader_style || "ring"} size={Number(values.loader_size) || 56} />{values.loader_percent === "yes" && <Percent />}</div>
    </div>
  );
}

// Effects while scrolling: parts of the page appear when they come into view, backgrounds move slower, a progress bar and a button to go back up
const REVEAL = ".pb-rowwrap:not(.hero), .card, .faq-item, .games-card, .menu-tile, .pcard, .plugin-item, .plan-card, .member-card, .sub-plan";
export function ScrollFx() {
  const ui = useUi() || {};
  const mode = ui.scroll_reveal || "none";
  const [pct, setPct] = useState(0);
  const [top, setTop] = useState(false);
  useEffect(() => { // every block can have its own effect (data-fx); without one it follows the theme
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const root = document.documentElement;
    root.style.setProperty("--srd", `${ui.scroll_reveal_ms ?? 600}ms`);
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("sr-in"); e.target.classList.remove("sr-pre"); io.unobserve(e.target); } }), { threshold: 0.08 });
    const seen = new WeakSet();
    const scan = () => document.querySelectorAll(`${REVEAL}, [data-fx]`).forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      const m = el.dataset.fx || mode;
      if (!m || m === "none") return;
      el.dataset.srm = m;
      if (el.getBoundingClientRect().top > window.innerHeight * 0.95) { el.classList.add("sr-pre"); io.observe(el); }
    });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); io.disconnect(); document.querySelectorAll(".sr-pre").forEach((el) => el.classList.remove("sr-pre")); };
  }, [mode, ui.scroll_reveal_ms]);
  useEffect(() => {
    const on = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setPct(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
      setTop(window.scrollY > 500);
      if (ui.scroll_parallax === "yes") document.querySelectorAll(".sec-bg img, .sec-bg video, .page-bg img, .page-bg video").forEach((el) => { const r = el.parentElement.getBoundingClientRect(); el.style.setProperty("--py", `${Math.round((r.top + r.height / 2 - window.innerHeight / 2) * -0.15)}px`); });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    document.documentElement.dataset.parallax = ui.scroll_parallax === "yes" ? "1" : "0";
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); delete document.documentElement.dataset.parallax; };
  }, [ui.scroll_parallax]);
  return (
    <>
      {ui.scroll_progress === "yes" && <div className="scroll-progress" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>}
      {ui.scroll_top === "yes" && top && <button type="button" className="scroll-top" aria-label="Naar boven" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑</button>}
    </>
  );
}

// the effect when you go to another page: the page that arrives fades / slides / zooms in
export function PageTransition({ children }) {
  const ui = useUi() || {};
  const pathname = usePathname();
  const mode = ui.page_transition || "none";
  if (mode === "none") return children;
  return <div key={pathname} className={`pt pt-${mode}`} style={{ "--ptd": `${ui.page_transition_ms ?? 350}ms` }}>{children}</div>;
}

// A "loading" in a screen (dashboard, admin, a list): the loader of the settings, or the plain text while the loader is off
export function Busy({ full = false, label = "Laden…" }) {
  const ui = useUi() || {};
  const on = ui.loader_on === "yes";
  if (!on) return full ? <div className="splash">{label}</div> : <p className="muted">{label}</p>;
  if (full) return <div className={`page-loader bd-${ui.loader_backdrop || "page"}`} style={{ "--ldo": ui.loader_opacity ?? 100 }} role="status" aria-label={label}><div className="ld-stack"><LoaderArt kind={ui.loader_style || "ring"} size={Number(ui.loader_size) || 56} />{ui.loader_percent === "yes" && <Percent />}</div></div>;
  return <div className="busy" role="status" aria-label={label}><LoaderArt kind={ui.loader_style || "ring"} size={Math.min(Number(ui.loader_size) || 56, 56)} /></div>;
}

// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect } from "react";

// The mouse effects of the website (theme settings fx_*, set by the attributes data-fxc|fxm|fxt|fxg|fxr|fxp on <html>): a cursor that follows the mouse and grows over links and buttons,
// magnetic buttons, cards that tilt in 3D, a spot of light that follows the mouse on cards, a ripple on a button click and large pictures that move along with the mouse.
// Never on a touch screen, never for people who asked for less movement, and not while the page is being edited. A change in the settings works at once (the attributes are watched).
const INTERACTIVE = "a, button, [role=button], input, select, textarea, label, summary, .btn";
const MAGNETIC = ".btn, a.btn, button.btn, .site-main .btn, main .btn";
const CARDS = "main .card:not(.modal):not(.login-card), .pb-card, .block-card";
const FX_ATTRS = ["data-fxc", "data-fxm", "data-fxt", "data-fxg", "data-fxr", "data-fxp", "data-fxcfg", "data-pbbar"];
const COLORS = { primary: "var(--blue, #f2823f)", secondary: "var(--secondary, var(--blue, #f2823f))", text: "var(--text, #1f2937)", white: "#ffffff" };
const DEF = { fx_cursor_size: 34, fx_cursor_speed: 5, fx_cursor_grow: 1.9, fx_cursor_color: "primary", fx_cursor_native: "no", fx_magnetic_strength: 25, fx_tilt_amount: 7, fx_glow_size: 260, fx_glow_strength: 22, fx_parallax_amount: 8 };
const cfgOf = () => { try { return { ...DEF, ...JSON.parse(document.documentElement.dataset.fxcfg || "{}") }; } catch { return DEF; } };

const on = (t, e, f, o) => { t.addEventListener(e, f, o); return () => t.removeEventListener(e, f, o); };

function cursor(kind, cfg) {
  const ring = document.createElement("div"); ring.className = `fx-cursor fx-${kind}`;
  const dot = kind === "dot" ? Object.assign(document.createElement("div"), { className: "fx-cursor-dot" }) : null;
  const col = COLORS[cfg.fx_cursor_color] || COLORS.primary;
  ring.style.setProperty("--fx-cs", `${cfg.fx_cursor_size}px`); ring.style.setProperty("--fx-cc", col); dot?.style.setProperty("--fx-cc", col);
  if (cfg.fx_cursor_native === "yes") document.documentElement.classList.add("fx-hide-native");
  document.body.append(ring); if (dot) document.body.append(dot);
  const k = 0.06 + cfg.fx_cursor_speed * 0.045, grow = Number(cfg.fx_cursor_grow) || 1.9;
  let x = -100, y = -100, rx = x, ry = y, raf = 0, big = false, down = false;
  const tick = () => {
    rx += (x - rx) * k; ry += (y - ry) * k;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%) scale(${down ? 0.8 : big ? grow : 1})`;
    if (dot) dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const offs = [
    on(document, "mousemove", (e) => { x = e.clientX; y = e.clientY; ring.classList.add("show"); dot?.classList.add("show"); big = !!e.target.closest?.(INTERACTIVE); }, { passive: true }),
    on(document, "mouseleave", () => { ring.classList.remove("show"); dot?.classList.remove("show"); }),
    on(document, "mousedown", () => { down = true; }), on(document, "mouseup", () => { down = false; }),
  ];
  return () => { cancelAnimationFrame(raf); offs.forEach((f) => f()); ring.remove(); dot?.remove(); document.documentElement.classList.remove("fx-hide-native"); };
}

function magnetic(cfg) {
  const k = cfg.fx_magnetic_strength / 100;
  let cur = null;
  const reset = () => { if (cur) { cur.style.transform = ""; cur.style.transition = "transform .3s ease"; cur = null; } };
  const offs = [
    on(document, "mousemove", (e) => {
      const el = e.target.closest?.(MAGNETIC);
      if (cur && cur !== el) reset();
      if (!el) return;
      cur = el; const r = el.getBoundingClientRect();
      el.style.transition = "transform .08s ease-out";
      el.style.transform = `translate(${(e.clientX - (r.left + r.width / 2)) * k}px, ${(e.clientY - (r.top + r.height / 2)) * k * 1.3}px)`;
    }, { passive: true }),
    on(document, "mouseleave", reset),
  ];
  return () => { offs.forEach((f) => f()); reset(); };
}

function tilt(cfg) {
  const deg = cfg.fx_tilt_amount;
  let cur = null;
  const reset = () => { if (cur) { cur.style.transform = ""; cur.style.transition = "transform .4s ease"; cur = null; } };
  const offs = [
    on(document, "mousemove", (e) => {
      const el = e.target.closest?.(CARDS);
      if (cur && cur !== el) reset();
      if (!el) return;
      cur = el; const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transition = "transform .1s ease-out";
      el.style.transform = `perspective(900px) rotateX(${(-py * deg).toFixed(2)}deg) rotateY(${(px * deg).toFixed(2)}deg) translateZ(0)`;
    }, { passive: true }),
    on(document, "mouseleave", reset),
  ];
  return () => { offs.forEach((f) => f()); reset(); };
}

function glow(cfg) {
  const root = document.documentElement;
  root.style.setProperty("--fx-gs", `${cfg.fx_glow_size}px`); root.style.setProperty("--fx-gp", `${cfg.fx_glow_strength}%`);
  const hosts = new Set();
  const offs = [
    on(document, "mousemove", (e) => {
      const el = e.target.closest?.(CARDS);
      if (!el) return;
      if (!hosts.has(el)) { hosts.add(el); el.classList.add("fx-glow-host"); }
      const r = el.getBoundingClientRect();
      el.style.setProperty("--fx-x", `${e.clientX - r.left}px`); el.style.setProperty("--fx-y", `${e.clientY - r.top}px`);
    }, { passive: true }),
  ];
  return () => { offs.forEach((f) => f()); hosts.forEach((h) => h.classList.remove("fx-glow-host")); root.style.removeProperty("--fx-gs"); root.style.removeProperty("--fx-gp"); };
}

function ripple() {
  return on(document, "mousedown", (e) => {
    const el = e.target.closest?.(".btn, button.primary, button.btn");
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2;
    const s = document.createElement("span");
    s.className = "fx-ripple"; Object.assign(s.style, { width: `${d}px`, height: `${d}px`, left: `${e.clientX - r.left - d / 2}px`, top: `${e.clientY - r.top - d / 2}px` });
    el.classList.add("fx-ripple-host"); el.append(s);
    setTimeout(() => { s.remove(); }, 650);
  });
}

function parallax(cfg) {
  const amount = cfg.fx_parallax_amount;
  let raf = 0, mx = 0, my = 0;
  const imgs = () => [...document.querySelectorAll("main img")].filter((i) => i.width > 240 && !i.closest(".site-header, .site-footer") && !i.classList.contains("logo-light") && !i.classList.contains("logo-dark"));
  const upd = () => {
    raf = 0;
    imgs().forEach((i, n) => { const k = amount * (1 + (n % 3) * 0.4); i.style.transform = `translate(${(mx * k).toFixed(1)}px, ${(my * k).toFixed(1)}px) scale(1.03)`; i.style.transition = "transform .25s ease-out"; });
  };
  const off = on(document, "mousemove", (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
  return () => { off(); cancelAnimationFrame(raf); imgs().forEach((i) => { i.style.transform = ""; }); };
}

export default function MouseEffects() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const root = document.documentElement;
    const calm = window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm) return undefined;
    let undo = [];
    const apply = () => {
      undo.forEach((f) => f()); undo = [];
      if (root.dataset.pbbar === "1") return;  // while the page is edited the page stays as it is
      const d = root.dataset, cfg = cfgOf();
      if (d.fxc && d.fxc !== "off") undo.push(cursor(d.fxc, cfg));
      if (d.fxm === "yes") undo.push(magnetic(cfg));
      if (d.fxt === "yes") undo.push(tilt(cfg));
      if (d.fxg === "yes") undo.push(glow(cfg));
      if (d.fxr === "yes") undo.push(ripple());
      if (d.fxp === "yes") undo.push(parallax(cfg));
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(root, { attributes: true, attributeFilter: FX_ATTRS });
    return () => { mo.disconnect(); undo.forEach((f) => f()); };
  }, []);
  return null;
}

// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// The easy2edit UI-kit in a frame: the components (e2e-*) take the colours, fonts and corners of the theme that is in use on this website, light and dark.
// The kit itself (css, script and the list of components with their easy2edit_tag) is in kit-data.js and is loaded only when it is needed.
import { useEffect, useState } from "react";
import { api } from "../api";

// The component set (see Admin > Website > Componenten): its css, its script and its components come from the server. key "" = the set in use.
// The result: {key, name, KIT_CSS, KIT_RUNTIME, KIT_COMPONENTS}; every component knows its set (c.set) and has its easy2edit_tag.
// A rule that every component set needs: a picture in the visual of a hero or in the media of a split fills the whole box (it used to sit small in the coloured box) and the decoration that is meant for an empty box is hidden.
export const KIT_FIX = `
.e2e-hero__visual>img,.e2e-split__media>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;max-width:none}
.e2e-hero__visual:has(>img)::after,.e2e-split__media:has(>img)::before,.e2e-split__media:has(>img)::after{display:none}
.e2e-hero__visual:has(>img),.e2e-split__media:has(>img){overflow:hidden}
.e2e-cta :is(h1,h2,h3,p,span,small,li){color:inherit}
.e2e-cta p{opacity:.92}
`;
const cache = {};
export const loadKit = (key = "") => (cache[key] ||= api(`/components/?full=1${key ? `&key=${encodeURIComponent(key)}` : ""}`).then((d) => ({ key: d.key, name: d.name, KIT_CSS: (d.css || "") + KIT_FIX, KIT_RUNTIME: d.runtime || "", KIT_COMPONENTS: (d.components || []).map((c) => ({ ...c, set: d.key })) })).catch((e) => { delete cache[key]; throw e; }));
export const resetKit = () => { Object.keys(cache).forEach((k) => delete cache[k]); };

export const hexOf = (v) => {
  v = String(v || "").trim();
  if (/^#[0-9a-f]{3}$/i.test(v)) return "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  const m = v.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  return m ? "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("") : "";
};
const lum = (h) => { const c = [1, 3, 5].map((i) => { const x = parseInt(h.substr(i, 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
const onColor = (h) => (ratio(h, "#ffffff") >= ratio(h, "#151515") ? "#ffffff" : "#151515");

// The tokens of the kit (--e2e-*) from the variables of the theme (--blue = primary colour, --orange = secondary colour, --page, --card, --text ...).
export function kitTokens() {
  if (typeof document === "undefined") return "";
  const root = document.documentElement, cs = getComputedStyle(root);
  const get = (n, d = "") => hexOf(cs.getPropertyValue(n)) || d;
  const dark = root.dataset.theme === "dark";
  const primary = get("--blue", "#f2823f"), secondary = get("--orange", "#939497");
  const bg = get("--page", "#ffffff"), surface = get("--bg", "#f4f6fa"), text = get("--text", "#1f2937");
  const accent = dark ? get("--card", "#1b1f29") : text;
  const f = (n, d) => (cs.getPropertyValue(n).trim() || d);
  const radius = parseFloat(f("--btn-radius", "10")) || 10;
  return `:root{--e2e-primary:${primary};--e2e-secondary:${secondary};--e2e-accent:${accent};--e2e-bg:${bg};--e2e-surface:${surface};--e2e-text:${text};`
    + `--e2e-on-primary:${onColor(primary)};--e2e-on-secondary:${onColor(secondary)};--e2e-on-accent:${onColor(accent)};`
    + `--e2e-success:${get("--ok", "#2f9e6a")};--e2e-danger:${get("--danger", "#d64545")};`
    + `--e2e-font-heading:${f("--font-heading", "system-ui, sans-serif")};--e2e-font-body:${f("--font-body", "system-ui, sans-serif")};--e2e-radius:${radius}px;--e2e-shadow-strength:${dark ? "40%" : "10%"}}`;
}

// What goes in the frame around a component: kit css, the tokens of the theme, then the html and the script of the kit.
// The web fonts of the theme are loaded by a <link> in the page, not in a frame: the frame needs the same link or the font falls back to a standard one.
export const themeFontLinks = () => (typeof document === "undefined" ? [] : [...document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis.com"]')].map((l) => l.href));
const fontTags = () => themeFontLinks().map((h) => `<link rel="stylesheet" href="${h.replace(/"/g, "&quot;")}">`).join("");
export const kitHead = (kit) => `${fontTags()}<style>${kit.KIT_CSS}</style><style>${kitTokens()}html,body{margin:0}body{background:transparent;color:var(--e2e-text);font-family:var(--e2e-font-body);line-height:1.5}</style>`;
export const kitTail = (kit) => `<script>document.documentElement.setAttribute("data-e2e-tabstyle",${JSON.stringify(typeof document === "undefined" ? "pills" : document.documentElement.dataset.tabs || "pills")});${String(kit.KIT_RUNTIME).replace(/<\/script/gi, "<\\/script")}<\/script>`;

// The kit as loaded data in a component; `tick` changes when the theme changes (light/dark or new colours), so the frame is drawn again.
export function useKit(on = true, key = "") {
  const [kit, setKit] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { if (on) loadKit(key).then(setKit).catch(() => setKit(null)); }, [on, key]);
  useEffect(() => {
    if (!on) return undefined;
    const f = () => setTick((n) => n + 1);
    window.addEventListener("themechange", f);
    const mo = new MutationObserver(f);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style"] });
    return () => { window.removeEventListener("themechange", f); mo.disconnect(); };
  }, [on]);
  return { kit, tick };
}

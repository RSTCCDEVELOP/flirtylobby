// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { kitTokens, useKit } from "./kitDoc";
import { Busy } from "../../components/PageLoader";

// The components of the set in use (e2e-*) straight in the page of a module, without a frame: the css of the set is limited to this block (the global rules of the set for html, body, a, p ... stay out)
// and the tokens come from the theme of the website. `tag` is the easy2edit_tag of the component that the markup inside follows.
// the selectors of a rule, split at the commas that are not inside brackets (:is(h1, h2) is ONE selector): a broken selector made the browser drop every rule after it, also the colours of the theme
const splitSel = (text) => {
  const out = []; let depth = 0, cur = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};
function scopedCss(css, scope) {
  if (typeof CSSStyleSheet === "undefined") return "";
  let sheet;
  try { sheet = new CSSStyleSheet(); sheet.replaceSync(css); } catch { return ""; }
  const rules = (list) => [...list].map((r) => {
    if (r.type === 1) { // a style rule: only what belongs to the components themselves, the tokens move to the scope
      const sel = splitSel(r.selectorText);
      if (sel.every((s) => s === ":root" || s === "[data-e2e-theme]")) return `${scope}{${r.style.cssText}}`;
      const keep = sel.filter((s) => /^\.e2e|^\[data-e2e/.test(s)).map((s) => (s.startsWith("[data-e2e") ? `${scope}${s}` : `${scope} ${s}`));  // an attribute rule is about the block itself (tab style)
      return keep.length ? `${keep.join(",")}{${r.style.cssText}}` : "";
    }
    if (r.type === 4 || r.type === 12) return `@${r.type === 4 ? "media" : "supports"} ${r.conditionText}{${rules(r.cssRules)}}`;
    if (r.type === 7 || r.type === 5) return r.cssText; // keyframes and fonts
    return "";
  }).join("\n");
  return rules(sheet.cssRules);
}

// the usual parts of a screen (buttons, badges, fields) take the look of the kit by themselves inside a block with `bridge`
const BRIDGE = [["table.table, table.tbl", "e2e-table"], [".table-wrap", "e2e-table-wrap"], ["button.primary, a.primary, .btn.primary", "e2e-btn"], [".btn:not(.primary):not(.danger)", "e2e-btn e2e-btn--outline"], [".badge", "e2e-badge"], [".badge.ok", "e2e-badge--success"], [".badge.warn", "e2e-badge--warning"],
  ["input[type=text], input[type=search], input[type=email], input[type=number], input[type=password], input:not([type])", "e2e-input"], ["select", "e2e-select"], ["textarea", "e2e-textarea"]];

// The css of the set is put in the page ONCE (it is limited to .e2e-scope, so it is the same for every block), the blocks only carry the class.
function putCss(css) {
  if (typeof document === "undefined" || !css) return;
  let st = document.getElementById("e2e-kit-scoped");
  if (!st) { st = document.createElement("style"); st.id = "e2e-kit-scoped"; document.head.appendChild(st); }
  if (st.textContent !== css) st.textContent = css;
}

export default function KitScope({ tag, className = "", bridge = false, stage = false, children }) {
  const { kit, tick, failed } = useKit(true, "");
  const css = useMemo(() => { // the stage (a preview of a component) is a card of the theme on the background of the theme: the component takes the card colour of the theme
    if (!kit) return "";
    const stageCss = ".e2e-scope.e2e-stage{--e2e-bg:var(--card);--e2e-surface:var(--bg);background:var(--card);border:1px solid var(--line);border-radius:var(--radius, 12px);padding:1.1rem}";
    // in a screen (the dashboard, a pop-up) the cards are the colour of a card of the theme and the areas the colour of the page area; the page colour of the site (--page) can be the colour of the brand
    const areas = ".e2e-scope{--e2e-bg:var(--card, #ffffff);--e2e-surface:var(--bg, #f4f6fa)}";
    return `${scopedCss(kit.KIT_CSS, ".e2e-scope")}\n${kitTokens().replace(/^:root\{/, ".e2e-scope{")}\n${areas}\n${stageCss}`;
  }, [kit, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const [ready, setReady] = useState(false);
  const [tabs, setTabs] = useState("pills");  // the look of the tabs follows the theme (Thema > Vormgeving > Uiterlijk van tabbladen)
  const root = useRef(null);
  useEffect(() => { if (css) { putCss(css); setReady(true); } }, [css]);
  useEffect(() => setTabs(document.documentElement.dataset.tabs || "pills"), [tick]);
  useEffect(() => {
    const el = root.current;
    if (!bridge || !el || !ready) return undefined;
    const run = () => BRIDGE.forEach(([sel, cls]) => el.querySelectorAll(sel).forEach((n) => cls.split(" ").forEach((c) => !n.classList.contains(c) && n.classList.add(c))));
    run();
    const mo = new MutationObserver(run);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [bridge, ready]);
  const shown = ready || failed; // never stay hidden: when the set does not arrive the content shows without it
  return (
    <>
    {!shown && bridge && <Busy />}
    <div ref={root} data-e2e-tabstyle={tabs} className={`e2e-scope${stage ? " e2e-stage" : ""}${className ? ` ${className}` : ""}`} data-easy2edit-tag={tag || undefined} style={{ color: "var(--e2e-text)", fontFamily: "var(--e2e-font-body)", visibility: shown ? "visible" : "hidden", ...(shown ? {} : { height: 0, overflow: "hidden" }) }}>
      {children}
    </div>
    </>
  );
}

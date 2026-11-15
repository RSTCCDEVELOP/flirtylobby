// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useMemo } from "react";
import { kitTokens, useKit } from "./kitDoc";

// The components of the set in use (e2e-*) straight in the page of a module, without a frame: the css of the set is limited to this block (the global rules of the set for html, body, a, p ... stay out)
// and the tokens come from the theme of the website. `tag` is the easy2edit_tag of the component that the markup inside follows.
function scopedCss(css, scope) {
  if (typeof CSSStyleSheet === "undefined") return "";
  let sheet;
  try { sheet = new CSSStyleSheet(); sheet.replaceSync(css); } catch { return ""; }
  const rules = (list) => [...list].map((r) => {
    if (r.type === 1) { // a style rule: only what belongs to the components themselves, the tokens move to the scope
      const sel = r.selectorText.split(",").map((s) => s.trim());
      if (sel.every((s) => s === ":root" || s === "[data-e2e-theme]")) return `${scope}{${r.style.cssText}}`;
      const keep = sel.filter((s) => /^\.e2e|^\[data-e2e/.test(s)).map((s) => `${scope} ${s}`);
      return keep.length ? `${keep.join(",")}{${r.style.cssText}}` : "";
    }
    if (r.type === 4 || r.type === 12) return `@${r.type === 4 ? "media" : "supports"} ${r.conditionText}{${rules(r.cssRules)}}`;
    if (r.type === 7 || r.type === 5) return r.cssText; // keyframes and fonts
    return "";
  }).join("\n");
  return rules(sheet.cssRules);
}

export default function KitScope({ tag, className = "", children }) {
  const { kit, tick } = useKit(true, "");
  const css = useMemo(() => (kit ? `${scopedCss(kit.KIT_CSS, ".e2e-scope")}\n${kitTokens().replace(/^:root\{/, ".e2e-scope{")}` : ""), [kit, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`e2e-scope${className ? ` ${className}` : ""}`} data-easy2edit-tag={tag || undefined} style={{ color: "var(--e2e-text)", fontFamily: "var(--e2e-font-body)", visibility: css ? "visible" : "hidden" }}>
      {css && <style>{css}</style>}
      {children}
    </div>
  );
}

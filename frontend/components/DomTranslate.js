// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect } from "react";
import { getLanguage, t } from "../lib/t";
import { TOP_KEYS } from "../lib/top-keys";

const ATTRS = ["title", "placeholder", "aria-label", "alt"];
const SKIP = "script,style,textarea,[contenteditable='true'],[data-no-translate]";

// Texts kept in module-level constants (menus, widget titles, status maps) are plain strings that cannot follow a language switch by themselves.
// This translates exactly those known texts in the rendered page (and in later changes to it). Everything else uses tx() directly.
function fixText(node) {
  const raw = node.nodeValue;
  const v = raw?.trim();
  if (!v || !TOP_KEYS.has(v)) return;
  const tr = t(v);
  if (tr !== v) node.nodeValue = raw.replace(v, tr);
}
function fixAttrs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a);
    if (v && TOP_KEYS.has(v.trim())) { const tr = t(v.trim()); if (tr !== v) el.setAttribute(a, tr); }
  }
}
function walk(root) {
  if (root.nodeType === 3) return fixText(root);
  if (root.nodeType !== 1 || root.matches?.(SKIP)) return;
  fixAttrs(root);
  for (const c of root.childNodes) walk(c);
}

export default function DomTranslate() {
  useEffect(() => {
    if (getLanguage() === "nl") return;
    walk(document.body);
    const obs = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "childList") m.addedNodes.forEach(walk);
        else if (m.type === "characterData") fixText(m.target);
        else if (m.type === "attributes") fixAttrs(m.target);
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    return () => obs.disconnect();
  }, []);
  return null;
}

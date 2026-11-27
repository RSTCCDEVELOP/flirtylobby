// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { tx } from "../lib/t";
import { BUTTON_HELP, HEADER_HELP, ITEM_HELP, KIND_HELP } from "../lib/item-help";

// Item help in the dashboard: the "?" at the top right > Item help switches it on (the event "item-help"). The page is dimmed and every tile, menu item and button that is pointed at tells what it does,
// like the help in edit mode. Esc, or Item help again, switches it off.
const SIDEBAR = ".sidebar a[href]";
const BUTTONS = ".content .btn, .content button, .overlay .btn, .overlay button";
const SELECTOR = ["[data-help]", "[data-help-text]", "[data-help-key]", SIDEBAR, BUTTONS, ...HEADER_HELP.map(([s]) => s)].join(",");

const labelOf = (el) => (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
const textOf = (el) => {
  const own = el.closest("[data-help]")?.dataset.help;
  if (own) return own;
  const btn = el.closest(BUTTONS);
  if (btn && !btn.closest("[data-help-key]")) {   // a button: by its text, else by its kind
    const label = labelOf(btn);
    const k = Object.keys(BUTTON_HELP).find((x) => tx(x) === label);
    if (k) return BUTTON_HELP[k];
    const kind = KIND_HELP.find(([sel]) => btn.matches(`.btn${sel}`));
    if (kind) return kind[1];
  }
  const key = el.closest("[data-help-key]")?.dataset.helpKey;
  if (key && ITEM_HELP[key]) return ITEM_HELP[key];
  const own2 = el.closest("[data-help-text]")?.dataset.helpText;
  if (own2) return own2;
  const a = el.closest(SIDEBAR);
  if (a) { const h = (a.getAttribute("href") || "").split("?")[0]; if (ITEM_HELP[h]) return ITEM_HELP[h]; }
  const hit = HEADER_HELP.find(([s]) => el.closest(s));
  return hit ? hit[1] : "";
};

export default function ItemHelp() {
  const [on, setOn] = useState(false);
  const [tip, setTip] = useState(null);
  const tipEl = useRef(null);
  const pos = useRef({ x: 0, y: 0 });
  const place = () => {
    const el = tipEl.current;
    if (!el) return;
    const x = Math.min(pos.current.x + 16, window.innerWidth - el.offsetWidth - 12), y = Math.min(pos.current.y + 18, window.innerHeight - el.offsetHeight - 12);
    el.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  };
  useEffect(() => {
    const toggle = () => setOn((v) => !v);
    window.addEventListener("item-help", toggle);
    return () => window.removeEventListener("item-help", toggle);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("item-help-on", on);
    window.dispatchEvent(new CustomEvent("item-help-state", { detail: on }));
    if (!on) { setTip(null); document.querySelectorAll(".help-target").forEach((e) => e.classList.remove("help-target")); return undefined; }
    let last = null, raf = 0;
    const over = (e) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; place(); });
      const t = e.target.closest?.(SELECTOR);
      const target = t && textOf(t) ? t : null;
      if (target === last) return;
      last?.classList.remove("help-target");
      last = target;
      if (!target) { setTip(null); return; }
      target.classList.add("help-target");
      setTip(tx(textOf(target)));
    };
    const key = (e) => { if (e.key === "Escape") setOn(false); };
    document.addEventListener("mousemove", over);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousemove", over); document.removeEventListener("keydown", key); last?.classList.remove("help-target"); document.documentElement.classList.remove("item-help-on"); };
  }, [on]);
  if (!on) return null;
  return (
    <>
      <div className="edit-help-dim" aria-hidden="true"><span>{tx("Item help: wijs een tegel, menu-onderdeel of knop aan voor uitleg. Druk op Esc of kies Item help nog een keer om te sluiten.")}</span></div>
      {tip && <div className="edit-help-tip" role="tooltip" ref={(el) => { tipEl.current = el; if (el) requestAnimationFrame(place); }}>{tip}</div>}
    </>
  );
}

"use client";

import { useEffect } from "react";
import { useSession } from "./Session";

// Search fields remember what the user typed, per field and per user. The text is kept in localStorage under "find:<page>:<field>";
// PrefsSync sends keys like that to the server (the database), so the same search is there on every computer.
const label = (el) => (el.getAttribute("name") || el.id || el.getAttribute("placeholder") || el.getAttribute("aria-label") || "zoek").toLowerCase();
const clean = (s) => s.replace(/[^A-Za-z0-9_.-]+/g, ".").replace(/^\.+|\.+$/g, "");
const keyOf = (el) => {
  const raw = clean(`${window.location.pathname}:${label(el)}`.replace(/:/g, "."));
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return `find:${raw.length > 70 ? `${raw.slice(0, 62)}.${hash.toString(36)}`.slice(0, 80) : raw}`;
};
const isSearch = (el) => el instanceof HTMLInputElement && !el.readOnly && !el.disabled && !el.closest("[data-nofind]") && (el.type === "search" || (el.type === "text" && /^(zoek|search)/i.test(el.getAttribute("placeholder") || "")));
const setNative = (el, v) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v); // React-controlled field: set the value the way a user's typing does
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

export default function SearchMemory() {
  const { user } = useSession();
  useEffect(() => {
    if (!user) return undefined;
    const handle = (el) => {
      if (el.dataset.findDone || !isSearch(el)) return;
      el.dataset.findDone = "1";
      let v = "";
      try { v = localStorage.getItem(keyOf(el)) || ""; } catch {}
      if (v && !el.value) setNative(el, v);
    };
    const scan = (root) => { if (root.nodeType !== 1) return; if (root.tagName === "INPUT") handle(root); root.querySelectorAll?.("input").forEach(handle); };
    scan(document.body);
    const mo = new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach(scan)));
    mo.observe(document.body, { childList: true, subtree: true });
    const onInput = (e) => {
      const el = e.target;
      if (!el.dataset?.findDone || !isSearch(el)) return;
      try { if (el.value) localStorage.setItem(keyOf(el), el.value.slice(0, 200)); else localStorage.removeItem(keyOf(el)); } catch {}
    };
    document.addEventListener("input", onInput, true);
    return () => { mo.disconnect(); document.removeEventListener("input", onInput, true); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

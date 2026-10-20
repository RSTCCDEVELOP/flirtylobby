"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// After a click in the dashboard search: on the page that opens, look for the text that was found and show it.
// Blocks that are closed and tabs that are not open do not have their text in the page yet, so: open all blocks, then go through the tabs
// until the text turns up; then scroll to it and let it light up for a moment.
const KEY = "findtext";
const norm = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function locate(want) {
  const root = document.querySelector("main.content");
  if (!root) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement && !/^(SCRIPT|STYLE)$/.test(n.parentElement.tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (norm(n.textContent).includes(want)) return n.parentElement;
  for (const el of root.querySelectorAll("input[placeholder], textarea[placeholder], [title], [aria-label]")) {
    if ([el.getAttribute("placeholder"), el.getAttribute("title"), el.getAttribute("aria-label")].some((v) => v && norm(v).includes(want))) return el;
  }
  return null;
}

async function run(text) {
  const want = norm(text);
  if (!want) return;
  let el = null;
  for (let i = 0; i < 6 && !(el = locate(want)); i++) await wait(150); // the page is still loading its content
  if (!el) {
    window.dispatchEvent(new CustomEvent("collapse-all", { detail: true }));
    await wait(450);
    el = locate(want);
  }
  const seen = new Set();
  for (let guard = 0; !el && guard < 14; guard++) {
    const tab = [...document.querySelectorAll("main.content [role='tab'], main.content .tabs button, main.content .tab-pro")].find((t) => !seen.has(t.textContent) && t.getAttribute("aria-selected") !== "true" && !t.classList.contains("active"));
    if (!tab) break;
    seen.add(tab.textContent);
    tab.click();
    await wait(380);
    window.dispatchEvent(new CustomEvent("collapse-all", { detail: true }));
    await wait(300);
    el = locate(want);
  }
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.add("find-hit");
  setTimeout(() => el.classList.remove("find-hit"), 3200);
}

export default function FindOnPage() {
  const pathname = usePathname();
  const take = () => { let t = null; try { t = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); } catch {} if (t) run(t); };
  useEffect(() => { take(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.addEventListener("findonpage", take); return () => window.removeEventListener("findonpage", take); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

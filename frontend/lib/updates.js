// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef } from "react";
import { refreshMs } from "./refresh";

// The controller of the updates in the background: ONE timer for every part of the screen that asks the server for news now and then (menu numbers, notifications, sandbox, version, live lists ...).
//  - one timer, not one per part; every part that is due at that moment is handled in one round
//  - the same news (the same key) is asked ONCE and handed to everyone who wants it (the menu and the tiles ask for the same summary: one request)
//  - nothing runs while the tab is hidden or the device is offline; when you come back, what is due is updated at once (a little spread out)
//  - when nobody touches the screen for a while the pace goes down (x2 after 2 minutes, x4 after 10 minutes), and with "data saver" on it is slower too: less traffic, less energy
//  - the pace that the administrator set (Admin -> Systeem -> Vernieuwen) still counts (refreshMs)
// Real-time parts (calls, direct chat) do not use this: they need their own fast pace.
const tasks = new Map(); // key -> { fetcher, every, live, listeners: Set, last, busy }
let timer = null;
let lastTouch = typeof Date !== "undefined" ? Date.now() : 0;
let wired = false;

const factor = (live) => {
  let f = 1;
  if (!live) {
    const idle = Date.now() - lastTouch;
    f = idle > 600000 ? 4 : idle > 120000 ? 2 : 1;
  }
  try { if (navigator.connection?.saveData) f *= 2; } catch {}
  return f;
};
const active = () => typeof document !== "undefined" && document.visibilityState === "visible" && (typeof navigator === "undefined" || navigator.onLine !== false);
const dueIn = (t) => Math.max(0, t.last + (t.live ? t.every : refreshMs(t.every)) * factor(t.live) - Date.now()); // (a live part keeps its own fast pace: the pace of the administrator is for the quiet parts)

async function run(t) {
  if (t.busy) return;
  t.busy = true;
  t.last = Date.now();
  try {
    const data = await t.fetcher();
    t.listeners.forEach((l) => { try { l.onData?.(data); } catch {} });
  } catch (e) {
    t.listeners.forEach((l) => { try { l.onError?.(e); } catch {} });
  } finally { t.busy = false; }
}

function plan() {
  clearTimeout(timer);
  timer = null;
  if (!tasks.size || !active()) return;
  const next = Math.min(...[...tasks.values()].map(dueIn));
  timer = setTimeout(round, Math.max(500, next));
}

function round() {
  if (active()) [...tasks.values()].filter((t) => dueIn(t) <= 250).forEach(run); // everything that is due, in one round
  plan();
}

function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  const touch = () => { const was = Date.now() - lastTouch > 120000; lastTouch = Date.now(); if (was) plan(); };
  ["pointerdown", "keydown", "scroll", "touchstart"].forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }));
  document.addEventListener("visibilitychange", () => {
    if (!active()) return plan();
    [...tasks.values()].filter((t) => dueIn(t) <= 0).forEach((t, i) => setTimeout(() => run(t), i * 250)); // back on the tab: what is behind is updated, one after the other
    plan();
  });
  window.addEventListener("online", () => plan());
  window.addEventListener("offline", () => plan());
}

// Ask for news: fetcher() gives the data, onData(data) receives it. Several parts with the same key share ONE request. Returns the function that stops it.
export function subscribe(key, fetcher, every, onData, opts = {}) {
  wire();
  let t = tasks.get(key);
  if (!t) { t = { fetcher, every, live: !!opts.live, listeners: new Set(), last: 0, busy: false }; tasks.set(key, t); }
  t.every = Math.min(t.every, every);
  t.live = t.live || !!opts.live;
  const l = { onData, onError: opts.onError, every };
  t.listeners.add(l);
  if (opts.first !== false) setTimeout(() => { if (tasks.get(key) === t && active() && Date.now() - t.last > 1500) run(t); }, 0); // the first answer at once (not again when a part just got it)
  plan();
  return () => {
    t.listeners.delete(l);
    if (!t.listeners.size) tasks.delete(key);
    else t.every = Math.min(...[...t.listeners].map((x) => x.every)); // (the others keep their pace)
    plan();
  };
}

// Update this news now (for example after the user changed something).
export function refreshNow(key) {
  const t = tasks.get(key);
  if (t) run(t);
}

// For a component: useUpdates("community-summary", () => api("/community/summary/"), 20000, setSummary, enabled)
export function useUpdates(key, fetcher, every, onData, enabled = true, opts = {}) {
  const f = useRef(fetcher), d = useRef(onData);
  f.current = fetcher; d.current = onData;
  useEffect(() => {
    if (!enabled) return undefined;
    return subscribe(key, () => f.current(), every, (x) => d.current?.(x), opts);
  }, [key, every, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}

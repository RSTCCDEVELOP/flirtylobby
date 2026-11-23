// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useSyncExternalStore } from "react";
import { api, apiBase, errorText, getToken } from "./api";
import { tx } from "./t";

// The speed test lives here, outside any page: it keeps measuring while you go to other pages (the floating window and its edge tab only show it).
// how long a test runs and how often it measures: [seconds (0 = until you log out), seconds between two measurements]. A long test measures less often (it asks for the whole page each time).
export const SPEED_DURATIONS = [[30, 1], [60, 1], [120, 1], [300, 2], [900, 5], [3600, 10], [0, 10]];
const BUCKETS = 400;  // a long run is kept with at most this many points (averages)
const bucket = (samples) => {
  if (samples.length <= BUCKETS) return samples;
  const size = Math.ceil(samples.length / BUCKETS), out = [];
  for (let i = 0; i < samples.length; i += size) {
    const part = samples.slice(i, i + size), o = { t: part[0].t };
    for (const m of ["html", "api", "db", "mbps", "server"]) { const v = part.map((x) => x[m]).filter((x) => typeof x === "number"); o[m] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }
    out.push(o);
  }
  return out;
};
let S = { open: false, collapsed: false, running: false, samples: [], limit: 30, record: true, label: "", msg: null };
const subs = new Set();
let stopFlag = false;
const emit = () => subs.forEach((f) => f());
const set = (patch) => { S = { ...S, ...patch }; emit(); };

const timed = async (fn) => { const t = performance.now(); try { await fn(); return performance.now() - t; } catch { return null; } };

// one measurement: the page as a visitor gets it, a cached answer of the backend, a call that asks the database (and the time the server itself needed), and a download of 256 KB
async function measure() {
  const html = await timed(async () => { await (await fetch(`/?speedtest=${Date.now()}`, { cache: "no-store" })).arrayBuffer(); });
  const apiMs = await timed(() => api("/site/"));
  let server = null;
  const db = await timed(async () => { const r = await api("/system/speedtest/ping/"); server = r.server_ms; });
  let mbps = null;
  try {
    const t = performance.now();
    const res = await fetch(`${apiBase()}/api/system/speedtest/blob/?kb=256&_=${Date.now()}`, { headers: { Authorization: `Token ${getToken()}` }, cache: "no-store" });
    const buf = await res.arrayBuffer();
    mbps = (buf.byteLength * 8) / 1e6 / Math.max(0.001, (performance.now() - t) / 1000);
  } catch { mbps = null; }
  return { html, api: apiMs, db, mbps, server };
}

export const speed = {
  subscribe(f) { subs.add(f); return () => subs.delete(f); },
  get: () => S,
  set,
  openPanel() { set({ open: true, collapsed: false }); },
  closePanel() { if (S.running) stopFlag = true; set({ open: false }); },
  stop() { stopFlag = true; },
  async start() {
    if (S.running) return;
    stopFlag = false;
    const t0 = performance.now(), got = [], limit = S.limit, record = S.record, label = S.label;
    const every = (SPEED_DURATIONS.find((d) => d[0] === limit) || [0, 1])[1] * 1000;
    const autosave = record && (limit === 0 || limit > 120);  // a long run is saved while it runs, so nothing is lost when you log out or close the page
    let runId = null, lastSave = 0, ended = "";
    set({ running: true, samples: [], msg: null });
    const save = async (final) => {
      if (!record || got.length < 3 || !getToken()) return;
      const body = { label: label.trim() || `${tx("Test")} ${new Date(Date.now() - (performance.now() - t0)).toLocaleString()}`, seconds: Math.round((performance.now() - t0) / 1000), samples: bucket(got) };
      try {
        const created = !runId;
        const run = runId ? await api(`/system/speedtest/runs/${runId}/`, { method: "PUT", body }) : await api("/system/speedtest/runs/", { method: "POST", body });
        runId = run.id; lastSave = performance.now();
        if (typeof window !== "undefined" && (final || created)) window.dispatchEvent(new CustomEvent("speedrun-saved", { detail: run }));
      } catch (e) { if (final) set({ msg: { ok: false, text: errorText(e) } }); }
    };
    while (!stopFlag && (limit === 0 || (performance.now() - t0) / 1000 < limit)) {
      if (!getToken()) { ended = "logout"; break; }  // logged out: the test ends (the last save stays)
      const tick = performance.now();
      const m = await measure();
      got.push({ t: Math.round((tick - t0) / 1000), ...m });
      set({ samples: [...got] });
      if (autosave && (!runId ? got.length >= 3 : performance.now() - lastSave > 30000)) await save(false);
      const wait = every - (performance.now() - tick);
      if (wait > 0 && !stopFlag) await new Promise((r) => setTimeout(r, wait));
    }
    set({ running: false });
    if (ended === "logout") { set({ msg: { ok: true, text: tx("Je bent uitgelogd: de test is gestopt. De opname is bewaard tot de laatste keer opslaan.") } }); return; }
    if (record && got.length >= 3) {
      await save(true);
      if (S.msg === null || S.msg?.ok !== false) set({ msg: { ok: true, text: tx("De test is opgenomen. Je vindt hem onder Opnames bij Cache en snelheid.") } });
    }
  },
};

export const useSpeed = () => useSyncExternalStore(speed.subscribe, speed.get, speed.get);

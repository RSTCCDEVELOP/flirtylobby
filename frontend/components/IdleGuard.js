// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { isBusy } from "../lib/busy";
import { tx } from "../lib/t";

const KEY = "e2e-last-active"; // the last moment of activity, shared by the tabs of this browser (only a convenience: a failing storage is no problem)
const EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click", "wheel"];
const now = () => Date.now();
const read = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };
const write = (t) => { try { localStorage.setItem(KEY, String(t)); } catch { /* ok */ } };

// How long a logged-in person may do nothing (the setting "Inlogtijd" of the website, standard 5 minutes). At the end: logged out at once, or first the question "stay logged in?" with a countdown.
// "Activity" is something the person does (mouse, keys, scrolling, touch), in any tab of this browser; the polling of the pages does not count. While the person is active the server is told every
// half minute, so the login on the server stays alive too. minutes 0 = never.
export default function IdleGuard({ idle, onLogout }) {
  const minutes = Number(idle?.minutes) || 0, action = idle?.action === "logout" ? "logout" : "ask", askSeconds = Number(idle?.ask_seconds) || 60;
  const [left, setLeft] = useState(null); // seconds left in the question (null = no question; -1 = the question without a countdown: something is busy)
  const last = useRef(now());
  const sent = useRef(0);
  const asking = useRef(false);
  const done = useRef(false);

  const ping = useCallback(() => { sent.current = now(); api("/auth/activity/", { method: "POST" }).catch(() => {}); }, []);
  const active = useCallback(() => {
    if (asking.current) return; // during the question only the button counts
    last.current = now(); write(last.current);
    if (now() - sent.current > 30000) ping();
  }, [ping]);
  const stay = useCallback(() => { asking.current = false; setLeft(null); last.current = now(); write(last.current); ping(); }, [ping]);
  const out = useCallback(() => {
    if (done.current) return;
    done.current = true;
    try { sessionStorage.setItem("e2e-idle-out", String(minutes)); } catch { /* ok */ }
    onLogout();
  }, [minutes, onLogout]);

  useEffect(() => {
    if (!minutes) return undefined;
    last.current = Math.max(now(), read()); write(last.current);
    ping();
    EVENTS.forEach((e) => window.addEventListener(e, active, { passive: true }));
    const t = setInterval(() => {
      const busy = isBusy(); // a page is being made (or an import runs): never logged out now, always asked first, and the question waits for the answer
      if (busy && now() - sent.current > 30000) ping(); // (the server keeps the login alive while something is busy)
      const idleMs = now() - Math.max(last.current, read()); // (activity in another tab counts too)
      if (!asking.current && idleMs >= minutes * 60000) {
        if (action === "logout" && !busy) { out(); return; }
        asking.current = true; setLeft(busy ? -1 : askSeconds);
      } else if (asking.current) {
        const other = read() > last.current + 1000 && now() - read() < 5000; // the person answered in another tab
        if (other) { stay(); return; }
        setLeft((s) => {
          if (s == null) return s;
          if (busy) return -1; // busy: no countdown
          if (s === -1) return askSeconds; // it stopped being busy while the question was open: now the countdown starts
          if (s <= 1) { out(); return 0; }
          return s - 1;
        });
      }
    }, 1000);
    return () => { EVENTS.forEach((e) => window.removeEventListener(e, active)); clearInterval(t); };
  }, [minutes, action, askSeconds, active, out, stay, ping]);

  if (!minutes || left == null || typeof document === "undefined") return null;
  return createPortal(
    <div className="pb-objback" style={{ zIndex: 2000 }} role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
      <div className="pb-objpop" style={{ width: "min(420px, 92vw)", padding: "1.2rem 1.4rem", display: "grid", gap: ".8rem" }}>
        <strong id="idle-title" style={{ fontSize: "1.1rem" }}>{tx("Ben je er nog?")}</strong>
        <p style={{ margin: 0 }}>{left < 0 ? tx("Je hebt een tijd niets gedaan, maar er is nog iets bezig (bijvoorbeeld een pagina die wordt gemaakt). Je wordt niet automatisch uitgelogd. Wil je ingelogd blijven?") : tx("Je hebt een tijd niets gedaan. Je wordt over {0} seconden uitgelogd.", String(left))}</p>
        <div className="row" style={{ gap: ".5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn primary" autoFocus onClick={stay}>{tx("Ingelogd blijven")}</button>
          <button type="button" className="btn" onClick={out}>{tx("Nu uitloggen")}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

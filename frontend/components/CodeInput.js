// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { tx } from "../lib/t";
import { freshSandboxCode } from "../lib/sandboxCode";
import { codeLifetimes, DEFAULT_LIFETIME } from "../lib/codeLifetime";

// The one place for entering a verification code: a box per digit. Typing moves on, backspace goes back, a pasted code (or one the phone
// suggests from an sms) fills all boxes. Use it on every verification screen. onComplete(code) is called when the last digit is in.
// The round timer next to the code: a ring that runs out while the code is valid, with the minutes and seconds in it. Orange for the last minute, red when it has expired.
// It starts when the code input appears, and again when a new code is sent ("code-sent": every request that sends a code, see lib/api.js).
function CodeTimer({ kind }) {
  const [total, setTotal] = useState(DEFAULT_LIFETIME);
  const [left, setLeft] = useState(DEFAULT_LIFETIME);
  const end = useRef(Date.now() + DEFAULT_LIFETIME * 1000);
  useEffect(() => {
    let live = true;
    codeLifetimes().then((l) => { if (live && l?.[kind]) { setTotal(l[kind]); end.current = Date.now() + l[kind] * 1000; } });
    const restart = () => { end.current = Date.now() + total * 1000; };
    window.addEventListener("code-sent", restart);
    const id = setInterval(() => setLeft(Math.max(0, Math.ceil((end.current - Date.now()) / 1000))), 500);
    return () => { live = false; clearInterval(id); window.removeEventListener("code-sent", restart); };
  }, [kind, total]);
  const R = 28, C = 2 * Math.PI * R;
  const frac = Math.min(1, left / total);
  const state = left === 0 ? "gone" : left <= 60 ? "low" : "ok";
  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const gid = `ctg-${kind}`;
  return (
    <span className={`code-timer ${state}`} role="timer" aria-label={left === 0 ? tx("De code is verlopen") : `${tx("De code is nog geldig")}: ${mm}`} title={left === 0 ? tx("De code is verlopen: vraag een nieuwe aan") : `${tx("De code is nog geldig")}: ${mm}`}>
      <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" className="ct-g1" /><stop offset="100%" className="ct-g2" /></linearGradient>
        </defs>
        <circle cx="34" cy="34" r={R} fill="none" className="ct-track" strokeWidth="6" />
        <circle cx="34" cy="34" r={R} fill="none" stroke={`url(#${gid})`} className="ct-ring" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 34 34)" />
      </svg>
      <span className="ct-in"><span className="ct-text">{mm}</span><span className="ct-sub">{left === 0 ? tx("verlopen") : tx("geldig")}</span></span>
    </span>
  );
}

export default function CodeInput({ value, onChange, length = 6, autoFocus = false, onComplete, onAt, label, disabled = false, invalid = false, kind = "twofa", timer = true }) {
  const refs = useRef([]);
  const live = useRef({});
  live.current = { value, onChange, disabled, length };
  useEffect(() => { // the sandbox is on and the server gave the code: it is filled in (only an empty box set; never when the sandbox is off, then the server gives no code)
    const fill = (code) => {
      const c = live.current;
      if (!code || c.disabled || String(c.value || "").replace(/\D/g, "")) return;
      c.onChange(String(code).slice(0, c.length));
    };
    fill(freshSandboxCode());
    const on = (e) => fill(e.detail);
    window.addEventListener("sandbox-code", on);
    return () => window.removeEventListener("sandbox-code", on);
  }, []);
  const v = (value || "").replace(/\D/g, "").slice(0, length);
  const chars = Array.from({ length }, (_, i) => v[i] || "");
  const focus = (i) => { const el = refs.current[Math.max(0, Math.min(length - 1, i))]; el?.focus(); el?.select(); };
  const set = (next) => { onChange(next); if (next.length === length && onComplete) onComplete(next); };
  // digits typed or pasted at box i go in from there (never past the first empty box)
  const put = (i, text) => {
    if (onAt && String(text).includes("@")) { onAt(); return; }  // a superadmin shortcut (an @ fills the code in)
    const digits = (text || "").replace(/\D/g, "");
    if (!digits) return;
    const at = Math.min(i, v.length);
    const next = (v.slice(0, at) + digits + v.slice(at + digits.length)).slice(0, length);
    set(next);
    focus(Math.min(at + digits.length, length - 1));
  };
  const cell = (c, i) => (
    <input key={i} ref={(el) => (refs.current[i] = el)} className={`code-box ${c ? "filled" : ""} ${invalid ? "bad" : ""}`} value={c} disabled={disabled}
      inputMode="numeric" pattern="[0-9]*" autoFocus={autoFocus && i === 0} autoComplete={i === 0 ? "one-time-code" : "off"} aria-label={`${label || tx("Code")} ${i + 1}`}
      onFocus={(e) => e.target.select()}
      onChange={(e) => put(i, e.target.value)}
      onPaste={(e) => { e.preventDefault(); put(i, e.clipboardData.getData("text")); }}
      onKeyDown={(e) => {
        if (e.key === "@" && onAt) { e.preventDefault(); onAt(); }
        else if (e.key === "Backspace") {
          e.preventDefault();
          const idx = c ? i : i - 1;
          if (idx >= 0) { onChange(v.slice(0, idx) + v.slice(idx + 1)); focus(idx); }
        } else if (e.key === "ArrowLeft") { e.preventDefault(); focus(i - 1); }
        else if (e.key === "ArrowRight") { e.preventDefault(); focus(i + 1); }
      }} />
  );
  // a code of 6 is shown as two separate panels with 3 digits each: XXX - XXX
  const groups = length === 6 ? [chars.slice(0, 3), chars.slice(3)] : [chars];
  let n = 0;
  return (
    <div className="code-boxes" role="group" aria-label={label || tx("Code")}>
      {groups.map((g, gi) => (
        <span key={gi} className="code-group-wrap">
          {gi > 0 && <span className="code-dash" aria-hidden="true">–</span>}
          <span className={`code-group${invalid ? " bad" : ""}`}>{g.map((c) => cell(c, n++))}</span>
        </span>
      ))}
      {timer && <CodeTimer kind={kind} />}
    </div>
  );
}

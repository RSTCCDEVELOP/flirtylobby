// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useRef } from "react";
import { tx } from "../lib/t";

// The one place for entering a verification code: a box per digit. Typing moves on, backspace goes back, a pasted code (or one the phone
// suggests from an sms) fills all boxes. Use it on every verification screen. onComplete(code) is called when the last digit is in.
export default function CodeInput({ value, onChange, length = 6, autoFocus = false, onComplete, label, disabled = false, invalid = false }) {
  const refs = useRef([]);
  const v = (value || "").replace(/\D/g, "").slice(0, length);
  const chars = Array.from({ length }, (_, i) => v[i] || "");
  const focus = (i) => { const el = refs.current[Math.max(0, Math.min(length - 1, i))]; el?.focus(); el?.select(); };
  const set = (next) => { onChange(next); if (next.length === length && onComplete) onComplete(next); };
  // digits typed or pasted at box i go in from there (never past the first empty box)
  const put = (i, text) => {
    const digits = (text || "").replace(/\D/g, "");
    if (!digits) return;
    const at = Math.min(i, v.length);
    const next = (v.slice(0, at) + digits + v.slice(at + digits.length)).slice(0, length);
    set(next);
    focus(Math.min(at + digits.length, length - 1));
  };
  return (
    <div className="code-boxes" role="group" aria-label={label || tx("Code")}>
      {chars.map((c, i) => (
        <span key={i} className="code-cell">
        <input ref={(el) => (refs.current[i] = el)} className={`code-box ${c ? "filled" : ""} ${invalid ? "bad" : ""}`} value={c} disabled={disabled}
          inputMode="numeric" pattern="[0-9]*" autoFocus={autoFocus && i === 0} autoComplete={i === 0 ? "one-time-code" : "off"} aria-label={`${label || tx("Code")} ${i + 1}`}
          onFocus={(e) => e.target.select()}
          onChange={(e) => put(i, e.target.value)}
          onPaste={(e) => { e.preventDefault(); put(i, e.clipboardData.getData("text")); }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              const idx = c ? i : i - 1;
              if (idx >= 0) { onChange(v.slice(0, idx) + v.slice(idx + 1)); focus(idx); }
            } else if (e.key === "ArrowLeft") { e.preventDefault(); focus(i - 1); }
            else if (e.key === "ArrowRight") { e.preventDefault(); focus(i + 1); }
          }} />
        {length === 6 && i === 2 && <span className="code-dash" aria-hidden="true">–</span>}
        </span>
      ))}
    </div>
  );
}

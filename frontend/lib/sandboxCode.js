// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// While the sandbox is ON (the orange label) the server gives every verification code it makes back to the screen (sandbox_code / dev_code; it never does that when the sandbox is off).
// This remembers that code for a moment: every code input (components/CodeInput.js) on screen fills itself in with it, so a test goes quickly.
let last = null;
const MAX_AGE = 45000;

export function rememberSandboxCode(data) {
  if (typeof window === "undefined" || !data || typeof data !== "object") return;
  const raw = data.sandbox_code || data.dev_code;
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 4) return;
  last = { code: digits, at: Date.now() };
  setTimeout(() => window.dispatchEvent(new CustomEvent("sandbox-code", { detail: digits })), 0);  // after the screen that asked for it has drawn the code boxes
}

export const freshSandboxCode = () => (last && Date.now() - last.at < MAX_AGE ? last.code : "");

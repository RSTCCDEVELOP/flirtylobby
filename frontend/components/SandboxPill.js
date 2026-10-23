"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { tx } from "../lib/t";
import { IconFlask } from "./Icons";

// "SANDBOX" in the header (dashboard and website) while the sandbox is on: external connections (e-mail, payments ...) are simulated. Set up in Admin -> Sandbox.
export default function SandboxPill() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () => api("/sandbox/status/").then((s) => { if (live) setOn(!!s?.enabled); }).catch(() => {});
    load();
    window.addEventListener("sandbox-changed", load);
    const t = setInterval(load, 60000);
    return () => { live = false; clearInterval(t); window.removeEventListener("sandbox-changed", load); };
  }, []);
  if (!on) return null;
  return <span className="sandbox-pill" title={tx("Externe koppelingen zijn gesimuleerd: e-mail, betalingen en andere koppelingen worden niet echt verstuurd")}><IconFlask /> SANDBOX</span>;
}

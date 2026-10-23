// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import { useEffect, useRef, useState } from "react";
import { IconBolt } from "./Icons";
import { useUi } from "./Ui";

const EVERY = 60000; // check once a minute and when the tab becomes visible again

// "A new version is available" bar for visitors of the live site. Admins switch it on/off at Vormgeving -> Standaardinstellingen.
export default function VersionNotice({ current }) {
  const { version_notice: on } = useUi();
  const [fresh, setFresh] = useState(false);
  const [hidden, setHidden] = useState(false);
  const seen = useRef(current);

  useEffect(() => {
    if (!on || !current || current === "dev") return;
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch("/build-id", { cache: "no-store" });
        const { id } = await r.json();
        if (alive && id && id !== "dev" && id !== current) { if (id !== seen.current) setHidden(false); seen.current = id; setFresh(true); }
      } catch {}
    };
    const t = setInterval(check, EVERY);
    const vis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [on, current]);

  if (!on || !fresh || hidden) return null;
  return (
    <div className="version-notice" role="status">
      <IconBolt />
      <span>{tx("Er is een nieuwe versie van de website beschikbaar.")}</span>
      <button type="button" className="btn sm primary" onClick={() => window.location.reload()}>{tx("Nu verversen")}</button>
      <button type="button" className="btn sm" onClick={() => setHidden(true)}>{tx("Later")}</button>
    </div>
  );
}

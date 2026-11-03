// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconBolt } from "./Icons";
import { useUi } from "./Ui";

const EVERY = 60000; // check once a minute and when the tab becomes visible again

// "A new version is available" popup for everyone who has the site open (visitors and logged-in users): shown when a newer build is online. On by default; admins switch it off at Vormgeving -> Standaardinstellingen.
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

  if (!on || !fresh || hidden || typeof document === "undefined") return null;
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tx("Nieuwe versie beschikbaar")} onClick={() => setHidden(true)}>
      <div className="card modal form" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: ".5rem" }}><IconBolt />{tx("Nieuwe versie beschikbaar")}</h2>
        <p style={{ margin: 0 }}>{tx("Er staat een nieuwe versie van de website online. Ververs de pagina om de nieuwste versie te gebruiken.")}</p>
        <small className="muted">{tx("Sla eerst op waar je mee bezig bent: bij verversen gaan niet-opgeslagen wijzigingen verloren.")}</small>
        <div className="row" style={{ justifyContent: "flex-end", gap: ".5rem" }}>
          <button type="button" className="btn" onClick={() => setHidden(true)}>{tx("Later")}</button>
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>{tx("Nu verversen")}</button>
        </div>
      </div>
    </div>, document.body);
}

// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconBolt } from "./Icons";
import { useUi } from "./Ui";
import { useUpdates } from "../lib/updates";

const EVERY = 60000; // check once a minute and when the tab becomes visible again

// "A new version is available" popup for everyone who has the site open (visitors and logged-in users): shown when a newer build is online. On by default; admins switch it off at Vormgeving -> Standaardinstellingen.
export default function VersionNotice({ current }) {
  const { version_notice: on } = useUi();
  const [fresh, setFresh] = useState(false);
  const [hidden, setHidden] = useState(false);
  const seen = useRef(current);

  useUpdates("build-id", async () => (await fetch("/build-id", { cache: "no-store" })).json(), EVERY, (r) => {
    const id = r?.id;
    if (id && id !== "dev" && id !== current) { if (id !== seen.current) setHidden(false); seen.current = id; setFresh(true); }
  }, !!on && !!current && current !== "dev");

  if (!on || !fresh || hidden || typeof document === "undefined") return null;
  return createPortal(
    <div className="version-notice" role="status" aria-live="polite" aria-label={tx("Nieuwe versie beschikbaar")}>
      <IconBolt />
      <div className="version-notice-text">
        <strong>{tx("Nieuwe versie beschikbaar")}</strong>
        <span>{tx("Er staat een nieuwe versie van de website online. Ververs de pagina om de nieuwste versie te gebruiken.")}</span>
        <small className="muted">{tx("Sla eerst op waar je mee bezig bent: bij verversen gaan niet-opgeslagen wijzigingen verloren.")}</small>
      </div>
      <div className="version-notice-actions">
        <button type="button" className="btn" onClick={() => setHidden(true)}>{tx("Later")}</button>
        <button type="button" className="btn primary" onClick={() => window.location.reload()}>{tx("Nu verversen")}</button>
      </div>
    </div>, document.body);
}

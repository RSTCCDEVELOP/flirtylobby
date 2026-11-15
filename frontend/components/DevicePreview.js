// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "./Session";

const DEVICES = {
  computer: { label: "Computer", w: 0 },
  tablet: { label: "iPad", w: 820, h: 1100 },
  mobile: { label: "Mobiel", w: 390, h: 844 },
};
const Ico = ({ k }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {k === "computer" && <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>}
    {k === "tablet" && <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M11 18h2" /></>}
    {k === "mobile" && <><rect x="8" y="2.5" width="8" height="19" rx="2" /><path d="M11 18.5h2" /></>}
  </svg>
);

// Edit mode: look at this page the way it shows on a computer, an iPad or a phone (the page opens in a frame of that width).
export default function DevicePreview() {
  const { editing } = useSession();
  const [dev, setDev] = useState("computer");
  const [src, setSrc] = useState("");
  const [visitor, setVisitor] = useState(false); // false = the framed page can be edited, true = as a visitor sees it
  const [used, setUsed] = useState(false);
  const [rev, setRev] = useState(0); // the framed page loads again after every save of the editor on the big screen
  const [host, setHost] = useState(null); // the foot of the panel of the editor: the choice of the view is there (not floating over the page)
  useEffect(() => {
    const f = () => setHost(document.getElementById("pb-device-host"));
    const saved = () => setTimeout(() => setRev((n) => n + 1), 400);
    window.addEventListener("pb-saved", saved);
    f();
    const t = setInterval(f, 400);
    return () => { clearInterval(t); window.removeEventListener("pb-saved", saved); };
  }, []);
  useEffect(() => {
    if (dev === "computer") return setSrc("");
    const u = new URL(window.location.href);
    u.searchParams.delete("preview"); u.searchParams.delete("frame");
    u.searchParams.set(visitor || host ? "preview" : "frame", "1"); // with the editor panel on the big screen the frame only shows the result
    setSrc(u.toString());
    if (!host) setUsed(true);
  }, [dev, visitor, !!host]);
  // back to the full page: show what was changed in the frame
  const close = () => { if (used) { setUsed(false); window.location.reload(); } setDev("computer"); };
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);
  if (!editing || (typeof window !== "undefined" && (new URLSearchParams(window.location.search).get("preview") || new URLSearchParams(window.location.search).get("frame")))) return null;
  const d = DEVICES[dev];
  return (
    <>
      {document.documentElement.dataset.pbbar === "1" && !host ? null : host ? createPortal(
      <div className={host ? "device-bar docked" : "device-bar"} role="group" aria-label={tx("Weergave testen")}>
        <span>{tx("Weergave")}</span>
        {Object.entries(DEVICES).map(([k, v]) => <button type="button" key={k} className={dev === k ? "on" : ""} title={tx(v.label)} aria-pressed={dev === k} onClick={() => (k === "computer" ? close() : setDev(k))}><Ico k={k} /></button>)}
      </div>
      , host) : (
      <div className={host ? "device-bar docked" : "device-bar"} role="group" aria-label={tx("Weergave testen")}>
        <span>{tx("Weergave")}</span>
        {Object.entries(DEVICES).map(([k, v]) => <button type="button" key={k} className={dev === k ? "on" : ""} title={tx(v.label)} aria-pressed={dev === k} onClick={() => (k === "computer" ? close() : setDev(k))}><Ico k={k} /></button>)}
      </div>
      )}
      {dev !== "computer" && src && (
        <div className={`device-overlay${host ? " docked" : ""}`} onClick={host ? undefined : close}>
          <div className={`device-frame ${dev}`} style={{ width: d.w }} onClick={(e) => e.stopPropagation()}>
            <div className="device-top">
              <span>{tx(d.label)} · {d.w}px</span>
              {!host && <span className="device-mode">
                <button type="button" className={!visitor ? "on" : ""} onClick={() => setVisitor(false)}>{tx("Bewerken")}</button>
                <button type="button" className={visitor ? "on" : ""} onClick={() => setVisitor(true)}>{tx("Bezoeker")}</button>
              </span>}
              <button type="button" className="btn sm" onClick={close}>{tx("Sluiten")}</button>
            </div>
            <iframe key={rev} title={tx(d.label)} src={src} style={{ height: `min(${d.h}px, calc(100vh - ${host ? "9rem" : "6rem"}))` }} />
          </div>
        </div>
      )}
    </>
  );
}

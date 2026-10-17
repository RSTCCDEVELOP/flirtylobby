"use client";

import { tx } from "../lib/t";
import { useEffect, useState } from "react";
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
  useEffect(() => {
    if (dev === "computer") return setSrc("");
    const u = new URL(window.location.href);
    u.searchParams.delete("preview"); u.searchParams.delete("frame");
    u.searchParams.set(visitor ? "preview" : "frame", "1");
    setSrc(u.toString());
    setUsed(true);
  }, [dev, visitor]);
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
      <div className="device-bar" role="group" aria-label={tx("Weergave testen")}>
        <span>{tx("Weergave")}</span>
        {Object.entries(DEVICES).map(([k, v]) => <button type="button" key={k} className={dev === k ? "on" : ""} title={tx(v.label)} aria-pressed={dev === k} onClick={() => (k === "computer" ? close() : setDev(k))}><Ico k={k} /></button>)}
      </div>
      {dev !== "computer" && src && (
        <div className="device-overlay" onClick={close}>
          <div className={`device-frame ${dev}`} style={{ width: d.w }} onClick={(e) => e.stopPropagation()}>
            <div className="device-top">
              <span>{tx(d.label)} · {d.w}px</span>
              <span className="device-mode">
                <button type="button" className={!visitor ? "on" : ""} onClick={() => setVisitor(false)}>{tx("Bewerken")}</button>
                <button type="button" className={visitor ? "on" : ""} onClick={() => setVisitor(true)}>{tx("Bezoeker")}</button>
              </span>
              <button type="button" className="btn sm" onClick={close}>{tx("Sluiten")}</button>
            </div>
            <iframe title={tx(d.label)} src={src} style={{ height: `min(${d.h}px, calc(100vh - 6rem))` }} />
          </div>
        </div>
      )}
    </>
  );
}

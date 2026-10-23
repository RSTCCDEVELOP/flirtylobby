// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { tx } from "../lib/t";
import MarketingPopup from "./MarketingPopup";

const siteLang = () => { try { return localStorage.getItem("lang") || "nl"; } catch { return "nl"; } };

// A tile (system object) about one module: title and tagline, and a button that opens the marketing pop-up. In Super admin the tile also has a switch.
export default function MarketingTile({ module, title = "", tagline = "", admin = false, on = true, onToggle = null, layout = "1" }) {
  const [c, setC] = useState(title ? { title, tagline } : null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!admin) api(`/marketing/${module}/?lang=${siteLang()}`).then((r) => setC(r.content)).catch(() => setC(null)); }, [module, admin]);
  if (!c) return null;
  return (
    <>
      <div className={`mk-tile mk-l${admin ? "1" : layout}${on ? "" : " off"}`}>
        <div className="mk-tile-top">
          <span className="mk-ico" aria-hidden="true">{(c.title || "?").slice(0, 1).toUpperCase()}</span>
          {onToggle && <label className="check sec-toggle" title={on ? tx("Aan") : tx("Uit")}><span className="switch"><input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} /><span /></span></label>}
        </div>
        <h3>{c.title}</h3>
        <p>{c.tagline}</p>
        <button type="button" className="btn sm" onClick={() => setOpen(true)}>{admin ? tx("Bekijken en verbeteren") : tx("Lees meer")}</button>
      </div>
      {open && <MarketingPopup module={module} onClose={() => setOpen(false)} />}
    </>
  );
}

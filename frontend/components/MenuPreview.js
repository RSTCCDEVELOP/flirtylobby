"use client";

import { MenuView } from "./SiteMenu";
import { tx } from "../lib/t";

// A header as the visitor sees it on a computer, tablet or phone, with the menu exactly as set in the menu settings.
// In the admin its items can be dragged (the handlers come from the page).
export const DEVICE_W = { desktop: "100%", tablet: "820px", mobile: "390px" };
export const DEVICE_H = { desktop: 340, tablet: 380, mobile: 460 };

export default function MenuPreview({ items, cfg, device = "desktop", scrolled = false, draggable = false, handlers = {} }) {
  const h = cfg.height?.[device] || 64;
  const colour = cfg.bg || "var(--card)";
  const op = Math.round((cfg.bg_opacity ?? 0.88) * 100);
  const mode = cfg.float || "none";
  const headStyle = { height: h, background: `color-mix(in srgb, ${colour} ${op}%, transparent)`, backdropFilter: `blur(${cfg.blur ?? 10}px)`, WebkitBackdropFilter: `blur(${cfg.blur ?? 10}px)` };
  const form = cfg.forms[device];
  const align = cfg.align[device];
  return (
    <div className="hm-prev-frame" style={{ width: DEVICE_W[device], height: DEVICE_H[device] }} {...handlers}>
      <div className="hm-prev-page" aria-hidden="true">
        <span style={{ top: "30%", left: "8%", width: "34%" }} /><span style={{ top: "30%", right: "8%", width: "40%" }} /><span style={{ top: "52%", left: "8%", width: "60%" }} /><span style={{ top: "70%", left: "8%", width: "45%" }} />
      </div>
      <div className={`hm-prev-header m-${mode}${scrolled ? " scrolled" : ""}`} style={headStyle}>
        <span className="hm-prev-logo">easy<b>2</b>edit</span>
        <div className={`hmenu-wrap hm-prev-menu al-${align} tp-${cfg.toggle_pos?.[device] || "right"}`}>
          <MenuView items={items} cfg={cfg} device={device} preview={{ draggable }} />
        </div>
        {form !== "bottom" && <span className="hm-prev-actions" aria-hidden="true"><i /><i /><i /></span>}
      </div>
      {scrolled && mode === "hide" && <small className="hm-prev-note">{tx("Het menu verdwijnt bij naar beneden scrollen en komt terug bij omhoog scrollen.")}</small>}
    </div>
  );
}

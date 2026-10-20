"use client";

import { tx } from "../lib/t";
import { useEffect, useState } from "react";
import { api, mediaUrl } from "../lib/api";
import { localised } from "./Donate";
import { placeStyle } from "./ImagePlace";
import { useModule } from "./Modules";

// After paying a donation the visitor comes back with ?bedankt=<action>: show that action's thank-you popup (title, text, picture) in their language.
export default function DonateThanks() {
  const on = useModule("donations");
  const [c, setC] = useState(null);
  useEffect(() => {
    if (!on) return;
    const u = new URL(window.location.href);
    const id = u.searchParams.get("bedankt");
    if (!id) return;
    u.searchParams.delete("bedankt");
    window.history.replaceState({}, "", u.pathname + (u.search || "") + u.hash);
    api("/donations/campaigns/").then((d) => { const f = d.campaigns.find((x) => String(x.id) === id); if (f) setC(localised(f)); }).catch(() => {});
  }, [on]);
  if (!c) return null;
  const v = c.thanksView;
  return (
    <div className="overlay" onClick={() => setC(null)}>
      <div className="card modal don-thanks" onClick={(e) => e.stopPropagation()}>
        {v.image && <img src={mediaUrl(v.image)} alt="" style={placeStyle(v.placement)} />}
        <h2 style={{ margin: 0 }}>{v.title || tx("Bedankt voor je donatie!")}</h2>
        {v.text && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{v.text}</p>}
        <div className="row"><button type="button" className="btn primary" onClick={() => setC(null)}>{tx("Sluiten")}</button></div>
      </div>
    </div>
  );
}

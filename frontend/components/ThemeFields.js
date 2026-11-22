// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import Loading from "./Loading";

// Fields of the theme (Thema → Layout) in the page panel of the editor: a choice, a width or a switch. A change is saved at once and shows at once on the page.
// fields: [[key, "Label", kind?]] with kind "width" (100% of the screen or the maximum width, with the maximum in px), "toggle" (show/hide) or nothing (a choice of the theme).
const LIVE = { header_width: ["hwidth", "content"], footer_width: ["fwidth", "content"], header_layout: ["hl", "classic"], header_style: ["hstyle", "solid"], header_sticky: ["hsticky", "yes"], menu_style: ["menu", "text"],
  footer_layout: ["fl", "brand"], footer_tone: ["ft", "card"], footer_brand: ["fbrand", "logo"], footer_social: ["fsocial", "show"], footer_meta: ["fmeta", "show"], footer_size: ["fsize", "normal"] };

export default function ThemeFields({ fields, hint = "" }) {
  const [theme, setTheme] = useState(null);  // {values, schema}
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);
  useEffect(() => { api("/theme/").then(setTheme).catch((e) => setMsg(errorText(e))); }, []);
  if (msg) return <p className="alert">{msg}</p>;
  if (!theme) return <p className="muted"><Loading /></p>;
  const all = theme.schema.flatMap((g) => g.fields);
  const def = (k) => all.find((f) => f.key === k);
  const save = (values) => { clearTimeout(timer.current); timer.current = setTimeout(async () => { try { await api("/theme/", { method: "PUT", body: { values } }); setMsg(null); } catch (e) { setMsg(errorText(e)); } }, 250); };
  const set = (key, v) => {
    const values = { ...theme.values, [key]: v };
    setTheme({ ...theme, values });
    const a = LIVE[key];
    if (a && typeof document !== "undefined") document.documentElement.dataset[a[0]] = v || a[1];  // the page follows at once
    if (key === "content_w" && typeof document !== "undefined") document.documentElement.style.setProperty("--content-w", `${v}px`);
    save(values);
  };
  const cw = def("content_w");
  return (
    <div className="tf-wrap">
      {hint && <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{tx(hint)}</p>}
      {fields.map(([k, label, kind]) => {
        const f = def(k);
        if (!f) return null;
        const v = theme.values[k] ?? f.default;
        if (kind === "toggle") {
          return <label key={k} className="check sec-toggle"><span className="switch"><input type="checkbox" checked={v !== "hide"} onChange={(e) => set(k, e.target.checked ? "show" : "hide")} /><span /></span><span>{tx(label)}</span></label>;
        }
        if (kind === "width") {
          const full = v === "full";
          return (
            <section key={k} className="tf-sec">
              <h4>{tx(label)}</h4>
              <span className="pb-seg">
                {[["full", "Hele breedte (100%)"], ["content", "Maximale breedte"]].map(([val, l]) => <button type="button" key={val} className={(full ? "full" : "content") === val ? "on" : ""} onClick={() => set(k, val)}>{tx(l)}</button>)}
              </span>
              {!full && cw && (
                <label className="tf-max">{tx("Maximale breedte")} <small className="muted">{tx("(dezelfde voor de pagina's, het menu en de footer)")}</small>
                  <span className="tf-num"><input type="number" min={cw.min} max={cw.max} step={cw.step || 20} value={theme.values.content_w ?? cw.default} onChange={(e) => e.target.value !== "" && set("content_w", Number(e.target.value))} /><span className="muted">px</span></span>
                </label>
              )}
            </section>
          );
        }
        return <label key={k}>{tx(label)}<select value={v} onChange={(e) => set(k, e.target.value)}>{(f.choices || []).map((c) => <option key={c.value} value={c.value}>{tx(c.label)}</option>)}</select></label>;
      })}
    </div>
  );
}

// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { EditableText } from "./EditMode";
import { tx } from "../lib/t";

// The top of a member's dashboard page: the title and an opening text (editable, in every language; per theme where it matters),
// buttons for what to do next, and the numbers that matter at a glance.
let themeCache = "";
// the community theme (the colours of the banner follow it, like the hero of the website pages)
function useTheme() {
  const [t, setT] = useState(themeCache);
  useEffect(() => { if (!themeCache) api("/pages/layout/members/").then((d) => { themeCache = d.theme || "normal"; setT(themeCache); }).catch(() => {}); }, []);
  return t;
}

export default function DashHero({ title, textId, fallback = "", text = "", actions = [], stats = [] }) {
  const theme = useTheme();
  return (
    <>
      <section className="dash-hero" data-t={theme || undefined}>
        <div className="dash-hero-main">
          <h1>{tx(title)}</h1>
          {textId ? <EditableText id={textId} as="p" fallback={fallback} className="dash-hero-text" /> : <p className="dash-hero-text">{text}</p>}
          {actions.length > 0 && (
            <div className="dash-hero-actions">
              {actions.map((a, i) => <Link key={a.href} href={a.href} className={`btn ${i === 0 ? "primary" : ""}`}>{tx(a.label)}</Link>)}
            </div>
          )}
        </div>
      </section>
      {stats.length > 0 && (
        <div className="cards dash-stats" data-t={theme || undefined}>
          {stats.map((s) => {
            const body = (
              <>
                <span>{tx(s.label)}</span>
                <strong style={{ fontSize: "1.6rem" }}>{s.value ?? "…"}</strong>
                {s.hint && <small>{s.hint}</small>}
              </>
            );
            return s.href ? <Link key={s.label} href={s.href} className="card stat link-card">{body}</Link> : <div key={s.label} className="card stat">{body}</div>;
          })}
        </div>
      )}
    </>
  );
}

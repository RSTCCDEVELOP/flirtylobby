// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import { IconCheck, IconRefresh } from "../../../../components/Icons";
import Loading from "../../../../components/Loading";
import { useSystemUpdateRun } from "../../../../components/SystemUpdatePrompt";
import { api, errorText } from "../../../../lib/api";
import { lvl } from "../../../../lib/perms";
import { tx } from "../../../../lib/t";
import KitScope from "../../../../lib/ui-kit/KitScope";

// Admin -> Systeem -> Updates: the check that runs after every new build of easy2edit (copy of the content, database, plugins, themes, widgets, languages, pages, API links),
// but now whenever the administrator wants it. The same steps and the same progress window as after an update (components/SystemUpdatePrompt.js). Nothing of the content is removed.
const TINT = "color-mix(in srgb, var(--blue, #3b82f6) 7%, var(--card, #fff))";
const TINT_LINE = "color-mix(in srgb, var(--blue, #3b82f6) 18%, var(--line, #e2e8f0))";

export default function UpdatesPage() {
  const { user } = useAuth();
  const allowed = !!user && (user.is_staff || lvl(user, "system") >= 2);
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const { start, popup, running } = useSystemUpdateRun();
  useEffect(() => { if (allowed) api("/system/update/").then(setInfo).catch((e) => setErr(errorText(e))); }, [allowed]);
  if (!user) return <Loading compact />;
  if (!allowed) return <div className="alert">{tx("Geen toegang.")}</div>;
  if (!info) return err ? <div className="alert">{err}</div> : <Loading compact />;
  const needed = !!info.needed;
  return (
    <KitScope tag="ui-stat-row">
      <div className="page-head">
        <div>
          <h1>{tx("Updates")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Controleer je website en werk hem bij, zoals na een nieuwe versie van easy2edit: de database, de plugins, de thema's, de widgets, de talen en de pagina's.")}</p>
        </div>
      </div>
      {popup}
      <div data-easy2edit-tag="ui-stat-row" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between", padding: "1.1rem 1.3rem", border: `1px solid ${TINT_LINE}`, borderRadius: "var(--radius, 12px)", background: TINT, margin: "1rem 0" }}>
        <div style={{ display: "grid", gap: ".35rem", minWidth: 0 }}>
          <strong style={{ fontSize: "1.05rem" }}>{tx("easy2edit versie {0}, build {1}", info.version || "", info.build)}</strong>
          <span className="row" style={{ gap: ".5rem", flexWrap: "wrap" }}>
            <span className={`badge ${needed ? "warn" : "ok"}`} data-easy2edit-tag="ui-badges">{needed ? tx("Controle nodig") : tx("Gecontroleerd")}</span>
            <small className="muted">{info.checked != null ? tx("Laatst gecontroleerd voor build {0}.", info.checked) : tx("Nog niet gecontroleerd.")}</small>
          </span>
        </div>
        <button type="button" className="btn primary" disabled={running} data-help={tx("Controleert je website en werkt hem bij, net als na een nieuwe versie van easy2edit. Je ziet elke stap met een voortgangsbalk. Er wordt niets van je pagina's, ontwerpen en teksten overschreven.")} onClick={() => start(info.steps)}><IconRefresh /> {tx("Nu controleren en bijwerken")}</button>
      </div>
      <div className="card" data-easy2edit-tag="ui-record-list" style={{ padding: "1rem 1.2rem" }}>
        <h2 style={{ margin: "0 0 .6rem", fontSize: "1rem" }}>{tx("Wat wordt gecontroleerd")}</h2>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: ".15rem" }}>
          {(info.steps || []).map((s) => (
            <li key={s.key} style={{ display: "flex", alignItems: "center", gap: ".7rem", padding: ".55rem .2rem", borderTop: "1px solid var(--line, #e2e8f0)" }}>
              <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: "1.7rem", height: "1.7rem", borderRadius: "50%", background: TINT, color: "var(--blue, #3b82f6)", flex: "none" }}><IconCheck /></span>
              <span>{tx(s.label)}</span>
            </li>
          ))}
        </ul>
        <p className="muted" style={{ margin: ".8rem 0 0" }}>{tx("Je pagina's, ontwerpen en teksten worden eerst bewaard in de sitemap en blijven staan: er wordt niets overschreven.")}</p>
      </div>
    </KitScope>
  );
}

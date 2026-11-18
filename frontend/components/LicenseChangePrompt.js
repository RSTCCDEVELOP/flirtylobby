// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { alertDialog } from "../lib/dialog";
import { money } from "../lib/format";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { useModules } from "./Modules";
import { canAdmin } from "../lib/perms";
import KitScope from "../lib/ui-kit/KitScope";

// A module or plugin was switched on or off (the event "licence-maybe-changed" of lib/api.js): when that changes the price of the licence, ask whether to update the licence
// at the new price. Yes: the licence wizard opens in update mode (the costs with the new price, the agreement with a code, then the same licence runs on). No: nothing changes.
export default function LicenseChangePrompt() {
  const { user } = useAuth();
  const mods = useModules();
  const admin = !!user && (user.is_staff || canAdmin(user, mods));
  const [ch, setCh] = useState(null);
  useEffect(() => {
    if (!admin) return undefined;
    let t = 0;
    const check = (e) => {
      clearTimeout(t);
      const d = e?.detail || {};
      t = setTimeout(() => api(`/system/license/change/${d.item ? `?item=${encodeURIComponent(d.item)}&enabled=${d.enabled ? 1 : 0}` : ""}`).then((r) => {
        if (r?.changed) setCh({ ...r, item: r.item, which: d.item || "", enabled: !!d.enabled }); // the price changed: ask whether to update the licence
        else if (!d.enabled && r?.item && Number(r.item.price) > 0) alertDialog(tx("{0} kost {1} per maand (incl. btw). De licentie is hier al op berekend.", r.item.label, money(r.item.price)));
        else if (d.enabled && r?.item && Number(r.item.price) <= 0) alertDialog(tx("{0} kost niets: hij zit in je licentie of in de standaard installatie.", r.item.label)); // switched on and free: say so
        else if (d.enabled && r?.item) alertDialog(tx("{0} kost {1} per maand (incl. btw). De licentie is hier al op berekend.", r.item.label, money(r.item.price)));
      }).catch(() => {}), 900);
    };
    window.addEventListener("licence-maybe-changed", check);
    return () => { clearTimeout(t); window.removeEventListener("licence-maybe-changed", check); };
  }, [admin]);
  if (!ch || typeof document === "undefined") return null;
  const act = ch.action;  // what this switch did (switched on = more expensive, switched off = cheaper); without it the difference with the licence
  const up = Number(act ? act.delta : ch.delta) > 0;
  const old = act ? act.old : ch.old, nw = act ? act.new : ch.new, dl = act ? act.delta : ch.delta;
  // "Nu niet": the switch is undone (a plugin or module that was switched on goes off again, and the other way round)
  const undo = async () => {
    const c = ch;
    setCh(null);
    const [kind, key] = String(c.which || "").split(":");
    if (!key) return;
    window.__licenceRevert = true;  // (lib/api.js does not ask again for this change)
    try { await api(kind === "plugin" ? `/plugins/${key}/` : `/modules/${key}/`, { method: "PATCH", body: { enabled: !c.enabled } }); window.__licenceRevert = false; window.dispatchEvent(new Event("licence-reverted")); }
    catch (e) { window.__licenceRevert = false; alertDialog(errorText(e)); }
  };
  const yes = () => { const c = ch; setCh(null); window.dispatchEvent(new CustomEvent("open-setup-wizard", { detail: { mode: "update", change: c } })); };
  return createPortal(
    <div className="overlay" style={{ zIndex: 3050 }} role="dialog" aria-modal="true" aria-label={tx("Licentie bijwerken")}>
      <div className="card modal" style={{ maxWidth: 480, width: "100%", padding: "1.5rem 1.7rem" }}>
        <KitScope tag="ui-alerts">
          <div className="e2e-stack" style={{ gap: "1rem" }}>
            <h2 style={{ margin: 0 }}>{up ? tx("De licentie wordt duurder") : tx("De licentie wordt goedkoper")}</h2>
            {ch.item && <p style={{ margin: 0 }}><strong>{ch.item.label}</strong>: {Number(ch.item.price) > 0 ? `${money(ch.item.price)} ${tx("per maand")} · ${tx("incl. btw")}` : tx("kost niets")}</p>}
            <p style={{ margin: 0 }}>{up ? tx("Door deze wijziging kost je licentie meer.") : tx("Door deze wijziging kost je licentie minder.")} {tx("Wil je de licentie bijwerken?")}</p>
            <div className="e2e-grid" style={{ "--e2e-min": "120px" }}>
              <div className="e2e-field" data-easy2edit-tag="ui-kpi"><span className="e2e-hint">{tx("Nu")}</span><strong style={{ fontSize: "1.3rem" }}>{money(old)}</strong><span className="e2e-hint">{tx("per maand")}</span></div>
              <div className="e2e-field" data-easy2edit-tag="ui-kpi"><span className="e2e-hint">{tx("Nieuw")}</span><strong style={{ fontSize: "1.3rem" }}>{money(nw)}</strong><span className="e2e-hint">{up ? "+" : ""}{money(dl)} · {tx("incl. btw")}</span></div>
            </div>
            {ch.which && <span className="e2e-hint">{tx("Kies je Nu niet, dan wordt de wijziging teruggezet.")}</span>}
            {act && Math.abs(Number(ch.billed) - Number(old)) > 0.005 && <span className="e2e-hint">{tx("Je licentie is nu berekend op {0} per maand.", money(ch.billed))}</span>}
            <div className="e2e-row" style={{ justifyContent: "flex-end", gap: ".6rem" }}>
              <button type="button" className="e2e-btn e2e-btn--outline" onClick={undo}>{ch.which ? tx("Nu niet: terugzetten") : tx("Nu niet")}</button>
              <button type="button" className="e2e-btn" onClick={yes}>{tx("Licentie bijwerken")}</button>
            </div>
          </div>
        </KitScope>
      </div>
    </div>, document.body);
}

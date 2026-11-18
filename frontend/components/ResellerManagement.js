// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { IconBriefcase, IconX } from "./Icons";
import ResellerAdmin from "./ResellerAdmin";
import SuperTile from "./SuperTile";

// The tile "Reseller management" (Super admin) and its pop-up. Only for a superadmin+, and only on the installation that is the easy2edit server (Site manager: "This installation is the easy2edit server").
export default function ResellerManagement() {
  const { user } = useAuth();
  const plus = !!user?.is_superadmin_plus;
  const [server, setServer] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (plus) api("/system/sites/").then((r) => setServer(!!r?.me?.server)).catch(() => setServer(false)); }, [plus]);
  if (!plus || !server) return null;
  return (
    <>
      <SuperTile icon={IconBriefcase} label={tx("Resellers")} title={tx("Reseller management")} text={tx("Resellers met contactpersonen, marge, websites en logins")}
        footer={<button type="button" className="btn sm primary" onClick={() => setOpen(true)}>{tx("Openen")}</button>} />
      {open && createPortal(
        <div className="overlay" style={{ zIndex: 3000 }} onClick={() => setOpen(false)}>
          <div className="card modal wide" role="dialog" aria-label={tx("Reseller management")} style={{ width: "min(1000px, 96vw)", maxWidth: "96vw", maxHeight: "92vh", overflow: "auto", padding: "1.3rem 1.6rem" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0 }}>{tx("Reseller management")}</h2>
              <button type="button" className="btn sm" aria-label={tx("Sluiten")} onClick={() => setOpen(false)}><IconX width={16} height={16} /></button>
            </div>
            <ResellerAdmin />
          </div>
        </div>, document.body)}
    </>
  );
}

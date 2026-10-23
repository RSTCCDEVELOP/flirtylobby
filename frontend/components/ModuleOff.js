// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tx } from "../lib/t";
import { api, errorText } from "../lib/api";
import { useAuth } from "./AuthContext";
import { enableWithDialog } from "../lib/enable";

// Message for a module that is switched off. A superadmin gets a button to switch it on right here
// (a module that is part of a plugin: pass `plugin`, then the plugin is switched on).
export default function ModuleOff({ module, plugin, related, label, children }) {
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const enable = async () => {
    setBusy(true); setError("");
    try {
      let needs = [];
      if (plugin) { // the plugins this one needs are switched on with it
        const p = (await api("/plugins/")).plugins?.find?.((x) => x.name === plugin);
        needs = (p?.requires_off || []).map((x) => x.title);
      }
      const ok = await enableWithDialog({ title: tx("Aanzetten"), message: tx("Wil je {0} aanzetten?", label || module || plugin), related: related || plugin || module, needs }, async () => {
        if (plugin) { await api(`/plugins/${plugin}/`, { method: "PATCH", body: { enabled: true, with_requires: true } }); window.dispatchEvent(new Event("plugins-changed")); }
        else await api(`/modules/${module}/`, { method: "PATCH", body: { enabled: true } });
      });
      if (ok) { setDone(true); router.refresh(); }
    } catch (e) { setError(errorText(e)); }
    setBusy(false);
  };
  return (
    <div>
      <p className="muted">{children} {user?.is_staff && !done && <button type="button" className="btn sm" disabled={busy} onClick={enable}>{tx("Nu aanzetten")}</button>}</p>
      {error && <div className="alert">{error}</div>}
    </div>
  );
}

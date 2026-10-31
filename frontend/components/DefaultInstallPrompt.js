// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { tx } from "../lib/t";
import { confirmDialog } from "../lib/dialog";
import { api, errorText } from "../lib/api";
import { runDemo, resumeDemo } from "../lib/demoRun";
import Link from "next/link";
import { useAuth } from "./AuthContext";
import Tabs from "./Tabs";
import { useSandboxFirst } from "../lib/firstRun";
import AiFillAsk from "./AiFillAsk";
import RunPopup from "./RunPopup";

// Superadmin, after logging in: nothing is installed yet? Then ask to install the default standard installation (marked at Standaard installaties).
// "Later" keeps it quiet for this session; it comes back at the next login until an installation is set.
const KEY = "default-install-later";

export default function DefaultInstallPrompt() {
  const { user } = useAuth();
  const [ask, setAsk] = useState(null); // {presets: [{key, name, desc}]}: the ones offered, one is chosen
  const [pick, setPick] = useState("");
  const [demo, setDemo] = useState(false);
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");
  const first = useSandboxFirst(!!user?.is_staff); // the question about the sandbox (on your own computer) comes first
  const [tab, setTab] = useState("install");
  const [fillAsk, setFillAsk] = useState(false); // after the installation: fill the website with AI? (then straight to buying AI credit)
  const [aiOn, setAiOn] = useState(null); // is an AI link installed? (then the website can be filled with AI)

  useEffect(() => {
    if (!user?.is_staff || !first.known || first.pending) return;
    try { if (sessionStorage.getItem(KEY)) return; } catch {}
    api("/ai/me/").then((i) => setAiOn(!!i.module)).catch(() => setAiOn(false));
    api("/system/presets/setup/").then((r) => { if (r.needed) { setAsk(r); setPick(r.presets[0]?.key || ""); } }).catch(() => {});
  }, [user?.is_staff, first.known, first.pending]);

  const later = () => { try { sessionStorage.setItem(KEY, "1"); } catch {} setAsk(null); };

  // Pages that already have content are never replaced without asking: the answer "Nee, behouden" keeps every page as it is
  const askOverwrite = async (key) => {
    try {
      const c = await api(`/system/presets/${key}/apply/`, { method: "POST", body: { check: true } });
      if (!c.conflicts?.length) return false;
      return await confirmDialog(tx("Deze pagina's hebben al inhoud: {0}. Overschrijven met de standaard van deze installatie? Kies \"Nee, behouden\" om je pagina's en teksten te laten zoals ze zijn.", c.conflicts.map((x) => x.title).join(", ")), { danger: true, okLabel: tx("Ja, overschrijven"), cancelLabel: tx("Nee, behouden") });
    } catch { return false; }
  };
  const install = async () => {
    const p = ask.presets.find((x) => x.key === pick) || ask.presets[0];
    setAsk(null); setError("");
    const overwrite = await askOverwrite(p.key);
    setRun({ title: tx("Installatie \"{0}\" instellen", p.name), steps: [{ key: "_apply", label: tx("Modules, plugins en thema instellen"), status: "busy" }], error: "", done: false });
    try {
      const r = await api(`/system/presets/${p.key}/apply/`, { method: "POST", body: { overwrite_pages: overwrite } });
      let note = tx("{0} is ingesteld: {1} modules en {2} plugins staan aan.", p.name, r.modules_on.length, r.plugins_on.length) + (r.payments_warning ? ` ${tx(r.payments_warning)}` : "") + (r.plugins_installed?.length ? ` ${tx("Uit de bibliotheek geïnstalleerd:")} ${r.plugins_installed.join(", ")}.` : "") + (r.plugins_missing?.length ? ` ${tx("Niet geïnstalleerd:")} ${r.plugins_missing.join(", ")}.` : "");
      setRun((x) => ({ ...x, steps: x.steps.map((st) => (st.key === "_apply" ? { ...st, status: "ok" } : st)) }));
      let ok = true;
      if (demo) { ok = await runDemo(p.key, {}, setRun); if (ok) note += ` ${tx("De demo-gegevens zijn gemaakt.")}`; }
      setRun((x) => ({ ...x, done: ok, note }));
    } catch (e) { setRun((x) => ({ ...x, steps: x.steps.map((st) => (st.status === "busy" ? { ...st, status: "error" } : st)), error: errorText(e) })); }
  };

  return (
    <>
      <RunPopup run={run} onFix={() => resumeDemo(run, setRun)} onClose={() => { const ok = run?.done && !run?.error; setRun(null); if (ok && aiOn !== false) setFillAsk(true); else window.location.reload(); }} />
      {fillAsk && <AiFillAsk onNo={() => window.location.reload()} />}
      {ask && (
        <div className="overlay" role="dialog" aria-modal="true" onClick={later}>
          <div className="card modal form" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0 }}>{tx("Standaard installatie")}</h2>
            <Tabs value={tab} onChange={setTab} tabs={[["install", "Installatie"], ["ai", "Vullen met AI"]]} />
            {tab === "install" && (<>
              <p style={{ margin: 0 }}>{ask.presets.length > 1 ? tx("Er is nog geen installatie ingesteld. Welke installatie wil je nu installeren? Je kunt er één kiezen.") : tx("Er is nog geen installatie ingesteld. Wil je de standaard installatie \"{0}\" nu installeren?", ask.presets[0].name)}</p>
              {ask.presets.length > 1 ? ask.presets.map((p) => (
                <label key={p.key} className="check">
                  <input type="radio" name="default-install" checked={pick === p.key} onChange={() => setPick(p.key)} />
                  <span><strong>{tx(p.name)}</strong>{p.desc && <><br /><small className="muted">{tx(p.desc)}</small></>}</span>
                </label>
              )) : ask.presets[0].desc && <p className="muted" style={{ margin: 0 }}>{tx(ask.presets[0].desc)}</p>}
              <label className="check sec-toggle">
                <span className="switch"><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /><span /></span>
                <span>{tx("Demo-gegevens direct installeren")} <small className="muted">{tx("Voorbeeldplaatjes, gebruikers, inhoud, systeemobjecten en bestellingen om alles te testen. Wat al aanwezig is, wordt niet dubbel gemaakt.")}</small></span>
              </label>
              <small className="muted">{tx("De huidige startpagina wordt vervangen door de startpagina van deze installatie (niet gecombineerd). Verwijder je de installatie, dan komt je oude startpagina terug.")}</small>
              <small className="muted">{tx("Een andere installatie kiezen kan bij Super admin → Standaard installaties.")}</small>
            </>)}
            {tab === "ai" && (<>
              <p style={{ margin: 0 }}>{tx("Je hoeft de website niet zelf te vullen: dat kan met AI.")}</p>
              <ul className="ai-howlist">
                <li><strong>{tx("Een bestaande website of ontwerp overnemen")}:</strong> {tx("sleep een of meer HTML-bestanden in Admin > Site importeren. De AI maakt het thema, de pagina's, de inhoud en de plaatjes, zet de modules aan die nodig zijn (zoals FAQ) en bouwt de pagina's desgewenst met bewerkbare blokken na.")}</li>
                <li><strong>{tx("Teksten schrijven en vertalen")}:</strong> {tx("paginanamen en teksten vertaal je met één klik naar alle talen van de website.")}</li>
                <li><strong>{tx("Verbeteren met een opdracht")}:</strong> {tx("geef de AI een opdracht (bijvoorbeeld: maak de koppen groter) en laat een pagina opnieuw opbouwen uit het origineel.")}</li>
              </ul>
              <div className={aiOn ? "alert ok" : "alert"} style={{ margin: 0 }}>{aiOn ? tx("Er is een AI-koppeling: je kunt na de installatie meteen beginnen.") : tx("Er is nog geen AI-koppeling. Zet er een aan bij Admin > API keys (Anthropic), dan kun je de website met AI vullen.")}</div>
              <small className="muted">{tx("Elke AI-opdracht wordt gemeten. Gebruikers en admins hebben AI-tegoed nodig; superadmins niet.")}</small>
              {!aiOn && <div><Link className="btn" href="/dashboard/admin/integrations" onClick={later}>{tx("Naar API keys")}</Link></div>}
            </>)}
            {error && <div className="alert">{error}</div>}
            <div className="row">
              <button type="button" className="btn" onClick={later}>{tx("Later")}</button>
              <button type="button" className="btn primary" onClick={install}>{tx("Installeren")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

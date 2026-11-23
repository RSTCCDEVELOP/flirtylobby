// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../../../../lib/api";
import { tx } from "../../../../lib/t";
import { useAuth } from "../../../../components/AuthContext";
import Loading from "../../../../components/Loading";
import { IconLeaf } from "../../../../components/Icons";
import { SpeedRuns, SpeedTestPopup } from "../../../../components/SpeedTest";

const SECONDS = [15, 30, 60, 120, 300, 600, 1800, 3600];
const label = (s) => (s >= 60 ? `${s / 60} ${s === 60 ? tx("minuut") : tx("minuten")}` : `${s} ${tx("seconden")}`);
const NAMES = { database: "Database (standaard)", memory: "Geheugen (per proces)", redis: "Redis" };

// Admin -> Systeem -> Cache en snelheid: the system cache keeps the answers every visitor asks for a moment, so the website does less work: faster and greener.
export default function CachePage() {
  const { user } = useAuth();
  const [c, setC] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [speed, setSpeed] = useState(false);  // the pop-up with the live speed test
  const [runKey, setRunKey] = useState(0);  // a new recording: the list is read again
  useEffect(() => { api("/system/cache/").then(setC).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, []);
  const send = async (name, method, body, ok) => {
    setBusy(name); setMsg(null);
    try { setC(await api("/system/cache/", { method, body })); setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  if (!c) return msg ? <div className="alert">{msg.text}</div> : <Loading compact />;
  const on = !!c.system_cache;
  const secs = Number(c.system_cache_seconds) || 60;
  const pon = c.page_cache !== false;
  const psecs = Number(c.page_cache_seconds) || 60;
  return (
    <div className="eco">
      <h1>{tx("Cache en snelheid")}</h1>
      <p className="muted" style={{ marginTop: 0 }}>{tx("De website bewaart de antwoorden die elke bezoeker vraagt even. Zo hoeft de server minder te rekenen: de pagina's laden sneller en er is minder stroom nodig. Een wijziging die je opslaat is meteen zichtbaar.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} role="status">{msg.text}</div>}
      <div className="eco-cols two">
        <div className="card eco-form" style={{ gridTemplateColumns: "1fr" }}>
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={on} disabled={!!busy} onChange={(e) => send("on", "PUT", { system_cache: e.target.checked }, e.target.checked ? tx("De cache staat aan.") : tx("De cache staat uit."))} /><span /></span><span>{tx("Cache gebruiken")}<br /><small className="muted">{tx("Aanbevolen: sneller en zuiniger.")}</small></span></label>
          <label style={{ opacity: on ? 1 : .5 }}>{tx("Bewaren gedurende")}
            <select value={SECONDS.includes(secs) ? secs : 60} disabled={!on || !!busy} onChange={(e) => send("secs", "PUT", { system_cache_seconds: e.target.value }, tx("Opgeslagen."))}>{SECONDS.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
            <small className="muted">{tx("Langer is zuiniger; elke wijziging die je opslaat maakt de cache toch meteen weer vers.")}</small>
          </label>
          <div className="row" style={{ justifyContent: "flex-start", gap: ".6rem", flexWrap: "wrap" }}>
            {[[15, "Altijd vers"], [60, "Gebalanceerd"], [600, "Groen"]].map(([n, l]) => <button key={n} type="button" className={`btn sm${on && secs === n ? " primary" : ""}`} disabled={!!busy} onClick={() => send("pre", "PUT", { system_cache: true, system_cache_seconds: String(n) }, tx("Opgeslagen."))}>{tx(l)} · {label(n)}</button>)}
          </div>
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: ".9rem", display: "grid", gap: ".7rem" }}>
            <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={pon} disabled={!!busy} onChange={(e) => send("pon", "PUT", { page_cache: e.target.checked }, e.target.checked ? tx("De paginacache staat aan.") : tx("De paginacache staat uit."))} /><span /></span><span>{tx("Snelle pagina's (paginacache)")}<br /><small className="muted">{tx("De webserver onthoudt de gegevens die elke pagina nodig heeft (thema, menu, talen, modules). Zo hoeft een pagina ze niet steeds opnieuw bij de backend te vragen en staat hij sneller op het scherm. Aanbevolen.")}</small></span></label>
            <label style={{ opacity: pon ? 1 : .5 }}>{tx("Paginacache bewaren gedurende")}
              <select value={[10, 30, 60, 300, 600].includes(psecs) ? psecs : 60} disabled={!pon || !!busy} onChange={(e) => send("psecs", "PUT", { page_cache_seconds: e.target.value }, tx("Opgeslagen."))}>{[10, 30, 60, 300, 600].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
              <small className="muted">{tx("Elke wijziging die je opslaat maakt de paginacache meteen weer vers.")}</small>
            </label>
          </div>
          <div className="row" style={{ justifyContent: "flex-start", gap: ".6rem", flexWrap: "wrap" }}><button type="button" className="btn" disabled={!!busy} onClick={() => send("clear", "POST", {}, tx("De cache is gewist."))}>{busy === "clear" ? tx("Bezig…") : tx("Cache nu wissen")}</button><button type="button" className="btn primary" onClick={() => setSpeed(true)}>{tx("Snelheidstest starten")}</button></div>
        </div>
        <div className="card eco-treebox" style={{ display: "grid", gap: ".5rem", alignContent: "start" }}>
          <span className="eco-ic" style={{ position: "static" }} aria-hidden="true"><IconLeaf /></span>
          <strong>{on ? tx("Je website werkt nu zuiniger") : tx("Zet de cache aan om sneller en groener te zijn")}</strong>
          <small>{tx("Met de cache vraagt de website veel minder aan de database. Dat scheelt rekentijd en stroom bij elk bezoek, en de pagina's staan eerder op het scherm.")}</small>
          <small className="muted">{tx("Gebruikte opslag")}: {tx(NAMES[c.backend] || c.backend)}{user?.is_staff ? ` · ${tx("Wijzigen kan bij Basisgegevens.")}` : ""} · {c.live === "ok" ? tx("werkt") : tx("probleem")}</small>
        </div>
      </div>
      <SpeedRuns refreshKey={runKey} />
      {speed && <SpeedTestPopup onClose={() => setSpeed(false)} onSaved={() => setRunKey((n) => n + 1)} />}
    </div>
  );
}

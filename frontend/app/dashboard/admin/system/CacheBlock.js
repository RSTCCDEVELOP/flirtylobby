// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import Collapsible from "../../../../components/Collapsible";
import { api, errorText } from "../../../../lib/api";
import { tx } from "../../../../lib/t";
import Loading from "../../../../components/Loading";
import { confirmDialog } from "../../../../lib/dialog";
import { useAuth } from "../../../../components/AuthContext";

// Admin -> Basisgegevens -> Cache. Two parts: the system cache (on/off and how long: saved with the form, like the other settings)
// and the cache itself that the server uses (database = standard, memory, redis: saved apart, takes effect after a restart).
const NAMES = { database: "Database (standaard)", memory: "Geheugen (per proces)", redis: "Redis" };
const WHY = {
  database: "Alle processen van de server delen deze cache, zonder extra programma. De limieten per uur en de inlogtijd werken hiermee goed.",
  memory: "Elk proces heeft zijn eigen cache. Prima voor ontwikkeling of één proces; bij meerdere processen tellen de limieten per proces.",
  redis: "Een aparte, snelle cache in een Redis-server die alle processen delen. Vul het adres in.",
};
const SECONDS = [15, 30, 60, 120, 300, 600, 1800, 3600];

export default function CacheBlock({ form, setForm }) {
  const [c, setC] = useState(null);
  const [backend, setBackend] = useState("database");
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const { user } = useAuth();
  // restart the server (a superadmin): a graceful reload; then wait until the server answers again and load the page again
  const restart = async () => {
    if (!(await confirmDialog(tx("De server herstarten? De website is een paar seconden niet bereikbaar."), { okLabel: tx("Herstarten"), cancelLabel: tx("Annuleren") }))) return;
    setBusy("restart"); setMsg(null);
    try { await api("/system/restart/", { method: "POST", body: {} }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); setBusy(""); return; }
    setMsg({ ok: true, text: tx("De server wordt herstart…") });
    let back = false;
    for (let i = 0; i < 40 && !back; i += 1) {
      await new Promise((r) => setTimeout(r, 1500));
      try { await api("/system/cache/"); back = i > 1; } catch { /* the server is still restarting */ }
    }
    if (back) window.location.reload(); else { setMsg({ ok: false, text: tx("De server antwoordt nog niet. Ververs de pagina over een moment.") }); setBusy(""); }
  };
  const read = (r) => { setC(r); setBackend(r.saved.backend); setUrl(r.saved.redis_url || (r.saved.backend === "redis" ? "redis://localhost:6379/1" : "")); };
  useEffect(() => { api("/system/cache/").then(read).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, []);

  const run = async (name, method, body, ok) => {
    setBusy(name); setMsg(null);
    try { const r = await api("/system/cache/", { method, body }); read(r); setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } finally { setBusy(""); }
  };
  const on = form.system_cache !== false;
  const secs = Number(form.system_cache_seconds || 60);

  return (
    <Collapsible id="sys-cache" title={tx("Cache")}>
      <div className="cache-cols">
        <section className="cache-card" style={{ display: "grid", gap: ".6rem", alignContent: "start" }}>
          <h4 style={{ margin: 0 }}>{tx("Systeemcache")}</h4>
          <p className="muted" style={{ margin: 0 }}>{tx("De instellingen en de openbare antwoorden die elke bezoeker vraagt worden even bewaard. Zo doet de website minder database-vragen: sneller en zuiniger. Een wijziging van een beheerder wist de cache meteen. Standaard aan, 5 minuten.")}</p>
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={on} onChange={(e) => setForm({ ...form, system_cache: e.target.checked })} /><span /></span><span>{tx("Systeemcache gebruiken")}</span></label>
          <label style={{ maxWidth: 280, opacity: on ? 1 : .5 }}>{tx("Bewaren gedurende")}
            <select value={SECONDS.includes(secs) ? secs : 60} disabled={!on} onChange={(e) => setForm({ ...form, system_cache_seconds: e.target.value })}>
              {SECONDS.map((s) => <option key={s} value={s}>{s >= 60 ? `${s / 60} ${s === 60 ? tx("minuut") : tx("minuten")}` : `${s} ${tx("seconden")}`}</option>)}
            </select>
          </label>
          <div><button type="button" className="btn sm" disabled={!!busy} onClick={() => run("clear", "POST", {}, tx("De systeemcache is gewist."))}>{busy === "clear" ? tx("Bezig…") : tx("Cache nu wissen")}</button></div>
        </section>

        <section className="cache-card" style={{ display: "grid", gap: ".6rem", alignContent: "start" }}>
          <h4 style={{ margin: 0 }}>{tx("Welke cache de server gebruikt")}</h4>
          {!c ? <p className="muted">{<Loading compact />}</p> : (
            <>
              <p className="muted" style={{ margin: 0 }}>{tx("In gebruik")}: <strong>{tx(NAMES[c.backend] || c.backend)}</strong> · {c.works ? tx("werkt") : tx("werkt niet")}{c.shared ? "" : ` · ${tx("niet gedeeld")}`}</p>
              <div role="radiogroup" aria-label={tx("Cache")} style={{ display: "grid", gap: ".5rem", opacity: c.locked_by_env ? .5 : 1 }}>
                {c.backends.map((k) => (
                  <label key={k} className="check sec-toggle"><span><input type="radio" name="cache_backend" checked={backend === k} disabled={c.locked_by_env} onChange={() => setBackend(k)} /></span><span><strong>{tx(NAMES[k])}</strong><br /><small className="muted">{tx(WHY[k])}</small></span></label>
                ))}
              </div>
              {backend === "redis" && <label>{tx("Adres van Redis")}<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="redis://localhost:6379/1" disabled={c.locked_by_env} /><small className="muted">{tx("Leeg laten: de Redis op deze server (redis://localhost:6379/1).")}</small></label>}
              {c.locked_by_env && <p className="muted" style={{ margin: 0 }}>{tx("Deze keuze staat vast in de omgeving van de server (CACHE_BACKEND).")}</p>}
              {c.fallback && <p style={{ margin: 0, color: "var(--danger, #dc2626)" }} role="alert">{tx("Redis antwoordt niet: de server gebruikt tijdelijk de database. Start Redis of kies een andere cache.")}</p>}
              {c.restart_needed && <p style={{ margin: 0, color: "var(--warn, #d97706)" }}>{tx("Opgeslagen. De nieuwe cache gaat in na een herstart van de server.")}</p>}
              {user?.is_staff && <div><button type="button" className={`btn sm${c.restart_needed ? " primary" : ""}`} disabled={!!busy} onClick={restart}>{busy === "restart" ? tx("Bezig…") : tx("Server nu herstarten")}</button></div>}
              <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
                <button type="button" className="btn sm" disabled={!!busy || c.locked_by_env} onClick={() => run("save", "PUT", { backend, redis_url: url }, tx("Opgeslagen."))}>{busy === "save" ? tx("Bezig…") : tx("Cache opslaan")}</button>
                <button type="button" className="btn sm" disabled={!!busy || c.locked_by_env} onClick={() => { setBackend(c.standard); setUrl(""); run("save", "PUT", { backend: c.standard, redis_url: "" }, tx("Standaard teruggezet.")); }}>{tx("Standaard")}</button>
              </div>
            </>
          )}
        </section>
        {msg && <p style={{ margin: 0, color: msg.ok ? "var(--ok, #16a34a)" : "var(--bad, #dc2626)" }}>{msg.text}</p>}
      </div>
    </Collapsible>
  );
}

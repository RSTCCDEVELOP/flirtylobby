// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import { IconBolt, IconCheck, IconSparkle } from "./Icons";
import { fmtBytes, fmtG, Rating } from "./EnergyBlocks";
import Loading from "./Loading";
import { useAuth } from "./AuthContext";

// The text of every piece of advice: what it is, and for the ones that cannot be applied here: how to do it.
const TEXT = {
  fonts: ["Gebruik het systeemlettertype", "Lettertypen van Google worden bij elk paginabezoek van een ander adres opgehaald. Het systeemlettertype kost geen data en staat meteen op het scherm. Het uiterlijk van de letters kan daardoor veranderen."],
  images: ["Maak zware afbeeldingen lichter", "Foto's in de bibliotheek die zwaarder zijn dan nodig worden verkleind en lichter opgeslagen. De originelen blijven bewaard, zodat je ze kunt terugzetten. Namen en adressen van de foto's blijven gelijk."],
  image_limit: ["Beperk de grootte van nieuwe uploads", "Een lagere limiet voorkomt dat er weer zware foto's op de website komen."],
  system_cache: ["Zet de systeemcache aan en op 5 minuten", "De instellingen en de openbare antwoorden die elke bezoeker vraagt worden even bewaard, zodat de website minder database-vragen doet: sneller en zuiniger. Een wijziging van een beheerder wist de cache meteen. Je stelt dit af bij Admin → Basisgegevens → Cache."],
  compression: ["Zet compressie aan op de server", "Tekstbestanden (scripts, stijlen, html) worden zonder compressie verstuurd. Met gzip of brotli worden ze ongeveer 70% lichter. Dit stel je in op de server, niet hier."],
  production: ["Meet op de echte website, niet op de ontwikkelversie", "De ontwikkelserver stuurt veel zwaarder JavaScript dan de echte website. Zet de website in productie en meet daar: het cijfer is dan veel lager."],
  cache_backend: ["Gebruik de snelste cache (Redis)", "Redis draait op deze server en is sneller dan de database. Alle processen delen hem. Na het toepassen is een herstart van de server nodig."],
  heavy: ["Zwaarste pagina's", "Deze pagina's wegen meer dan 80% van een gemiddelde webpagina. Kijk er naar de afbeeldingen, video's en blokken."],
};
const HOWTO = {
  compression: "# nginx\ngzip on;\ngzip_min_length 1024;\ngzip_types text/css application/javascript application/json image/svg+xml;\n\n# Next.js (frontend): standaard aan in productie (compress: true)\n# Coolify / Traefik: zet de compress-middleware aan",
  production: "cd frontend\nnpm run build\nnpm start\n\n# en zet bij Admin → Basisgegevens de omgeving op Productie",
};
export { TEXT as ADVICE_TEXT };
export { STATUS as ADVICE_STATUS };
const STATUS = { todo: ["Te doen", "badge off"], applied: ["Toegepast", "badge ok"], manual: ["Handmatig", "badge off"], ok: ["Goed", "badge ok"], info: ["Let op", "badge off"], unknown: ["Nog niet gemeten", "badge"] };

function Score({ label, s, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: ".7rem" }}>
      <Rating r={s.rating} size={52} />
      <div><small className="muted" style={{ display: "block" }}>{label}</small><strong>{fmtG(s.co2_g)}</strong> <small className="muted">· {fmtBytes(s.avg_bytes)}</small>{sub && <small className="muted" style={{ display: "block" }}>{sub}</small>}</div>
    </div>
  );
}

// An AI prompt for one advice (or for the whole page): the problem, what is measured and what has to be done, ready to paste into an AI assistant. It goes to the clipboard.
async function toClipboard(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* an older browser or no permission: the old way */ }
  try { const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok; } catch { return false; }
}
const promptFor = (i, d) => {
  const [title, what] = TEXT[i.key] || [i.key, ""];
  const lines = [
    "Je helpt me een website sneller en groener te maken. De website draait op easy2edit (Django-backend, Next.js-frontend).",
    "",
    `Verbeterpunt: ${tx(title)}`,
    `Uitleg: ${tx(what)}`,
    `Status: ${tx((STATUS[i.status] || STATUS.info)[0])}`,
    ...(i.detail?.length ? ["Meetgegevens:", ...i.detail.map((x) => `- ${x}`)] : []),
    ...(i.saving > 0 ? [`Verwachte winst: ongeveer ${fmtBytes(i.saving)} per pagina`] : []),
    `Huidige score: ${d.current.rating} (${fmtG(d.current.co2_g)} CO2 per paginabezoek, ${fmtBytes(d.current.avg_bytes)} per pagina)`,
    ...(HOWTO[i.key] ? ["", "Voorbeeld van de aanpak:", HOWTO[i.key]] : []),
    "",
    "Wat ik van je vraag:",
    "1. Leg kort uit wat hier de oorzaak van is en wat het effect is op snelheid en energiegebruik.",
    "2. Geef de concrete stappen of de code/instellingen om dit te verbeteren, in de volgorde waarin ik ze uitvoer.",
    "3. Zeg hoe ik controleer dat het gelukt is en hoe ik het kan terugzetten.",
    "Houd rekening met een productieserver (Docker, gunicorn) en wijzig niets zonder dat ik het eerst weet.",
  ];
  return lines.join("\n");
};
const promptAll = (items, d) => [
  "Je helpt me een website sneller en groener te maken. De website draait op easy2edit (Django-backend, Next.js-frontend).",
  `Huidige score: ${d.current.rating} (${fmtG(d.current.co2_g)} CO2 per paginabezoek, ${fmtBytes(d.current.avg_bytes)} per pagina).`,
  "", "Openstaande verbeterpunten:",
  ...items.filter((i) => ["todo", "manual", "info"].includes(i.status)).map((i, n) => `${n + 1}. ${tx((TEXT[i.key] || [i.key])[0])}${i.detail?.length ? ` (${i.detail.join("; ")})` : ""}${i.saving > 0 ? ` - winst ongeveer ${fmtBytes(i.saving)} per pagina` : ""}`),
  "", "Maak een plan: zet ze in een verstandige volgorde (grootste winst en kleinste risico eerst), geef per punt de concrete stappen en leg uit hoe ik het controleer en terugzet. Wijzig niets zonder dat ik het eerst weet.",
].join("\n");
function PromptButton({ text, label }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn sm adv-prompt" title={tx("Kopieer een AI-prompt voor dit punt naar het klembord")} onClick={async () => { if (await toClipboard(typeof text === "function" ? text() : text)) { setDone(true); setTimeout(() => setDone(false), 2200); } }}>
      {done ? <><IconCheck width={14} height={14} /> {tx("Prompt gekopieerd")}</> : <><IconSparkle width={14} height={14} /> {label || tx("AI-prompt")}</>}
    </button>
  );
}

// Admin → Energie → Advies: what makes the pages heavy, the settings that improve the score, and a button that applies them (and puts them back).
export default function EnergyAdvice({ onChanged, onMeasure, measuring }) {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [run, setRun] = useState(null);
  const { user } = useAuth();
  const [sel, setSel] = useState({ fonts: true, images: true, image_limit: true, system_cache: true, cache_backend: true });
  const [img, setImg] = useState({ threshold_kb: 300, max_edge: 2000, quality: 82, keep_originals: true });
  const [mb, setMb] = useState(2);
  const timer = useRef(null);
  const load = useCallback(() => api("/admin/energy/advice/").then(setD).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { // other picture settings: the saving is calculated again
    if (!d) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => api("/admin/energy/advice/", { method: "POST", body: { params: img } }).then(setD).catch(() => {}), 500);
    return () => clearTimeout(timer.current);
  }, [img.threshold_kb, img.max_edge, img.quality]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <p className="muted">{msg ? msg.text : <Loading compact />}</p>;
  const items = d.items, todo = items.filter((i) => i.applicable && i.status === "todo");
  const chosen = todo.filter((i) => sel[i.key]);
  const open = items.filter((i) => ["todo", "manual", "info"].includes(i.status)).length;

  // Uitvoeren: one step per chosen advice, in a window with a progress bar and the state of every step
  const NAME = (k) => tx((TEXT[k] || [k])[0]);
  const apply = async () => {
    const steps = chosen.map((i) => ({ key: i.key, status: "wait", text: "" }));
    setRun({ steps: [...steps, { key: "_score", status: "wait", text: "" }], busy: true, restart: false });
    const upd = (k, patch) => setRun((r) => (r ? { ...r, steps: r.steps.map((x) => (x.key === k ? { ...x, ...patch } : x)) } : r));
    let last = d, restart = false;
    for (const i of chosen) {
      upd(i.key, { status: "busy" });
      try {
        const r = await api("/admin/energy/advice/apply/", { method: "POST", body: { [i.key]: i.key === "images" ? img : i.key === "image_limit" ? { mb: Number(mb) } : true } });
        last = r; const x = r.done[i.key] || {};
        if (x.restart_needed) restart = true;
        const text = i.key === "fonts" ? `${x.changed} ${tx("instellingen gewijzigd")}` : i.key === "images" ? `${x.files} ${tx("verkleind")}, ${fmtBytes(x.saved)} ${tx("minder")}` : i.key === "image_limit" ? `${x.from} → ${x.to} MB` : i.key === "system_cache" ? `${tx("aan")}, ${x.seconds} s` : i.key === "cache_backend" ? tx("Redis ingesteld; herstart de server") : tx("Gelukt");
        upd(i.key, { status: "ok", text });
      } catch (e) { upd(i.key, { status: "err", text: errorText(e) }); }
    }
    upd("_score", { status: "busy" });
    try { last = await api("/admin/energy/advice/"); upd("_score", { status: "ok", text: `${last.current.rating} · ${fmtG(last.current.co2_g)}` }); } catch (e) { upd("_score", { status: "err", text: errorText(e) }); }
    setD(last); onChanged?.();
    setRun((r) => (r ? { ...r, busy: false, restart } : r));
  };
  const restartServer = async () => {
    try { await api("/system/restart/", { method: "POST", body: {} }); setRun((r) => ({ ...r, restart: false, note: tx("De server wordt herstart…") })); } catch (e) { setRun((r) => ({ ...r, note: errorText(e) })); }
  };
  const revert = async (i) => {
    if (!(await confirmDialog(tx("Dit advies terugzetten naar de vorige instelling?"), { title: tx("Terugzetten"), okLabel: tx("Terugzetten") }))) return;
    setBusy("rev" + i.key); setMsg(null);
    try { const r = await api("/admin/energy/advice/revert/", { method: "POST", body: { key: i.key } }); setD(r); onChanged?.(); setMsg({ ok: true, text: tx("Teruggezet.") }); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); } finally { setBusy(""); }
  };

  return (
    <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      <div className="card" style={{ display: "grid", gap: ".9rem", padding: "1.1rem 1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.4rem", flexWrap: "wrap" }}>
          <Score label={tx("Nu")} s={d.current} sub={d.source === "none" ? tx("Nog niet gemeten") : d.source === "scan" ? tx("scan door de server") : tx("gemeten bij bezoekers")} />
          {d.saving_apply > 0 && <><span aria-hidden style={{ fontSize: "1.4rem", opacity: .5 }}>→</span><Score label={tx("Na toepassen")} s={d.after_apply} sub={`≈ ${fmtBytes(d.saving_apply)} ${tx("minder per pagina")}`} /></>}
          {d.saving_manual > 0 && <><span aria-hidden style={{ fontSize: "1.4rem", opacity: .5 }}>→</span><Score label={tx("Na alle adviezen")} s={d.after_all} sub={tx("inclusief de handmatige")} /></>}
        </div>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: ".6rem", flexWrap: "wrap" }}><small className="muted">{tx("De verwachte score is een schatting. Meet na het toepassen opnieuw om de echte score te zien.")}</small>{open > 0 && <PromptButton text={() => promptAll(items, d)} label={tx("AI-prompt voor alles")} />}</div>
        {!d.has_scan && <div className="alert">{tx("Er is nog geen scan gedaan: de adviezen over compressie en de productieversie komen pas na een meting.")} <button type="button" className="btn sm" disabled={measuring} onClick={onMeasure}>{tx("Meet nu")}</button></div>}
      </div>

      <div className="adv-grid">
      {items.map((i) => {
        const [title, what] = TEXT[i.key]; const [stl, cls] = STATUS[i.status] || STATUS.info;
        const canSel = i.applicable && i.status === "todo";
        return (
          <div key={i.key} className={`card adv-card${canSel && (i.key === "images" || i.key === "image_limit") ? " wide" : ""}${canSel && sel[i.key] ? " on" : ""}`}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: ".8rem", flexWrap: "wrap" }}>
              {canSel && <label className="check sec-toggle" style={{ margin: 0 }}><span className="switch"><input type="checkbox" checked={!!sel[i.key]} onChange={(e) => setSel({ ...sel, [i.key]: e.target.checked })} aria-label={tx("Toepassen")} /><span /></span></label>}
              <span style={{ flex: 1, minWidth: 240 }}><strong>{tx(title)}</strong> <span className={cls}>{tx(stl)}</span>
                <small className="muted" style={{ display: "block", marginTop: ".2rem" }}>{tx(what)}</small></span>
              {!["ok", "applied"].includes(i.status) && <PromptButton text={() => promptFor(i, d)} />}
              {i.saving > 0 && i.status !== "applied" && <span className="badge ok" title={tx("Schatting")}>≈ {fmtBytes(i.saving)} {tx("per pagina")}</span>}
            </div>
            {i.detail?.length > 0 && i.status !== "applied" && <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: ".85rem" }} className="muted">{i.detail.map((x, k) => <li key={k}>{x}</li>)}</ul>}
            {i.key === "fonts" && i.not_in_scan && i.status === "todo" && <small className="muted">{tx("Google-lettertypen worden door de scan niet meegeteld; bij bezoekers wel.")}</small>}

            {canSel && i.key === "images" && (
              <div className="grid2" style={{ alignItems: "end" }}>
                <label>{tx("Alleen afbeeldingen zwaarder dan (KB)")}<input type="number" min="100" max="5000" step="50" value={img.threshold_kb} onChange={(e) => setImg({ ...img, threshold_kb: Number(e.target.value) })} /></label>
                <label>{tx("Langste zijde maximaal (px)")}<input type="number" min="800" max="4000" step="100" value={img.max_edge} onChange={(e) => setImg({ ...img, max_edge: Number(e.target.value) })} /></label>
                <label>{tx("Kwaliteit")}: {img.quality}<input type="range" min="60" max="95" value={img.quality} onChange={(e) => setImg({ ...img, quality: Number(e.target.value) })} /></label>
                <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={img.keep_originals} onChange={(e) => setImg({ ...img, keep_originals: e.target.checked })} /><span /></span><span>{tx("Originelen bewaren")} <small className="muted">{tx("zodat je ze kunt terugzetten")}</small></span></label>
                {i.library_saving > 0 && <small className="muted" style={{ gridColumn: "1 / -1" }}>{tx("In de hele bibliotheek scheelt dit ongeveer")} {fmtBytes(i.library_saving)} ({i.count} {tx("afbeeldingen")}).</small>}
              </div>
            )}
            {canSel && i.key === "image_limit" && <label style={{ maxWidth: 240 }}>{tx("Maximale grootte van een afbeelding (MB)")}<input type="number" min="1" max="50" value={mb} onChange={(e) => setMb(e.target.value)} /></label>}

            {i.status === "applied" && i.applied && (
              <div style={{ display: "flex", alignItems: "center", gap: ".8rem", flexWrap: "wrap" }}>
                <small className="muted" style={{ flex: 1 }}>{tx("Toegepast op")} {new Date(i.applied.at).toLocaleString()}
                  {i.key === "images" && ` · ${(i.applied.files || []).length} ${tx("afbeeldingen")}, ${fmtBytes(i.applied.saved || 0)} ${tx("minder")}${i.applied.originals ? ` · ${tx("originelen bewaard")}` : ""}${i.applied.remaining ? ` · ${i.applied.remaining} ${tx("nog te doen")}` : ""}`}
                  {i.key === "image_limit" && ` · ${i.applied.before} → ${i.applied.after} MB`}
                  {i.key === "system_cache" && ` · ${i.applied.before?.on ? tx("aan") : tx("uit")}, ${i.applied.before?.seconds} s → ${i.applied.after} s`}</small>
                {i.key === "images" && i.applied.remaining > 0 && <small className="muted">{tx("Zet eerst terug om de rest te kunnen verkleinen, of verwijder de oude actie.")}</small>}
                <button type="button" className="btn sm" disabled={!!busy} onClick={() => revert(i)}>{busy === "rev" + i.key ? tx("Bezig…") : tx("Terugzetten")}</button>
              </div>
            )}
            {i.status === "manual" && HOWTO[i.key] && <details><summary style={{ cursor: "pointer", fontSize: ".85rem" }}>{tx("Hoe doe je dit?")}</summary><pre style={{ margin: ".5rem 0 0", padding: ".7rem .9rem", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto", fontSize: ".8rem" }}><code>{HOWTO[i.key]}</code></pre></details>}
          </div>
        );
      })}
      </div>

      <div style={{ position: "sticky", bottom: 0, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: ".75rem 1rem", display: "flex", alignItems: "center", gap: ".8rem", flexWrap: "wrap", boxShadow: "0 -6px 20px rgba(0,0,0,.25)" }}>
        <span style={{ flex: 1, minWidth: 220 }}><strong>{chosen.length ? `${chosen.length} ${tx("adviezen geselecteerd")}` : tx("Niets te doen")}</strong>
          <small className="muted" style={{ display: "block" }}>{open ? `${open} ${tx("adviezen open")}` : tx("Alles is gedaan.")}</small></span>
        <button type="button" className="btn" disabled={measuring || !!busy} onClick={async () => { await onMeasure?.(); load(); }}><IconBolt /> {measuring ? tx("Bezig met meten…") : tx("Opnieuw meten")}</button>
        {chosen.length > 0 && <button type="button" className="btn primary" disabled={!!busy || !!run} onClick={apply}><IconCheck /> {tx("Uitvoeren")} ({chosen.length})</button>}
      </div>
      {run && (() => {
        const total = run.steps.length, done = run.steps.filter((x) => x.status === "ok" || x.status === "err").length, pct = Math.round((done / total) * 100);
        const failed = run.steps.some((x) => x.status === "err");
        return (
          <div className="overlay" role="dialog" aria-modal="true" aria-label={tx("Adviezen uitvoeren")}>
            <div className="card modal adv-run">
              <h2 style={{ margin: 0 }}>{tx("Adviezen uitvoeren")}</h2>
              <div className="adv-run-top"><span>{run.busy ? tx("Bezig…") : failed ? tx("Klaar, met een fout") : tx("Klaar")}</span><strong>{pct} %</strong></div>
              <div className="adv-run-bar"><div style={{ width: `${Math.max(3, pct)}%` }} /></div>
              <ol className="adv-steps">
                {run.steps.map((x) => (
                  <li key={x.key} className={`st-${x.status}`}>
                    <span className="adv-dot">{x.status === "ok" ? "✓" : x.status === "err" ? "!" : x.status === "busy" ? "…" : ""}</span>
                    <span><strong>{x.key === "_score" ? tx("Nieuwe score berekenen") : NAME(x.key)}</strong>{x.text && <small className={x.status === "err" ? "adv-err" : "muted"}>{x.text}</small>}</span>
                  </li>
                ))}
              </ol>
              {run.note && <div className="alert ok" role="status">{run.note}</div>}
              <div className="row" style={{ justifyContent: "flex-end", gap: ".6rem", flexWrap: "wrap" }}>
                {!run.busy && run.restart && user?.is_staff && <button type="button" className="btn" onClick={restartServer}>{tx("Server nu herstarten")}</button>}
                <button type="button" className="btn primary" disabled={run.busy} onClick={() => setRun(null)}>{tx("Sluiten")}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

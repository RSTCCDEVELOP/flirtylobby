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
import { IconBolt, IconCheck } from "./Icons";
import { fmtBytes, fmtG, Rating } from "./EnergyBlocks";

// The text of every piece of advice: what it is, and for the ones that cannot be applied here: how to do it.
const TEXT = {
  fonts: ["Gebruik het systeemlettertype", "Lettertypen van Google worden bij elk paginabezoek van een ander adres opgehaald. Het systeemlettertype kost geen data en staat meteen op het scherm. Het uiterlijk van de letters kan daardoor veranderen."],
  images: ["Maak zware afbeeldingen lichter", "Foto's in de bibliotheek die zwaarder zijn dan nodig worden verkleind en lichter opgeslagen. De originelen blijven bewaard, zodat je ze kunt terugzetten. Namen en adressen van de foto's blijven gelijk."],
  image_limit: ["Beperk de grootte van nieuwe uploads", "Een lagere limiet voorkomt dat er weer zware foto's op de website komen."],
  compression: ["Zet compressie aan op de server", "Tekstbestanden (scripts, stijlen, html) worden zonder compressie verstuurd. Met gzip of brotli worden ze ongeveer 70% lichter. Dit stel je in op de server, niet hier."],
  production: ["Meet op de echte website, niet op de ontwikkelversie", "De ontwikkelserver stuurt veel zwaarder JavaScript dan de echte website. Zet de website in productie en meet daar: het cijfer is dan veel lager."],
  heavy: ["Zwaarste pagina's", "Deze pagina's wegen meer dan 80% van een gemiddelde webpagina. Kijk er naar de afbeeldingen, video's en blokken."],
};
const HOWTO = {
  compression: "# nginx\ngzip on;\ngzip_min_length 1024;\ngzip_types text/css application/javascript application/json image/svg+xml;\n\n# Next.js (frontend): standaard aan in productie (compress: true)\n# Coolify / Traefik: zet de compress-middleware aan",
  production: "cd frontend\nnpm run build\nnpm start\n\n# en zet bij Admin → Basisgegevens de omgeving op Productie",
};
const STATUS = { todo: ["Te doen", "badge off"], applied: ["Toegepast", "badge ok"], manual: ["Handmatig", "badge off"], ok: ["Goed", "badge ok"], info: ["Let op", "badge off"], unknown: ["Nog niet gemeten", "badge"] };

function Score({ label, s, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: ".7rem" }}>
      <Rating r={s.rating} size={52} />
      <div><small className="muted" style={{ display: "block" }}>{label}</small><strong>{fmtG(s.co2_g)}</strong> <small className="muted">· {fmtBytes(s.avg_bytes)}</small>{sub && <small className="muted" style={{ display: "block" }}>{sub}</small>}</div>
    </div>
  );
}

// Admin → Energie → Advies: what makes the pages heavy, the settings that improve the score, and a button that applies them (and puts them back).
export default function EnergyAdvice({ onChanged, onMeasure, measuring }) {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [sel, setSel] = useState({ fonts: true, images: true, image_limit: true });
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
  if (!d) return <p className="muted">{msg ? msg.text : tx("Laden…")}</p>;
  const items = d.items, todo = items.filter((i) => i.applicable && i.status === "todo");
  const chosen = todo.filter((i) => sel[i.key]);
  const open = items.filter((i) => ["todo", "manual", "info"].includes(i.status)).length;

  const apply = async () => {
    const body = {};
    for (const i of chosen) body[i.key] = i.key === "images" ? img : i.key === "image_limit" ? { mb: Number(mb) } : true;
    setBusy("apply"); setMsg(null);
    try {
      const r = await api("/admin/energy/advice/apply/", { method: "POST", body });
      setD(r); onChanged?.();
      const bits = [];
      if (r.done.fonts) bits.push(`${tx("Lettertypen")}: ${r.done.fonts.changed} ${tx("instellingen gewijzigd")}`);
      if (r.done.images) bits.push(`${tx("Afbeeldingen")}: ${r.done.images.files} ${tx("verkleind")}, ${fmtBytes(r.done.images.saved)} ${tx("minder")}${r.done.images.remaining ? ` (${r.done.images.remaining} ${tx("nog te doen: klik nog eens")})` : ""}`);
      if (r.done.image_limit) bits.push(`${tx("Uploadlimiet")}: ${r.done.image_limit.from} → ${r.done.image_limit.to} MB`);
      setMsg({ ok: true, text: `${tx("Toegepast")}. ${bits.join(" · ")}. ${tx("Meet daarna opnieuw om de nieuwe score te zien.")}` });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); } finally { setBusy(""); }
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
        <small className="muted">{tx("De verwachte score is een schatting. Meet na het toepassen opnieuw om de echte score te zien.")}</small>
        {!d.has_scan && <div className="alert">{tx("Er is nog geen scan gedaan: de adviezen over compressie en de productieversie komen pas na een meting.")} <button type="button" className="btn sm" disabled={measuring} onClick={onMeasure}>{tx("Meet nu")}</button></div>}
      </div>

      {items.map((i) => {
        const [title, what] = TEXT[i.key]; const [stl, cls] = STATUS[i.status] || STATUS.info;
        const canSel = i.applicable && i.status === "todo";
        return (
          <div key={i.key} className="card" style={{ display: "grid", gap: ".7rem", padding: "1rem 1.2rem", borderColor: canSel && sel[i.key] ? "var(--blue)" : undefined }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: ".8rem", flexWrap: "wrap" }}>
              {canSel && <label className="check sec-toggle" style={{ margin: 0 }}><span className="switch"><input type="checkbox" checked={!!sel[i.key]} onChange={(e) => setSel({ ...sel, [i.key]: e.target.checked })} aria-label={tx("Toepassen")} /><span /></span></label>}
              <span style={{ flex: 1, minWidth: 240 }}><strong>{tx(title)}</strong> <span className={cls}>{tx(stl)}</span>
                <small className="muted" style={{ display: "block", marginTop: ".2rem" }}>{tx(what)}</small></span>
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
                  {i.key === "image_limit" && ` · ${i.applied.before} → ${i.applied.after} MB`}</small>
                {i.key === "images" && i.applied.remaining > 0 && <small className="muted">{tx("Zet eerst terug om de rest te kunnen verkleinen, of verwijder de oude actie.")}</small>}
                <button type="button" className="btn sm" disabled={!!busy} onClick={() => revert(i)}>{busy === "rev" + i.key ? tx("Bezig…") : tx("Terugzetten")}</button>
              </div>
            )}
            {i.status === "manual" && HOWTO[i.key] && <details><summary style={{ cursor: "pointer", fontSize: ".85rem" }}>{tx("Hoe doe je dit?")}</summary><pre style={{ margin: ".5rem 0 0", padding: ".7rem .9rem", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto", fontSize: ".8rem" }}><code>{HOWTO[i.key]}</code></pre></details>}
          </div>
        );
      })}

      <div style={{ position: "sticky", bottom: 0, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: ".75rem 1rem", display: "flex", alignItems: "center", gap: ".8rem", flexWrap: "wrap", boxShadow: "0 -6px 20px rgba(0,0,0,.25)" }}>
        <span style={{ flex: 1, minWidth: 220 }}><strong>{chosen.length ? `${chosen.length} ${tx("adviezen geselecteerd")}` : tx("Niets te doen")}</strong>
          <small className="muted" style={{ display: "block" }}>{open ? `${open} ${tx("adviezen open")}` : tx("Alles is gedaan.")}</small></span>
        <button type="button" className="btn" disabled={measuring || !!busy} onClick={async () => { await onMeasure?.(); load(); }}><IconBolt /> {measuring ? tx("Bezig met meten…") : tx("Opnieuw meten")}</button>
        <button type="button" className="btn primary" disabled={!chosen.length || !!busy} onClick={apply}>{busy === "apply" ? tx("Bezig met toepassen…") : <><IconCheck /> {tx("Toepassen")}</>}</button>
      </div>
    </div>
  );
}

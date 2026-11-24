// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api, errorText } from "../lib/api";
import { pushUndo } from "../lib/undo";
import { tx } from "../lib/t";
import { IconCheck, IconSparkle, IconX } from "./Icons";
import { useSession } from "./Session";
import Tabs from "./Tabs";
import TbSlot from "./TbSlot";

const PRESETS = [
  ["Professioneler", "Maak de pagina professioneler: rustiger, consistente ruimte en een duidelijke hiërarchie."],
  ["Meer ruimte", "Geef de blokken meer witruimte en lucht, zonder de inhoud te veranderen."],
  ["Sterkere kop", "Maak de koppen en de hero sterker en beter leesbaar."],
  ["Netjes uitlijnen", "Lijn alles netjes uit: kolommen, tekst en afbeeldingen."],
  ["Beter contrast", "Verbeter het contrast en de leesbaarheid van teksten en knoppen."],
  ["Mooier met beeld", "Maak de pagina visueel aantrekkelijker en stel passende foto's of video's voor."],
];
const VALUE = (v) => (v === undefined || v === null || v === "" ? "–" : typeof v === "object" ? JSON.stringify(v) : String(v));
const KEYNAME = { width: "Breedte", gap: "Kolomruimte", pad: "Ruimte binnen", mt: "Ruimte boven", balign: "Positie", h_mode: "Hoogte", h: "Hoogte", fx: "Effect", top: "Aansluiting", v: "Uitlijning", inner: "Inhoudsbreedte", halign: "Uitlijning", valign: "Uitlijning", size: "Grootte", align: "Uitlijning", weight: "Dikte", mb: "Ruimte onder", radius: "Hoeken", color: "Kleur", bg: "Achtergrond", bg_a: "Doorzichtigheid", shadow: "Schaduw", border: "Lijn", opacity: "Doorzichtigheid", w: "Breedte", t: "boven", b: "onder", l: "links", r: "rechts" };
const eur = (v) => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v || 0); } catch { return `€ ${v}`; } };
// the counter of what the AI of this improvement costs (calls, tokens and the price that is charged)
function AiCounter({ u }) {
  return <span className="ai-counter" title={tx("Wat de AI voor deze verbetering kost")}><IconSparkle width={14} height={14} /><b>{eur(u.charged)}</b><small>{u.calls} {tx("AI-verzoeken")} · {Number(u.tokens || 0).toLocaleString()} {tx("tokens")}</small></span>;
}
// The change as the page shows it: the css that changes (old in red, new in green) and the html element it belongs to. The labels of a theme value are shown as css.
const GAP = { sm: "0.5rem", md: "1rem", lg: "1.75rem" };
const px = (v) => (v === undefined || v === null || v === "" ? v : /^\d+(\.\d+)?$/.test(String(v)) ? `${v}px` : v);
const pct = (v) => (typeof v === "number" || /^\d+$/.test(String(v)) ? `${v}%` : v);
const CSS = {
  row: { width: ["max-width", pct], gap: ["gap", (v) => GAP[v] || v], mt: ["margin-top", px], h: ["min-height", px], h_mode: ["min-height-unit", (v) => v], balign: ["margin-inline", (v) => (v === "center" ? "auto" : v === "left" ? "0 auto 0 0" : "0 0 0 auto")], v: ["align-items", (v) => (v === "top" ? "flex-start" : v === "bottom" ? "flex-end" : "center")], fx: ["animation", (v) => v], inner: ["--inner-width", (v) => String(v)], top: ["margin-top", (v) => (v === "touch" ? "0 (tegen de header)" : "0 (tegen het blok erboven)")],
    "padding.t": ["padding-top", px], "padding.b": ["padding-bottom", px], "padding.l": ["padding-left", px], "padding.r": ["padding-right", px], "style.bg": ["background-color", (v) => v], "style.bg_a": ["background-opacity", pct], "style.color": ["color", (v) => v], "style.radius": ["border-radius", px] },
  cell: { width: ["flex-basis", pct], halign: ["justify-content", (v) => (v === "left" ? "flex-start" : v === "right" ? "flex-end" : "center")], valign: ["align-items", (v) => (v === "top" ? "flex-start" : v === "bottom" ? "flex-end" : "center")], "style.pad": ["padding", px], "style.radius": ["border-radius", px], "style.shadow": ["box-shadow", (v) => (v ? "0 4px 16px rgba(0,0,0,.12)" : "none")], "style.bg": ["background-color", (v) => v], "style.border": ["border-color", (v) => v] },
  item: { "style.size": ["font-size", (v) => `${v}rem`], "style.align": ["text-align", (v) => v], "style.weight": ["font-weight", (v) => v], "style.mb": ["margin-bottom", (v) => `${v}rem`], "style.mt": ["margin-top", (v) => `${v}rem`], "style.color": ["color", (v) => v], "style.radius": ["border-radius", px], "style.w": ["width", (v) => v], "style.opacity": ["opacity", (v) => String((Number(v) || 0) / 100)] },
};
const TAGS = { heading: "h2", text: "p", image: "img", button: "a", spacer: "div", line: "hr" };
function codeOf(c) {
  const map = CSS[c.kind] || {};
  const lines = c.diff.map((d) => {
    const m = map[d.key] || [d.key.replace(/[._]/g, "-"), (v) => String(v)];
    const f = m[1];
    const fmt = (v) => (v === undefined || v === null || v === "" ? "" : f(v));
    return { prop: m[0], old: fmt(d.old), new: fmt(d.new) };
  });
  const cls = c.kind === "row" ? "e2e-row" : c.kind === "cell" ? "e2e-cell" : `e2e-${c.tag || "item"}`;
  const el = c.kind === "row" ? "section" : c.kind === "cell" ? "div" : TAGS[c.tag] || "div";
  return { lines, selector: `.${cls}[data-id="${c.id}"]`, html: `<${el} class="${cls}" data-id="${c.id}">` };
}
const nice = (k) => { const [a, b] = k.split("."); return a === "padding" ? `${tx("Ruimte binnen")} ${tx(KEYNAME[b] || b)}` : tx(KEYNAME[b || a] || b || a); };

function CodeBlock({ c }) {
  const { lines, selector, html } = codeOf(c);
  return (
    <pre className="ai-code" aria-label={tx("Wijziging als css en html")}>
      <code className="ai-code-html">{html}</code>{"\n"}
      <code className="ai-code-sel">{selector} {"{"}</code>{"\n"}
      {lines.map((l, i) => (
        <span key={i}>
          {l.old !== "" && <span className="ai-code-del">{"  - "}{l.prop}: {l.old};{"\n"}</span>}
          <span className="ai-code-add">{"  + "}{l.prop}: {l.new === "" ? "(standaard van het thema)" : l.new};{"\n"}</span>
        </span>
      ))}
      <code className="ai-code-sel">{"}"}</code>
    </pre>
  );
}

// The AI button in the top bar of the editor: Claude (a derivative of the page creator) improves the PAGE: layout and look of the blocks, and proposes new pictures and videos with stock search.
// Nothing changes before you choose; every action is ONE undo step (the arrow at the top right).
export default function AiImprove() {
  const { editing } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("ask");
  const [instr, setInstr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState(null);
  const [pick, setPick] = useState({});
  const [target, setTarget] = useState(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("image");
  const [stock, setStock] = useState(null);
  const [done, setDone] = useState("");
  const [job, setJob] = useState(null);   // the improvement that is busy: {step, progress, usage, seconds}
  const [spent, setSpent] = useState(null); // what the AI of this improvement cost (stays after it is ready)
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === "Escape" && !busy) setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, busy]);
  if (!editing) return null;
  const key = () => window.__pbOwner || "";
  const url = () => `/pages/improve/${encodeURIComponent(key())}/`;
  const reload = () => { window.dispatchEvent(new Event("pb-layout-reload")); try { router.refresh(); } catch {} };
  const start = () => { setTab("ask"); setErr(""); setDone(""); setOpen(true); };

  async function run() {
    setBusy(true); setErr(""); setDone(""); setJob({ step: tx("Starten"), progress: 2, usage: { calls: 0, tokens: 0, charged: 0 }, seconds: 0 }); setSpent(null);
    try {
      const { id } = await api(url(), { method: "POST", body: { action: "start", instruction: instr } });
      let st;
      for (;;) {
        await new Promise((r) => setTimeout(r, 1200));
        st = await api(url(), { method: "POST", body: { action: "status", job: id } });
        setJob(st); setSpent(st.usage);
        if (st.status !== "running") break;
      }
      if (st.status === "error") throw new Error(st.error || "");
      const r = st.result;
      setRes(r); setPick(Object.fromEntries(r.changes.map((c) => [c.id, true]))); setTarget(r.media[0] || null); setStock(null);
      if (r.media[0]) { setQuery(r.media[0].query); setKind(r.media[0].kind); }
      setTab(r.changes.length || !r.media.length ? "page" : "media");
    } catch (e) { setErr(errorText(e) || e.message); }
    setJob(null); setBusy(false);
  }
  async function apply() {
    const ops = (res?.changes || []).filter((c) => pick[c.id]).map((c) => ({ id: c.id, set: c.set }));
    if (!ops.length) return;
    setBusy(true); setErr("");
    try {
      const r = await api(url(), { method: "POST", body: { action: "apply", ops } });
      pushUndo(tx("Pagina verbeterd met AI"), async () => { await api(`/pages/layout/${encodeURIComponent(key())}/`, { method: "PUT", body: r.before }); reload(); });
      reload();
      setDone(tx("De pagina is verbeterd. Niet goed? Gebruik de pijl rechtsboven (ongedaan maken)."));
      setRes({ ...res, changes: res.changes.filter((c) => !pick[c.id]) });
    } catch (e) { setErr(errorText(e)); }
    setBusy(false);
  }
  async function search(q = query, k = kind) {
    setBusy(true); setErr(""); setStock(null);
    try { const r = await api(url(), { method: "POST", body: { action: "stock", query: q, kind: k } }); setStock(r.items); }
    catch (e) { setErr(errorText(e)); }
    setBusy(false);
  }
  const goStock = (m) => { setTarget(m); setQuery(m.query); setKind(m.kind); setTab("stock"); search(m.query, m.kind); };
  async function use(item) {
    if (!target) return;
    setBusy(true); setErr("");
    try {
      const r = await api(url(), { method: "POST", body: { action: "use", id: target.id, item } });
      pushUndo(tx("Afbeelding of video geplaatst met AI"), async () => {
        await api(`/pages/layout/${encodeURIComponent(key())}/`, { method: "PUT", body: r.before });
        if (r.block) await api("/media/replace/", { method: "POST", body: { target: `block:${r.block.key}`, media_id: r.block.prev ? Number(r.block.prev) : null } });
        reload();
      });
      reload();
      setDone(tx("Geplaatst. Niet goed? Gebruik de pijl rechtsboven (ongedaan maken)."));
    } catch (e) { setErr(errorText(e)); }
    setBusy(false);
  }
  const n = Object.values(pick).filter(Boolean).length;
  const nChanges = res?.changes?.length;
  return (
    <>
      <TbSlot host="pb-sb-ai"><button type="button" className="ai-improve-btn" onClick={start} title={tx("Pagina verbeteren met AI")} aria-label={tx("Pagina verbeteren met AI")}><IconSparkle width={18} height={18} /><span>{tx("AI")}</span></button></TbSlot>
      {open && createPortal(
        <div className="overlay" onClick={() => !busy && setOpen(false)}>
          <div className="card modal ai-improve" role="dialog" aria-label={tx("Pagina verbeteren met AI")} onClick={(e) => e.stopPropagation()}>
            <div className="ai-improve-head"><strong><IconSparkle width={18} height={18} /> {tx("Pagina verbeteren met AI")}</strong><span style={{ flex: 1 }} />{spent && tab !== "ask" && <AiCounter u={spent} />}<button type="button" className="pb-panelx" onClick={() => !busy && setOpen(false)} aria-label={tx("Sluiten")}><IconX width={16} height={16} /></button></div>
            <Tabs tabs={[["ask", "Opdracht", <IconSparkle key="a" />], ["page", "Pagina", <IconCheck key="p" />, nChanges], ["media", "Foto's en video's", <IconCheck key="m" />, res?.media?.length], ["stock", "Stock", <IconCheck key="s" />]]} value={tab} onChange={(t) => { setTab(t); setDone(""); }} />
            {err && <div className="alert" role="alert">{err}</div>}
            {done && <div className="alert ok" role="status">{done}</div>}
            {tab === "ask" && (
              <div className="ai-improve-body">
                <p className="muted" style={{ margin: 0 }}>{tx("Claude kijkt naar de opbouw van deze pagina en stelt verbeteringen voor aan ruimte, uitlijning, groottes en kleuren, en foto's of video's die beter passen. Er verandert niets voordat jij kiest; elke keuze kun je met één klik ongedaan maken.")}</p>
                <div className="ai-improve-presets">{PRESETS.map(([l, t]) => <button type="button" key={l} className={`btn sm${instr === t ? " primary" : ""}`} onClick={() => setInstr(instr === t ? "" : t)}>{tx(l)}</button>)}</div>
                <label>{tx("Wat moet er beter?")}<textarea rows={3} maxLength={500} value={instr} onChange={(e) => setInstr(e.target.value)} placeholder={tx("Bijvoorbeeld: maak de hero hoger en de kolommen gelijk. Leeg laten = algemeen verbeteren.")} /></label>
                {job && (
                  <div className="card ai-progress" role="status">
                    <div className="ai-progress-top"><span>{tx(job.step || "Bezig…")}</span><strong>{Math.round(job.progress || 0)} %</strong></div>
                    <div className="ai-progress-bar"><div style={{ width: `${Math.max(3, Math.min(100, job.progress || 0))}%` }} /></div>
                    <small className="muted">{Math.round(job.seconds || 0)} s · {tx("Je kunt dit venster niet sluiten zolang Claude bezig is.")}</small>
                  </div>
                )}
                <div className="ai-improve-actions"><button type="button" className="btn primary" onClick={run} disabled={busy}>{busy ? tx("Claude is bezig…") : tx("Verbeter de pagina")}</button>{spent && <AiCounter u={spent} />}</div>
              </div>
            )}
            {tab === "page" && (
              <div className="ai-improve-body">
                {!res ? <p className="muted">{tx("Geef eerst een opdracht in het eerste tabblad.")}</p> : res.changes.length === 0 ? <p className="muted">{tx("Claude vindt de opbouw al goed: er zijn geen wijzigingen voorgesteld.")}</p> : (
                  <>
                    <div className="ai-improve-list">
                      {res.changes.map((c) => (
                        <label key={c.id} className={`ai-improve-item${pick[c.id] ? " on" : ""}`}>
                          <input type="checkbox" checked={!!pick[c.id]} onChange={(e) => setPick({ ...pick, [c.id]: e.target.checked })} />
                          <span>
                            <b>{tx(c.label)}{c.where ? <small className="muted"> · {c.where}</small> : null}{c.text ? <small className="muted"> · {c.text}</small> : null}</b>
                            {c.why && <small className="muted">{c.why}</small>}
<CodeBlock c={c} /></span>
                        </label>
                      ))}
                    </div>
                    <div className="row" style={{ justifyContent: "space-between", gap: ".6rem" }}>
                      <button type="button" className="btn sm" onClick={() => setPick(Object.fromEntries(res.changes.map((c) => [c.id, n !== res.changes.length])))}>{n === res.changes.length ? tx("Niets selecteren") : tx("Alles selecteren")}</button>
                      <button type="button" className="btn primary" onClick={apply} disabled={busy || !n}>{busy ? tx("Bezig…") : `${tx("Toepassen")} (${n})`}</button>
                    </div>
                  </>
                )}
              </div>
            )}
            {tab === "media" && (
              <div className="ai-improve-body">
                {!res ? <p className="muted">{tx("Geef eerst een opdracht in het eerste tabblad.")}</p> : res.media.length === 0 ? <p className="muted">{tx("Claude ziet geen plek waar een nieuwe foto of video de pagina duidelijk beter maakt.")}</p> : (
                  <div className="ai-improve-list">
                    {res.media.map((m) => (
                      <div key={m.id} className="ai-improve-item on">
                        <span style={{ flex: 1 }}>
                          <b>{tx(m.label)} <small className="badge">{m.kind === "video" ? tx("video") : tx("foto")}</small></b>
                          <small className="muted">{m.why}</small>
                          <small>{tx("Zoekterm")}: <strong>{m.query}</strong></small>
                        </span>
                        <button type="button" className="btn sm primary" onClick={() => goStock(m)}>{tx("Stock bekijken")}</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab === "stock" && (
              <div className="ai-improve-body">
                <div className="row" style={{ gap: ".5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label style={{ flex: "1 1 200px" }}>{tx("Zoekterm")}<input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} placeholder="open water swimming" /></label>
                  <span className="row" style={{ gap: ".3rem" }}>{[["image", "Foto's"], ["video", "Video's"]].map(([k, l]) => <button type="button" key={k} className={`btn sm${kind === k ? " primary" : ""}`} onClick={() => setKind(k)}>{tx(l)}</button>)}</span>
                  <button type="button" className="btn primary" onClick={() => search()} disabled={busy || !query.trim()}>{busy ? tx("Zoeken…") : tx("Zoeken")}</button>
                </div>
                <small className="muted">{target ? `${tx("Komt in")}: ${tx(target.label)}` : tx("Kies eerst een suggestie in het tabblad Foto's en video's om iets te kunnen plaatsen.")} · {tx("Gratis foto's en video's van Pexels en Unsplash.")}</small>
                {stock && stock.length === 0 && <p className="muted">{tx("Niets gevonden. Probeer andere zoekwoorden.")}</p>}
                {stock && stock.length > 0 && (
                  <div className="ai-stock-grid">
                    {stock.map((it) => (
                      <figure key={`${it.source}${it.id}`} className="ai-stock">
                        <img src={it.preview} alt={it.title} loading="lazy" />
                        <figcaption><small title={it.title}>{it.title}</small><button type="button" className="btn sm primary" disabled={busy || !target} onClick={() => use(it)}>{tx("Gebruiken")}</button></figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>, document.body)}
    </>
  );
}

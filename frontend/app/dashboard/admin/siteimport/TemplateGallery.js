// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, apiBase, errorText } from "../../../../lib/api";
import { tx } from "../../../../lib/t";
import Loading from "../../../../components/Loading";
import { IconHelp, IconSearch } from "../../../../components/Icons";

// The templates in the pop-up of the wizard: a gallery with the example pictures, a detail view (big picture with thumbnails, what is in it, how to use it) and the installation from the pop-up itself.
const MODES = [["copy", "Naast mijn pagina's zetten", "De pagina's van de template komen erbij. Jouw bestaande pagina's blijven staan."], ["replace", "In plaats van mijn pagina's", "Een pagina met hetzelfde adres wordt vervangen door die van de template."]];
const tint = (n = 12) => `color-mix(in srgb, var(--eco-leaf, #7cc59a) ${n}%, transparent)`;
const plain = (t) => { try { const a = document.createElement("textarea"); a.innerHTML = String(t || ""); return a.value; } catch { return String(t || ""); } };  // (older templates have &amp; in their description)
const img = (t, n) => `${apiBase()}/api/templates/${t.key}/preview/${n}/`;

const Badge = ({ children, warm, solid }) => <span style={{ fontSize: ".7rem", fontWeight: 650, letterSpacing: ".03em", textTransform: "uppercase", padding: ".18rem .6rem", borderRadius: 99, background: solid ? (warm ? "#d98f2b" : "var(--eco-green, #2f7d5b)") : warm ? "color-mix(in srgb, #d98f2b 24%, transparent)" : tint(22), color: solid ? "#fff" : undefined, boxShadow: solid ? "0 2px 8px rgba(0,0,0,.25)" : "none" }}>{children}</span>;

function Card({ t, onOpen }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onOpen} aria-label={t.name} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onFocus={() => setHov(true)} onBlur={() => setHov(false)}
      style={{ textAlign: "left", display: "grid", gridTemplateRows: "auto 1fr", padding: 0, border: "1px solid var(--line, rgba(0,0,0,.12))", borderRadius: 16, overflow: "hidden", background: "var(--card, #fff)", cursor: "pointer", font: "inherit", color: "var(--text)", transition: "transform .18s, box-shadow .18s, border-color .18s", transform: hov ? "translateY(-4px)" : "none", boxShadow: hov ? "0 16px 36px rgba(0,0,0,.18)" : "0 2px 8px rgba(0,0,0,.06)", borderColor: hov ? "var(--eco-green, #2f7d5b)" : undefined }}>
      <span style={{ position: "relative", display: "block", height: "clamp(130px, 25vh, 250px)", background: tint(18), overflow: "hidden", borderBottom: "1px solid var(--line, rgba(0,0,0,.08))" }}>
        {t.previews > 0 ? <img src={img(t, 0)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block", transition: "transform .5s", transform: hov ? "scale(1.05)" : "none" }} /> : null}
        <span style={{ position: "absolute", left: 10, top: 10, display: "flex", gap: ".3rem", flexWrap: "wrap" }}>
          {t.system && <Badge solid>{tx("Volledig systeem")}</Badge>}
          {t.update && <Badge warm solid>{tx("Nieuwe versie")}</Badge>}
        </span>
        <span aria-hidden="true" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "end center", paddingBottom: 14, background: "linear-gradient(to top, rgba(0,0,0,.45), transparent 45%)", opacity: hov ? 1 : 0, transition: "opacity .2s" }}><span style={{ color: "#fff", fontWeight: 600, fontSize: ".9rem", letterSpacing: ".02em" }}>{tx("Bekijken en installeren")} ›</span></span>
      </span>
      <span style={{ display: "grid", gap: ".25rem", padding: ".7rem .9rem .8rem", alignContent: "start" }}>
        <strong style={{ fontSize: "1.05rem", lineHeight: 1.25 }}>{t.name}</strong>
        <small className="muted" style={{ letterSpacing: ".01em" }}>v{t.version}{t.author ? ` · ${t.author}` : ""}{t.applied_version && !t.update ? ` · ${tx("In gebruik")}` : ""}</small>
        <small className="muted" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.45 }}>{plain(t.description)}</small>
        <span style={{ display: "flex", gap: ".3rem", flexWrap: "wrap", marginTop: ".2rem" }}>
          {t.has_theme && <Badge>{tx("Eigen thema")}</Badge>}
          {t.components && <Badge>{tx("Componentenset")}</Badge>}
          {t.has_pages && <Badge>{tx("Pagina's")}</Badge>}
        </span>
      </span>
    </button>
  );
}

function Detail({ t, can, manage, onBack, onInstalled }) {  // eslint-disable-line
  const [n, setN] = useState(0);
  const [mode, setMode] = useState("copy");
  const [scope, setScope] = useState(t.system && !t.has_pages ? "system" : "pages");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  useEffect(() => { const k = (e) => { if (e.key === "ArrowRight") setN((x) => Math.min(t.previews - 1, x + 1)); if (e.key === "ArrowLeft") setN((x) => Math.max(0, x - 1)); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [t.previews]);
  const install = async () => {
    setBusy(true); setErr("");
    try { const r = await api("/templates/", { method: "POST", body: { action: "apply", key: t.key, mode, scope: scope === "system" ? "system" : "pages" } }); setDone(r); onInstalled?.(r); }
    catch (e) { setErr(errorText(e)); }
    setBusy(false);
  };
  if (done) {
    return (
      <div style={{ display: "grid", gap: ".8rem", justifyItems: "start" }}>
        <div className="alert ok" role="status" style={{ margin: 0, width: "100%" }}>
          <strong>{done.scope === "system" ? tx("Het systeem is ingesteld met de template.") : tx("De template is geïnstalleerd.")}</strong>
          {done.scope === "system" ? <> {tx("Een backup van daarvoor staat klaar")}: {done.safety_backup}.</> : <> {done.pages} {tx("pagina's")}{done.media ? `, ${done.media} ${tx("afbeeldingen")}` : ""}{done.menu_items ? `, ${done.menu_items} ${tx("menu-items")}` : ""}.</>}
          {done.notes?.length > 0 && <ul style={{ margin: ".4rem 0 0", paddingLeft: "1.2rem" }}>{done.notes.slice(0, 6).map((x, i) => <li key={i}>{x}</li>)}</ul>}
        </div>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
          <Link className="btn primary" href="/">{tx("Bekijk je website")}</Link>
          <button type="button" className="btn" onClick={onBack}>{tx("Nog een template bekijken")}</button>
        </div>
      </div>
    );
  }
  const pick = (cond, on, title, hint) => (
    <button type="button" aria-pressed={cond} onClick={on} style={{ textAlign: "left", display: "grid", gap: ".15rem", padding: ".6rem .8rem", borderRadius: 12, border: `2px solid ${cond ? "var(--eco-green, #2f7d5b)" : "transparent"}`, background: cond ? tint(18) : tint(8), cursor: "pointer", font: "inherit", color: "var(--text)" }}><strong>{tx(title)}</strong><small className="muted">{tx(hint)}</small></button>
  );
  return (
    <div style={{ display: "grid", gap: ".9rem" }}>
      <div><button type="button" className="btn sm" onClick={onBack}>‹ {tx("Alle templates")}</button></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.3rem", alignItems: "start" }}>
        <div style={{ display: "grid", gap: ".6rem", minWidth: 0, position: "sticky", top: 0 }}>
          <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: tint(18), height: "clamp(200px, 44vh, 400px)", boxShadow: "0 8px 26px rgba(0,0,0,.15)" }}>
            {t.previews > 0 && <img src={img(t, n)} alt={t.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }} />}
            {t.previews > 1 && <>
              <button type="button" className="btn sm" aria-label={tx("Vorige")} disabled={n === 0} onClick={() => setN(n - 1)} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}>‹</button>
              <button type="button" className="btn sm" aria-label={tx("Volgende")} disabled={n >= t.previews - 1} onClick={() => setN(n + 1)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}>›</button>
            </>}
          </div>
          {t.previews > 1 && <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>{Array.from({ length: t.previews }, (_, i) => <button type="button" key={i} onClick={() => setN(i)} aria-label={`${tx("Voorbeeld")} ${i + 1}`} style={{ width: 74, aspectRatio: "16 / 10", padding: 0, borderRadius: 8, overflow: "hidden", cursor: "pointer", border: `2px solid ${n === i ? "var(--eco-green, #2f7d5b)" : "transparent"}`, opacity: n === i ? 1 : .7 }}><img src={img(t, i)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }} /></button>)}</div>}
        </div>
        <div style={{ display: "grid", gap: ".7rem", minWidth: 0 }}>
          <div style={{ display: "grid", gap: ".25rem" }}><strong style={{ fontSize: "1.35rem", lineHeight: 1.2 }}>{t.name}</strong><small className="muted">v{t.version}{t.author ? ` · ${t.author}` : ""}{t.size ? ` · ${(t.size / 1048576).toFixed(1)} MB` : ""}{t.previews ? ` · ${t.previews} ${tx("voorbeelden")}` : ""}</small></div>
          {t.description && <p style={{ margin: 0, padding: ".7rem .9rem", borderRadius: 12, background: tint(10), lineHeight: 1.5, maxHeight: "18vh", overflowY: "auto" }}>{plain(t.description)}</p>}
          <div style={{ display: "flex", gap: ".3rem", flexWrap: "wrap" }}>
            {t.system && <Badge>{tx("Volledig systeem")}</Badge>}{t.has_theme && <Badge>{tx("Met eigen thema")}</Badge>}{t.components && <Badge>{tx("Met componentenset")}</Badge>}
            {t.update && <Badge warm>{tx("Nieuwe versie beschikbaar")}</Badge>}{t.applied_version && !t.update && <Badge>{tx("In gebruik")}: v{t.applied_version}</Badge>}
          </div>
          {can ? (
            <div style={{ display: "grid", gap: ".6rem" }}>
              {t.system && manage && t.has_pages && <div style={{ display: "grid", gap: ".4rem" }}><strong>{tx("Wat zet je in?")}</strong>
                {pick(scope !== "system", () => setScope("pages"), "Alleen de pagina's", "Zoals een gewone template: de pagina's met afbeeldingen en menu.")}
                {pick(scope === "system", () => setScope("system"), "Het hele systeem", "Eerst een backup van alles, daarna de modules, plugins, het thema, de talen en de pagina's.")}</div>}
              {t.system && manage && !t.has_pages && <small className="muted">{tx("Deze template zet het hele systeem: er wordt eerst een backup gemaakt.")}</small>}
              {scope !== "system" && <div style={{ display: "grid", gap: ".4rem" }}><strong>{tx("Hoe installeren?")}</strong>{MODES.map(([k, l, h]) => <span key={k} style={{ display: "contents" }}>{pick(mode === k, () => setMode(k), l, h)}</span>)}</div>}
              {(t.has_theme || t.components) && <small className="muted">{t.has_theme ? tx("Het thema van de template wordt in gebruik genomen. ") : ""}{t.components ? tx("De componentenset van de template wordt in gebruik genomen.") : ""}</small>}
              {err && <div className="alert" role="alert">{err}</div>}
              <button type="button" className="btn primary" disabled={busy} onClick={install} style={{ width: "100%", padding: ".75rem 1.2rem", fontSize: "1rem" }}>{busy ? tx("Bezig met installeren…") : t.update ? tx("Bijwerken") : tx("Deze template installeren")}</button>
              {busy && <div className="imp-bar imp-wait" role="progressbar" aria-label={tx("Bezig met installeren…")}><span /></div>}
            </div>
          ) : <small className="muted">{tx("Je hebt geen rechten om templates te gebruiken, dus je kunt ze alleen bekijken.")}</small>}
        </div>
      </div>
    </div>
  );
}

const FILTERS = [["system", "Volledig systeem"], ["pages", "Alleen pagina's"], ["theme", "Eigen thema"], ["kit", "Componentenset"], ["update", "Nieuwe versie"], ["used", "In gebruik"]];
const SORTS = [["name", "Naam A–Z"], ["name-desc", "Naam Z–A"], ["size", "Grootte"], ["version", "Nieuwste versie"]];
const verNum = (v) => String(v || "0").split(".").reduce((n, x) => n * 1000 + (parseInt(x, 10) || 0), 0);
const match = (t, f) => (f === "system" ? t.system : f === "pages" ? t.has_pages && !t.system : f === "theme" ? t.has_theme : f === "kit" ? !!t.components : f === "update" ? t.update : f === "used" ? !!t.applied_version : true);

export default function TemplateGallery({ onInstalled, onDetail, subtitle, onHelp }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [on, setOn] = useState({});          // the filters that are on
  const [maker, setMaker] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(0);       // two templates (two columns) per page
  const load = useCallback(() => api("/templates/").then(setD).catch((e) => setErr(errorText(e))), []);
  useEffect(() => { load(); }, [load]);
  const makers = useMemo(() => [...new Set((d?.templates || []).map((t) => t.author).filter(Boolean))].sort(), [d]);
  const avail = useMemo(() => Object.fromEntries(FILTERS.map(([k]) => [k, (d?.templates || []).some((t) => match(t, k))])), [d]);  // a filter that no template has is not offered
  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const rows = (d?.templates || []).filter((t) => {
      const hay = `${t.name} ${plain(t.description)} ${t.author} ${t.key}`.toLowerCase();
      return words.every((w) => hay.includes(w)) && Object.keys(on).filter((k) => on[k]).every((k) => match(t, k)) && (!maker || t.author === maker);
    });
    const cmp = { name: (a, b) => a.name.localeCompare(b.name), "name-desc": (a, b) => b.name.localeCompare(a.name), size: (a, b) => (b.size || 0) - (a.size || 0), version: (a, b) => verNum(b.version) - verNum(a.version) }[sort];
    return rows.sort(cmp);
  }, [d, q, on, maker, sort]);
  useEffect(() => { setPage(0); }, [q, on, maker, sort]);  // a new search or filter starts at the first page
  const cur = open && d?.templates?.find((t) => t.key === open);
  useEffect(() => { onDetail?.(!!cur); }, [!!cur]);  // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <div className="alert">{err}</div>;
  if (!d) return <Loading compact />;
  if (cur) return <Detail key={cur.key} t={cur} can={d.can_use} manage={d.manage} onBack={() => { setOpen(null); load(); }} onInstalled={onInstalled} />;
  const active = Object.values(on).filter(Boolean).length + (maker ? 1 : 0) + (q.trim() ? 1 : 0);
  const clear = () => { setOn({}); setMaker(""); setQ(""); };
  const chip = (k, label) => <button type="button" key={k} aria-pressed={!!on[k]} onClick={() => setOn((o) => ({ ...o, [k]: !o[k] }))} style={{ padding: ".3rem .8rem", borderRadius: 99, fontSize: ".82rem", fontWeight: 600, cursor: "pointer", font: "inherit", border: `1px solid ${on[k] ? "var(--eco-green, #2f7d5b)" : "var(--line, rgba(0,0,0,.18))"}`, background: on[k] ? "var(--eco-green, #2f7d5b)" : "var(--card, #fff)", color: on[k] ? "#fff" : "var(--text)", transition: "background .15s, border-color .15s" }}>{tx(label)}</button>;
  return (
    <div style={{ display: "grid", gap: ".8rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: onHelp ? "repeat(auto-fit, minmax(300px, 1fr))" : "1fr", gap: "1rem", alignItems: "stretch" }}>
        {onHelp && (
          <div style={{ display: "grid", gap: ".6rem", alignContent: "center", padding: ".75rem .95rem", borderRadius: 14, background: tint(14), border: "1px solid var(--line, rgba(0,0,0,.08))" }}>
            <strong>{tx("Hulp nodig?")}</strong>
            <span className="muted" style={{ lineHeight: 1.4, fontSize: ".9rem" }}>{tx("De handleiding met uitleg en video's laat zien hoe je een template kiest, installeert en daarna aanpast.")}</span>
            <div><button type="button" className="btn primary" onClick={onHelp}><span style={{ display: "inline-flex", width: 16, height: 16, marginRight: ".4rem", verticalAlign: "middle" }}><IconHelp /></span>{tx("Help openen")}</button></div>
          </div>
        )}
        <div role="search" style={{ display: "grid", gap: ".55rem", alignContent: "center", padding: ".75rem .95rem", borderRadius: 14, background: tint(9), border: "1px solid var(--line, rgba(0,0,0,.08))" }}>
          <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ position: "relative", flex: "1 1 200px", minWidth: 0 }}>
              <span aria-hidden="true" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", display: "inline-flex", width: 16, height: 16, opacity: .6 }}><IconSearch /></span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoek op naam, omschrijving of maker…")} aria-label={tx("Zoeken")} style={{ width: "100%", paddingLeft: 34, height: 40, borderRadius: 10, boxSizing: "border-box" }} />
            </label>
            {makers.length > 1 && <select value={maker} onChange={(e) => setMaker(e.target.value)} aria-label={tx("Maker")} style={{ height: 40, borderRadius: 10, width: "auto", flex: "0 0 auto" }}><option value="">{tx("Alle makers")}</option>{makers.map((m) => <option key={m} value={m}>{m}</option>)}</select>}
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={tx("Sorteren")} style={{ height: 40, borderRadius: 10, width: "auto", flex: "0 0 auto" }}>{SORTS.map(([k, l]) => <option key={k} value={k}>{tx("Sorteren")}: {tx(l)}</option>)}</select><span role="status" aria-live="polite" style={{ flex: "0 0 auto", fontSize: ".82rem", fontWeight: 650, padding: ".35rem .8rem", borderRadius: 99, background: tint(22), whiteSpace: "nowrap" }}>{list.length === d.templates.length ? `${d.templates.length} ${d.templates.length === 1 ? tx("template") : tx("templates")}` : `${list.length} ${tx("van")} ${d.templates.length} ${tx("templates")}`}</span>
          </div>
          <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap", alignItems: "center" }}>
            <small className="muted" style={{ marginRight: ".2rem" }}>{tx("Filter")}:</small>
            {FILTERS.filter(([k]) => avail[k] || on[k]).map(([k, l]) => chip(k, l))}
            {active > 0 && <button type="button" className="btn sm" onClick={clear} style={{ marginLeft: "auto" }}>{tx("Filters wissen")}</button>}
          </div>
        </div>
      </div>
      {!list.length && <div style={{ padding: "1.6rem", textAlign: "center", borderRadius: 14, border: "1px dashed var(--line, rgba(0,0,0,.2))" }}><strong>{d.templates.length ? tx("Geen template gevonden") : tx("Er zijn nog geen templates")}</strong><p className="muted" style={{ margin: ".3rem 0 .6rem" }}>{d.templates.length ? tx("Pas de zoekterm of de filters aan.") : tx("Een superadmin kan er een toevoegen (zip) of zet hem in resource/templates.")}</p>{d.templates.length > 0 && <button type="button" className="btn sm" onClick={clear}>{tx("Filters wissen")}</button>}</div>}
      {list.length > 0 && (() => {
        const per = 2, pages = Math.max(1, Math.ceil(list.length / per)), pg = Math.min(page, pages - 1);
        const slides = Array.from({ length: pages }, (_, i) => list.slice(i * per, i * per + per));
        const side = (dir, label) => pages > 1 && (dir < 0 ? pg > 0 : pg < pages - 1) ? <button type="button" onClick={() => setPage(pg + dir)} aria-label={tx(label)} style={{ position: "absolute", top: "40%", [dir < 0 ? "left" : "right"]: 6, zIndex: 2, width: 42, height: 42, borderRadius: "50%", border: "1px solid var(--line, rgba(0,0,0,.2))", background: "var(--card, #fff)", boxShadow: "0 6px 18px rgba(0,0,0,.25)", cursor: "pointer", fontSize: "1.4rem", lineHeight: 1, display: "grid", placeItems: "center", color: "var(--text)" }}>{dir < 0 ? "‹" : "›"}</button> : null;
        return (
          <section aria-roledescription="carousel" aria-label={tx("Templates")} style={{ display: "grid", gap: ".8rem", width: "100%" }}>
            <div style={{ position: "relative", width: "100%" }}>
              {side(-1, "Vorige")}{side(1, "Volgende")}
              <div style={{ overflow: "hidden", borderRadius: 16, padding: "6px 0" }}>
                <div style={{ display: "flex", width: "100%", transform: `translateX(-${pg * 100}%)`, transition: "transform .4s cubic-bezier(.4,0,.2,1)" }}>
                  {slides.map((row, i) => (
                    <div key={i} role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${pages}`} aria-hidden={i !== pg} style={{ flex: "0 0 100%", minWidth: 0, display: "grid", gridTemplateColumns: list.length === 1 ? "minmax(0, 520px)" : "repeat(auto-fit, minmax(max(300px, calc(50% - .6rem)), 1fr))", gap: "1.2rem", alignItems: "stretch", padding: "0 2px", boxSizing: "border-box" }}>
                      {row.map((t) => <Card key={t.key} t={t} onOpen={() => setOpen(t.key)} />)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {pages > 1 && (
              <nav aria-label={tx("Pagina's met templates")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: ".5rem" }}>
                {Array.from({ length: pages }, (_, i) => <button type="button" key={i} onClick={() => setPage(i)} aria-label={`${tx("Pagina")} ${i + 1}`} aria-current={i === pg ? "page" : undefined} style={{ width: i === pg ? 26 : 10, height: 10, borderRadius: 99, border: 0, padding: 0, cursor: "pointer", background: i === pg ? "var(--eco-green, #2f7d5b)" : "var(--line, rgba(0,0,0,.25))", transition: "width .2s, background .2s" }} />)}
                <small className="muted" style={{ marginLeft: ".5rem" }}>{tx("Pagina")} {pg + 1} / {pages}</small>
              </nav>
            )}
          </section>
        );
      })()}
    </div>
  );
}

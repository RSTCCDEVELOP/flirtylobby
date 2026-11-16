// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "../lib/api";
import { tx } from "../lib/t";
import { can } from "../lib/perms";
import { useAuth } from "./AuthContext";
import { useModules } from "./Modules";
import KitScope from "../lib/ui-kit/KitScope";
import { useUpdates } from "../lib/updates";
import { Columns, CostSummary, money, num, short } from "./AiCharts";
import { confirmDialog } from "../lib/dialog";
import { ACTIVE_DESIGN_EVENT, getActiveDesign } from "../lib/activeDesign";

// The floating item "AI" of the back office (admin and superadmin screens): it appears as soon as the AI has been used (the last 30 minutes, or while you work) and opens a small window
// with the costs of every request, live. Only what is charged, margin included, in the currency of the website (euro by default); never the purchase price.
export default function AiLiveCost() {
  const { user } = useAuth();
  const mods = useModules();
  const pathname = usePathname() || "";
  const back = pathname.startsWith("/dashboard/admin") || pathname.startsWith("/dashboard/superadmin");
  const allowed = !!user && back && mods.ai !== false && (user.is_staff || can(user, "ai.manage"));
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ currency: "EUR", super: false });
  const [sums, setSums] = useState(null);
  const [running, setRunning] = useState([]);  // the calls that are busy right now, with the costs so far  // what is charged today and this month (from the server)
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(0);  // calls that came in while the window was closed
  const [pulse, setPulse] = useState(false);
  const [openG, setOpenG] = useState({});  // which groups are unfolded
  const [pos, setPos] = useState("br");  // where the icon sits: tl, tr, bl, br; remembered per user on the server (PrefsSync keeps "aiLivePos")
  useEffect(() => { try { const v = localStorage.getItem("aiLivePos"); if (["tl", "tr", "bl", "br"].includes(v)) setPos(v); } catch {} }, [allowed]);
  const place = (v) => { setPos(v); try { localStorage.setItem("aiLivePos", v); } catch {} };
  const [design, setDesign] = useState(getActiveDesign());  // the design of the AI creator that is open: its own counter
  const [dcost, setDcost] = useState(null);
  useEffect(() => { const h = (e) => { setDesign(e.detail || null); setDcost(null); }; window.addEventListener(ACTIVE_DESIGN_EVENT, h); return () => window.removeEventListener(ACTIVE_DESIGN_EVENT, h); }, []);
  const [dlist, setDlist] = useState([]);  // the costs of every design, each with its own counter
  const loadDesign = useCallback(async () => {
    try { const d = await api("/sitecreator/costs/"); setDlist(d.designs || []); } catch { /* quiet: no right for designs */ }
    if (!design?.id) return;
    try { setDcost(await api(`/sitecreator/${design.id}/costs/`)); } catch { /* quiet */ }
  }, [design?.id]);
  const resetDesign = async (id = design?.id) => {
    if (!id) return;
    if (!(await confirmDialog(tx("De teller van dit ontwerp op nul zetten? De kosten zelf blijven in de lijst met alle AI-kosten staan."), { title: tx("Teller resetten"), okLabel: tx("Resetten") }))) return;
    try { await api(`/sitecreator/${id}/costs/`, { method: "POST", body: {} }); await loadDesign(); } catch { /* quiet */ }
  };
  const last = useRef(0);
  const first = useRef(true);
  const openRef = useRef(false);
  openRef.current = open;

  const poll = useCallback(async () => {
    try {
      const d = await api(`/admin/ai/live/${last.current ? `?after=${last.current}` : ""}`);
      setMeta({ currency: d.currency, super: d.super });
      if (d.today) setSums({ today: d.today, month: d.month });
      setRunning(d.running || []);
      if (d.top > last.current) last.current = d.top;
      if (d.rows.length) {
        setRows((cur) => [...d.rows, ...cur].slice(0, 80));
        if (!first.current) { if (!openRef.current) setFresh((n) => n + d.rows.length); setPulse(true); setTimeout(() => setPulse(false), 1800); }
      }
      first.current = false;
      loadDesign();
    } catch { /* quiet: the item simply stays as it is */ }
  }, [loadDesign]);
  useUpdates("ai-live-window", poll, 1500, null, allowed && open, { live: true }); // only asks while the small window is open ...
  useUpdates("ai-live-badge", poll, 20000, null, allowed && !open);  // ... and now and then for the counter on the icon when it is closed
  useEffect(() => { if (open) setFresh(0); }, [open]);
  useEffect(() => { if (open) loadDesign(); }, [open, loadDesign]);
  if (!allowed) return null;  // (always there in the back office, also before the first AI call: the costs of a design that is being made appear when it is ready)

  const symbol = (() => { try { return new Intl.NumberFormat("nl-NL", { style: "currency", currency: meta.currency || "EUR", currencyDisplay: "narrowSymbol" }).formatToParts(0).find((x) => x.type === "currency")?.value || meta.currency; } catch { return meta.currency || "€"; } })(); // € for euro, $ for dollar ...
  const sym = meta.currency, busyCost = running.reduce((a, r) => a + (r.charged || 0), 0), tot = rows.reduce((a, r) => a + (r.charged || 0), 0) + busyCost;
  const tokens = rows.reduce((a, r) => a + r.tokens_in + r.tokens_out, 0);
  const failed = rows.filter((r) => !r.ok).length;
  const byKey = {}; // one line per kind of request (total); the single requests unfold on a click
  rows.forEach((r) => { const k = r.source || tx("Onbekend"); const g = byKey[k] || (byKey[k] = { key: k, rows: [], charged: 0, tokens: 0, failed: 0 }); g.rows.push(r); g.charged += r.charged || 0; g.tokens += r.tokens_in + r.tokens_out; if (!r.ok) g.failed++; });
  const groups = Object.values(byKey).sort((x, y) => y.charged - x.charged);
  return (
    <div style={{ position: "fixed", ...(pos[0] === "t" ? { top: "5rem" } : { bottom: "1.1rem" }), ...(pos[1] === "l" ? { left: "1.1rem" } : { right: "1.1rem" }), zIndex: 1200, display: "flex", flexDirection: pos[0] === "t" ? "column-reverse" : "column", alignItems: pos[1] === "l" ? "flex-start" : "flex-end", gap: ".6rem" }}>
      {open && (
        <KitScope><div role="dialog" aria-label={tx("AI-kosten live")} className="e2e-floatwin__panel" data-easy2edit-tag="ui-cost-widget">
          <header className="e2e-live__head" style={{ background: "var(--e2e-primary)", color: "var(--e2e-on-primary, #fff)", borderBottom: 0 }}>
            <b style={{ fontSize: ".78rem", letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600 }}>{tx("AI-kosten live")}</b>
            <span className="e2e-live__tools">
              <button type="button" className="e2e-btn e2e-btn--sm" style={{ background: "rgba(255,255,255,.18)", color: "inherit", border: 0 }} onClick={() => setRows([])} title={tx("Lijst leegmaken")}>{tx("Wissen")}</button>
              <button type="button" className="e2e-btn e2e-btn--sm" style={{ background: "rgba(255,255,255,.18)", color: "inherit", border: 0 }} onClick={() => setOpen(false)} aria-label={tx("Sluiten")}>×</button>
            </span>
          </header>
          <CostSummary solid now={money(tot, sym)} today={sums ? money(sums.today.charged + busyCost, sym) : "—"} month={sums ? money(sums.month.charged + busyCost, sym) : "—"} subs={[`${rows.length} ${tx("verzoeken")} · ${short(tokens)} ${tx("tokens")}${failed ? ` · ${failed} ${tx("mislukt")}` : ""}`, sums ? `${sums.today.calls} ${tx("verzoeken")}` : "", sums ? `${sums.month.calls} ${tx("verzoeken")}` : ""]} />
          {dlist.length > 0 && (
            <div data-easy2edit-tag="ui-cost-widget" style={{ padding: ".5rem .9rem", borderBottom: "1px solid var(--e2e-border)", display: "grid", gap: ".35rem" }}>
              <small className="e2e-hint" style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>{tx("Kosten per ontwerp")}</small>
              {dlist.map((d) => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: ".5rem", fontWeight: design?.id === d.id ? 600 : 400 }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.name}>{d.name}<small className="e2e-hint"> · {d.calls} {tx("verzoeken")}</small></span>
                  <b style={{ fontVariantNumeric: "tabular-nums" }}>{money(d.charged, sym)}</b>
                  <button type="button" className="e2e-btn e2e-btn--sm" onClick={() => resetDesign(d.id)} title={tx("Teller van dit ontwerp op nul zetten")}>{tx("Reset")}</button>
                </div>
              ))}
            </div>
          )}
          {design?.id && (
            <div data-easy2edit-tag="ui-cost-widget" style={{ padding: ".6rem .9rem", borderBottom: "1px solid var(--e2e-border)", display: "grid", gap: ".4rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: ".6rem" }}>
                <span style={{ minWidth: 0 }}><small className="e2e-hint" style={{ display: "block" }}>{tx("Kosten van dit ontwerp")}{design.name ? `: ${design.name}` : ""}</small>
                  <b style={{ fontSize: "1.25rem", fontVariantNumeric: "tabular-nums" }}>{money(dcost?.charged || 0, sym)}</b></span>
                <button type="button" className="e2e-btn e2e-btn--sm" onClick={() => resetDesign()} title={tx("Teller van dit ontwerp op nul zetten")}>{tx("Reset")}</button>
              </div>
              <small className="e2e-hint">{dcost ? `${dcost.calls} ${tx("verzoeken")} · ${short(dcost.tokens)} ${tx("tokens")}` : tx("Bezig…")}</small>
              {dcost?.items?.length > 0 && <Columns values={dcost.items.map((i) => i.charged)} labels={dcost.items.map((_, k) => String(k + 1))} />}
            </div>
          )}
          <ul className="e2e-fold">
            {running.map((r) => (
              <li key={r.id} className="e2e-fold__run" data-easy2edit-tag="ui-cost-widget">
                <i className="e2e-live__dot is-busy" aria-hidden="true" />
                <span>{r.source || tx("Onbekend")}<small>{num(r.tokens_in)} → {num(r.tokens_out)} {tx("tokens")} · {r.seconds.toFixed(0)} s · {tx("bezig")}</small></span>
                <b>{money(r.charged, sym)}</b>
              </li>
            ))}
            {!groups.length && !running.length && <li className="e2e-live__empty" style={{ padding: "1.4rem 1rem" }}>{tx("Nog geen verzoeken in de laatste 30 minuten. Een ontwerp dat nu gemaakt wordt verschijnt hier zodra het klaar is.")}</li>}
            {groups.map((g) => {
              const isOpen = !!openG[g.key];
              return (
                <li key={g.key} className={isOpen ? "is-open" : ""}>
                  <button type="button" className="e2e-fold__head" aria-expanded={isOpen} onClick={() => setOpenG((o) => ({ ...o, [g.key]: !o[g.key] }))}>
                    <span>{g.key} <small className="e2e-hint">{g.rows.length} {tx("verzoeken")} · {short(g.tokens)} {tx("tokens")}{g.failed ? ` · ${g.failed} ${tx("mislukt")}` : ""}</small></span>
                    <b style={{ fontVariantNumeric: "tabular-nums" }}>{money(g.charged, sym)}</b>
                  </button>
                  {isOpen && (
                    <div className="e2e-fold__body">
                      {g.rows.map((r) => (
                        <div key={r.id} style={{ opacity: r.ok ? 1 : .7 }}>
                          <span>{new Date(r.at).toLocaleTimeString()} · {r.model || "—"} · {num(r.tokens_in)} → {num(r.tokens_out)} · {(r.ms / 1000).toFixed(1)} s{r.web ? ` · ${tx("web")}` : ""}{r.images ? ` · ${r.images} ${tx("foto's")}` : ""}{r.user ? ` · ${r.user}` : ""}{!r.ok ? ` · ${tx("mislukt")}` : ""}</span>
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(r.charged, sym)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <footer style={{ padding: ".55rem .9rem", borderTop: "1px solid var(--e2e-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".6rem" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: ".4rem" }} role="group" aria-label={tx("Plek van het icoon")}>
              <small className="e2e-hint">{tx("Plek")}</small>
              {[["tl", "Linksboven"], ["tr", "Rechtsboven"], ["bl", "Linksonder"], ["br", "Rechtsonder"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => place(k)} aria-pressed={pos === k} title={tx(l)} aria-label={tx(l)}
                  style={{ position: "relative", width: 24, height: 18, padding: 0, borderRadius: 4, border: `1px solid ${pos === k ? "var(--e2e-primary)" : "var(--e2e-border)"}`, background: "var(--e2e-surface)", cursor: "pointer" }}>
                  <i style={{ position: "absolute", width: 7, height: 7, borderRadius: "50%", background: pos === k ? "var(--e2e-primary)" : "var(--e2e-muted)", ...(k[0] === "t" ? { top: 2 } : { bottom: 2 }), ...(k[1] === "l" ? { left: 2 } : { right: 2 }) }} />
                </button>
              ))}
            </span>
            <Link href="/dashboard/admin/ai-kosten">{tx("Alle AI-kosten")} →</Link>
          </footer>
        </div></KitScope>
      )}
      <KitScope>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={tx("AI-kosten live")} title={tx("AI-kosten live")}
        className="e2e-floatwin__btn" data-easy2edit-tag="ui-cost-widget" style={{ position: "relative", display: "grid", placeItems: "center", padding: 0, boxShadow: pulse ? "0 0 0 8px color-mix(in srgb, var(--e2e-primary) 30%, transparent), 0 8px 24px rgba(0,0,0,.4)" : undefined, transition: "box-shadow .4s" }}>
        <span aria-hidden="true">{symbol}</span>
        {fresh > 0 && !open && <span style={{ position: "absolute", top: -6, right: -6, minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999, background: "var(--danger, #dc2626)", color: "#fff", fontSize: ".72rem", display: "grid", placeItems: "center" }}>{fresh > 99 ? "99+" : fresh}</span>}
      </button>
      </KitScope>
    </div>
  );
}

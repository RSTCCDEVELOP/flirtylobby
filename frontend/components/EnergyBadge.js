// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { tx } from "../lib/t";
import { LineChart, Rating } from "./EnergyBlocks";
import Tabs from "./Tabs";
import EcologiTree, { nextGoal } from "./EcologiTree";
import { Legend, StackedBars } from "./EcologiCharts";
import { IconCheck, IconTree, IconX } from "./Icons";

const nf = (n, d = 1) => { try { return new Intl.NumberFormat(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(n); } catch { return String(n); } };
const kb = (b) => (b >= 1e6 ? `${nf(b / 1e6, 2)} MB` : `${nf(b / 1e3, 0)} KB`);
const money = (n, cur = "EUR") => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "EUR" }).format(n || 0); } catch { return `${cur} ${nf(n || 0, 2)}`; } };
const mon = (ym) => { try { return new Date(`${ym}-01T00:00:00`).toLocaleDateString([], { month: "short" }); } catch { return ym; } };
const MORE = "https://easy2edit.com/#groen";
const SRC = ["visitors", "machine", "user", "admin_gift", "hand"];
const SRCN = { visitors: "Bezoekers", machine: "Machine (energie)", user: "Gebruiker (beheerder)", admin_gift: "Gift van de beheerder", hand: "Handmatig" };
const hm = (iso) => { try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const STATUS = {
  green: ["Groen: een lichte website", "Deze website laadt weinig data en gebruikt daardoor weinig stroom."],
  orange: ["Kan groener", "Het gemiddelde paginagewicht is wat hoog. Lichtere afbeeldingen maken de website groener."],
  red: ["Te zwaar", "Het gemiddelde paginagewicht is hoog: de website gebruikt relatief veel stroom."],
  "": ["Nog niet gemeten", "Er zijn nog geen metingen. De eerste paginabezoeken worden vanzelf gemeten."],
};

// The energy label next to "© easy2edit" at the bottom of the website: a small leaf with the label; a click opens the insights and the green status.
// What it shows is chosen by the administrator (Admin -> Energie). `b` is the answer of /api/energy/badge/.
export default function EnergyBadge({ b }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("trees");
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  if (!b?.enabled) return null;
  const st = b.status || "";
  const [title, text] = STATUS[st] || STATUS[""];
  const show = b.show || [];
  const tiles = [
    show.includes("co2") && b.co2_g !== undefined && [tx("CO2 per paginabezoek"), `${nf(b.co2_g, 3)} g`],
    show.includes("size") && b.page_bytes !== undefined && [tx("Gemiddeld paginagewicht"), kb(b.page_bytes)],
    show.includes("energy") && b.page_wh !== undefined && [tx("Stroom per paginabezoek"), `${nf(b.page_wh, 2)} Wh`],
    show.includes("views") && b.views !== undefined && [tx("Paginabezoeken"), nf(b.views, 0)],
    b.trees !== undefined && [tx("Bomen geplant"), nf(b.trees, 0)],
  ].filter(Boolean);
  const e = b.eco;
  const months = (e?.months || []).map((m) => ({ label: mon(m.month), parts: m.trees }));
  const srcTotal = e ? SRC.reduce((a, k) => a + (e.by_source[k] || 0), 0) : 0;
  const more = <a className="eco-more" href={MORE} target="_blank" rel="noopener noreferrer">{tx("Meer info")}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></a>;
  const treesPanel = e && (
    <div className="eco eco-pop">
      <div className="eco-hero">
        <div className="eco-hero-top">
          <EcologiTree value={e.trees} size={92} light caption={false} />
          <div className="eco-hero-main"><strong>{nf(e.trees, 0)}</strong><small>{tx("Bomen geplant voor deze website")}</small></div>
        </div>
        <div className="eco-hero-cols">
          <div><small>{tx("Volgende mijlpaal")}</small><b>{nf(nextGoal(e.trees), 0)}</b></div>
          <div><small>{tx("Nog te planten")}</small><b>{nf(Math.max(0, nextGoal(e.trees) - e.trees), 0)}</b></div>
          <div><small>{tx("Op het Ecologi-profiel")}</small><b>{e.profile != null ? nf(e.profile, 0) : "-"}</b></div>
        </div>
      </div>
      {e.test_mode && <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>{tx("Testmodus: de bedragen en bomen hieronder zijn nog proefbestellingen.")}</p>}
      <div className="eco-tiles">
        <div className="eco-tile t-sun"><span>{tx("Totaal gedoneerd")}</span><strong>{money(e.donated, e.currency)}</strong><small>{nf(e.orders, 0)} {tx("donaties")}</small></div>
        <div className="eco-tile t-sea"><span>{tx("Deze maand gepland")}</span><strong>{nf(e.this_month.planned, 0)} {tx("bomen")}</strong><small>{e.this_month.cap ? `${tx("maximum")} ${nf(e.this_month.cap, 0)}` : tx("geen limiet")}</small></div>
        <div className="eco-tile t-green"><span>{tx("Door easy2edit geplant")}</span><strong>{nf(e.easy2edit_month, 0)} {tx("per maand")}</strong></div>
      </div>
      <div className="eco-panel">
        <strong style={{ fontSize: ".9rem" }}>{tx("Waar komen de bomen vandaan")}</strong>
        <div className="eco-rows">
          {SRC.filter((k) => e.by_source[k] > 0).map((k) => (
            <div key={k} className="eco-row"><span><i className={`src-${k}`} />{tx(SRCN[k])}</span><b>{nf(e.by_source[k], 0)} <small className="muted">({srcTotal ? Math.round((e.by_source[k] / srcTotal) * 100) : 0}%)</small></b></div>
          ))}
          {srcTotal === 0 && <small className="muted">{tx("Nog geen bijdragen of giften.")}</small>}
        </div>
      </div>
      {srcTotal > 0 && (
        <div className="eco-panel">
          <strong style={{ fontSize: ".9rem" }}>{tx("Geplante bomen per maand")}</strong>
          <StackedBars months={months} keys={SRC} height={150} label={tx("Geplante bomen per maand")} />
          <Legend keys={SRC.filter((k) => months.some((m) => m.parts[k]))} />
        </div>
      )}
      <div className="eco-foot"><small className="muted">{tx("Elke bijdrage telt: bezoeken, energiegebruik en gebruikers van easy2edit planten samen bomen met Ecologi.")}</small>{more}</div>
    </div>
  );
  const pts = (b.live?.points || []).map((p) => ({ x: hm(p.t), y: p.w }));
  return (
    <>
      <button type="button" className={`energy-badge st-${st || "none"}`} onClick={() => { setTab("trees"); setOpen(true); }} aria-haspopup="dialog" title={tx(title)} aria-label={`${tx("Energie van deze website")}: ${tx(title)}`}>
        <IconTree width={15} height={15} />
        {show.includes("rating") && b.rating ? <strong>{b.rating}</strong> : null}
        <i className="energy-dot" aria-hidden="true" />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="overlay energy-badge-back" onClick={() => setOpen(false)}>
          <div className="card modal energy-badge-pop" role="dialog" aria-label={tx("Energie van deze website")} onClick={(e) => e.stopPropagation()}>
            <div className="energy-badge-head">
              <span className="energy-badge-logo"><img src="/logos/easy2edit/logo.png" alt="easy2edit" className="logo-light has-dark" /><img src="/logos/easy2edit/logo_dark.png" alt="easy2edit" className="logo-dark" /></span>
              <span style={{ flex: 1 }} />
              <button type="button" className="pb-panelx" onClick={() => setOpen(false)} aria-label={tx("Sluiten")}><IconX width={16} height={16} /></button>
            </div>
            <h2 style={{ margin: ".2rem 0 0" }}>{e && tab === "trees" ? tx("Groene website: bomen en donaties") : tx("Energie van deze website")}</h2>
            {e && <Tabs tabs={[["trees", "Bomen planten", <IconTree key="t" />], ["energy", "Energie", <IconCheck key="e" />]]} value={tab} onChange={setTab} />}
            {e && tab === "trees" ? treesPanel : <>
            <div className={`energy-status st-${st || "none"}`}>
              <span className="energy-status-ico">{st === "green" ? <IconCheck width={18} height={18} /> : <IconTree width={18} height={18} />}</span>
              <span><strong>{tx(title)}</strong><br /><small>{tx(text)}</small></span>
              {show.includes("rating") && b.rating && <Rating r={b.rating} size={46} />}
            </div>
            {tiles.length > 0 && (
              <div className="energy-badge-tiles">
                {tiles.map(([l, v]) => <div key={l} className="card"><small className="muted">{l}</small><strong>{v}</strong></div>)}
              </div>
            )}
            {show.includes("compare") && b.vs_pct !== undefined && b.vs_pct !== null && (
              <p className="muted" style={{ margin: 0 }}>{b.vs_pct <= 0 ? tx("{0}% lichter dan een gemiddelde webpagina.", String(Math.abs(Math.round(b.vs_pct)))) : tx("{0}% zwaarder dan een gemiddelde webpagina.", String(Math.round(b.vs_pct)))}</p>
            )}
            {show.includes("live") && pts.length > 0 && (
              <div className="card" style={{ padding: ".6rem .8rem .4rem", boxShadow: "none" }}>
                <small className="muted">{tx("Geschat stroomgebruik, laatste 24 uur")}</small>
                <LineChart points={pts} height={110} color="#16a34a" format={(v) => `${nf(v, v < 10 ? 2 : 1)} W`} label={tx("Geschat stroomgebruik")} />
              </div>
            )}
            <small className="muted">{tx("Een schatting uit de data die bezoekers laden; servers, netwerk en apparaten inbegrepen. Er worden geen persoonsgegevens gebruikt.")}</small>
            {e && <div className="eco-foot">{more}</div>}
            </>}
            {!e || tab === "energy" ? null : null}
          </div>
        </div>, document.body)}
    </>
  );
}

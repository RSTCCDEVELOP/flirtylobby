// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { getLanguage, tx } from "../lib/t";

const STYLES = [["list", "Lijst"], ["next", "Eerstvolgende"], ["week", "Week"], ["month", "Maand"], ["compact", "Compact"]];
const HEX = { blue: "#3b82f6", orange: "#f97316", green: "#16a34a", pink: "#ec4899", purple: "#8b5cf6", teal: "#0d9488", red: "#dc2626", gray: "#64748b" };
const KEY = "agenda:tile";
const day = (iso, all) => (all ? String(iso).slice(0, 10) : new Date(iso).toLocaleDateString("sv-SE"));
const time = (e) => (e.all_day ? tx("Hele dag") : new Date(e.starts_at).toLocaleTimeString(getLanguage(), { hour: "2-digit", minute: "2-digit" }));
const when = (e) => new Date(e.all_day ? `${String(e.starts_at).slice(0, 10)}T12:00:00` : e.starts_at).toLocaleDateString(getLanguage(), { weekday: "short", day: "numeric", month: "short" });

// The agenda tile of the dashboard (plugin Agenda). The member picks how it looks: list, next appointment, week, month or compact; the colours follow the community theme.
export default function AgendaTile({ ctx }) {
  const [d, setD] = useState(undefined);
  const [style, setStyle] = useState("list");
  useEffect(() => { try { const s = localStorage.getItem(KEY); if (STYLES.some(([k]) => k === s)) setStyle(s); } catch {} }, []);
  const load = useCallback(() => api(`/plugins/run/agenda/upcoming?limit=${style === "month" || style === "week" ? 30 : 6}`).then(setD).catch(() => setD(null)), [style]);
  useEffect(() => { load(); }, [load]);
  const answer = async (id, status) => { try { await api(`/plugins/run/agenda/events/${id}/respond`, { method: "POST", body: { status } }); await load(); } catch {} };
  const pick = (k) => { setStyle(k); try { localStorage.setItem(KEY, k); } catch {} };
  const items = d?.items || [];
  const lang = getLanguage();
  const today = new Date();

  const rows = (list) => list.map((e, i) => (
    <Link key={`${e.id}-${i}`} href="/dashboard/plugins/agenda" className="ag-row">
      <span className="ag-bar" style={{ background: HEX[e.color] || HEX.blue }} />
      <span className="ag-when">{when(e)}<small>{time(e)}</small></span>
      <span className="ag-main"><strong>{e.title}</strong>{e.location && <small>📍 {e.location}</small>}</span>
      {e.my_status === "invited" && <span className="badge ag-badge">{tx("Uitgenodigd")}</span>}
    </Link>
  ));
  let body;
  if (d === undefined) body = <p className="muted">{tx("Laden…")}</p>;
  else if (d === null) body = <p className="muted">{tx("Niet beschikbaar.")}</p>;
  else if (!items.length) body = <p className="muted" style={{ margin: 0 }}>{tx("Geen komende afspraken.")}</p>;
  else if (style === "next") {
    const e = items[0], ms = new Date(e.starts_at) - today, days = Math.ceil(ms / 86400000);
    body = (
      <Link href="/dashboard/plugins/agenda" className="ag-next" style={{ background: `linear-gradient(135deg, ${HEX[e.color] || HEX.blue}, var(--ag-ac2))` }}>
        <small>{tx("Eerstvolgende")}</small>
        <strong>{e.title}</strong>
        <span>{when(e)} · {time(e)}</span>
        <em>{ms < 0 ? tx("Nu bezig") : days <= 0 ? tx("Vandaag") : days === 1 ? tx("Morgen") : tx("Over {0} dagen", days)}</em>
      </Link>
    );
  } else if (style === "week") {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    body = (
      <div className="ag-week">
        {Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)).map((dt) => {
          const k = dt.toLocaleDateString("sv-SE"), list = items.filter((e) => day(e.starts_at, e.all_day) === k);
          return (
            <div key={k} className={`ag-day ${list.length ? "has" : ""}`}>
              <small>{dt.toLocaleDateString(lang, { weekday: "short" })}</small>
              <b>{dt.getDate()}</b>
              {list.slice(0, 2).map((e, i) => <i key={i} style={{ background: HEX[e.color] || HEX.blue }} title={e.title} />)}
            </div>
          );
        })}
      </div>
    );
  } else if (style === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1), lead = (first.getDay() + 6) % 7, n = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const marks = new Set(items.map((e) => day(e.starts_at, e.all_day)));
    body = (
      <div>
        <strong>{today.toLocaleDateString(lang, { month: "long", year: "numeric" })}</strong>
        <div className="ag-month">
          {Array.from({ length: 7 }, (_, i) => <span key={`h${i}`} className="h">{new Date(2021, 7, 2 + i).toLocaleDateString(lang, { weekday: "narrow" })}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: n }, (_, i) => { const k = new Date(today.getFullYear(), today.getMonth(), i + 1).toLocaleDateString("sv-SE"); return <span key={k} className={`${i + 1 === today.getDate() ? "t" : ""} ${marks.has(k) ? "e" : ""}`}>{i + 1}</span>; })}
        </div>
      </div>
    );
  } else if (style === "compact") body = <div className="ag-compact">{items.slice(0, 4).map((e, i) => <Link key={i} href="/dashboard/plugins/agenda"><span style={{ background: HEX[e.color] || HEX.blue }} />{time(e)} {e.title}</Link>)}</div>;
  else body = <div className="ag-list">{rows(items)}</div>;

  return (
    <div className={`agenda-tile ag-${ctx?.theme || "normal"}`}>
      <div className="ag-head">
        <span className="muted">{d?.today > 0 ? tx("{0} vandaag", d.today) : tx("Komende afspraken")}{d?.pending > 0 && <span className="cart-count" style={{ marginLeft: ".4rem" }}>{d.pending}</span>}</span>
        <span className="ag-styles" role="group" aria-label={tx("Weergave")}>
          {STYLES.map(([k, l]) => <button key={k} type="button" className={style === k ? "on" : ""} onClick={() => pick(k)} title={tx(l)} aria-label={tx(l)}>{{ list: "☰", next: "⏱", week: "▦", month: "📅", compact: "≡" }[k]}</button>)}
        </span>
      </div>
      {d?.invites?.length > 0 && (
        <div className="ag-invites">
          <strong>{tx("Uitnodigingen")}</strong>
          {d.invites.map((e) => (
            <div key={e.id} className="ag-inv">
              <span className="ag-bar" style={{ background: HEX[e.color] || HEX.blue }} />
              <span className="ag-main"><strong>{e.title}</strong><small>{e.from && `${e.from} · `}{when(e)} {time(e)}</small></span>
              <span className="ag-inv-btns">
                <button type="button" className="btn sm primary" onClick={() => answer(e.id, "accepted")}>{tx("Accepteren")}</button>
                <button type="button" className="btn sm" onClick={() => answer(e.id, "declined")}>{tx("Afwijzen")}</button>
              </span>
            </div>
          ))}
        </div>
      )}
      {body}
      <Link className="btn sm" style={{ marginTop: ".6rem" }} href="/dashboard/plugins/agenda">{tx("Open agenda")}</Link>
    </div>
  );
}

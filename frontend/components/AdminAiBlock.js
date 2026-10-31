// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { useModules } from "./Modules";
import { can } from "../lib/perms";
import AiCreditPopup from "./AiCreditPopup";
import PdfButton from "./AiPdfButton";
import { money, num, short } from "./AiCharts";

const GROUP_NAME = { user: "Gebruiker", admin: "Admin" };

// A block on the admin page: the AI use of the users and admins (not of the superadmins), the own credit with a button to top it up, and for a superadmin a button per user to put credit on.
export default function AdminAiBlock() {
  const { user } = useAuth();
  const mods = useModules();
  const allowed = !!user && mods.ai !== false && (user.is_staff || can(user, "ai.manage"));
  const [period, setPeriod] = useState("month");
  const [d, setD] = useState(null);
  const [me, setMe] = useState(null);
  const [buy, setBuy] = useState(false);
  const [adj, setAdj] = useState(null); // a superadmin puts credit on a user: { row, amount, note }
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    api(`/ai/admin/overview/?users=1&period=${period}`).then(setD).catch((e) => setErr(errorText(e)));
    api("/ai/me/").then(setMe).catch(() => {});
  }, [period]);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);
  if (!allowed) return null;
  const cur = d?.currency || me?.currency || "EUR", m = (n) => money(n, cur);
  const save = async () => {
    try { await api("/admin/ai/credit/", { method: "POST", body: { user_id: adj.row.user_id, amount: adj.amount, note: adj.note } }); setAdj(null); load(); }
    catch (e) { setErr(errorText(e)); }
  };
  return (
    <div className="ai-adminblock">
      {err && <div className="alert">{err}</div>}
      <div className="row" style={{ justifyContent: "space-between", gap: ".6rem" }}>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label={tx("Periode")} style={{ width: "auto" }}>
          {[["week", "Laatste 7 dagen"], ["month", "Laatste 30 dagen"], ["quarter", "Laatste 90 dagen"], ["year", "Laatste jaar"]].map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}
        </select>
        <Link className="btn sm" href="/dashboard/admin/ai">{tx("Volledig overzicht")}</Link>
      </div>
      {!d && !err && <p className="muted">{tx("Laden…")}</p>}
      {d && (<>
        {me && (
          <div className="card ai-credit">
            <div>
              <small className="muted">{tx("Mijn AI-tegoed")}</small>
              <strong style={{ fontSize: "1.6rem", display: "block" }}>{money(me.balance, me.currency)}</strong>
              <small className="muted">{me.exempt ? tx("Superadmins hebben geen tegoed nodig; je kunt wel opwaarderen.") : me.credit_required ? tx("Tegoed is verplicht om AI te gebruiken.") : tx("Tegoed is niet verplicht; je kunt wel vooruit opwaarderen.")}</small>
            </div>
            <div className="row" style={{ gap: ".5rem", justifyContent: "flex-end" }}>
              {user.is_staff && <Link className="btn" href="/dashboard/superadmin/ai">{tx("Tegoed beheren")}</Link>}
              <button type="button" className="btn primary" onClick={() => setBuy(true)}>{tx("Opwaarderen")}</button>
            </div>
          </div>
        )}
        <div className="ai-kpis">
          <div><small className="muted">{tx("Aanroepen")}</small><strong>{num(d.totals.calls)}</strong></div>
          <div><small className="muted">{tx("Tokens in / uit")}</small><strong>{short(d.totals.tokens_in)} / {short(d.totals.tokens_out)}</strong></div>
          <div><small className="muted">{tx("Kosten")}</small><strong>{m(d.totals.charged)}</strong></div>
          <div><small className="muted">{tx("Actieve gebruikers")}</small><strong>{num(d.totals.users)}</strong></div>
        </div>
        <div className="table-wrap"><table className="table"><thead><tr><th>{tx("Gebruiker")}</th><th>{tx("Groep")}</th><th>{tx("Aanroepen")}</th><th>{tx("Kosten")}</th><th>{tx("Tegoed")}</th><th /></tr></thead>
          <tbody>{d.by_user.slice(0, 10).map((r, i) => (
            <tr key={i}><td>{r.user}</td><td>{tx(GROUP_NAME[r.group] || r.group)}</td><td>{num(r.calls)}</td><td><strong>{m(r.charged)}</strong></td><td>{r.balance == null ? "–" : m(r.balance)}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                {user.is_staff && r.user_id && <button type="button" className="btn sm" onClick={() => setAdj({ row: r, amount: "10", note: "" })}>{tx("Opwaarderen")}</button>}{" "}
                {r.user_id ? <PdfButton compact who={r.user} base="/ai/admin/report/" name={`easy2edit-ai-${r.user.replace(/[^a-z0-9]+/gi, "-")}`} query={`kind=usage&user=${r.user_id}&period=${period}`} onError={(e) => setErr(errorText(e))} /> : null}
              </td></tr>))}
            {!d.by_user.length && <tr><td colSpan={6} className="muted">{tx("Nog geen AI-gebruik in deze periode.")}</td></tr>}</tbody></table></div>
      </>)}
      <details className="ai-how">
        <summary>{tx("Hoe werkt het AI-tegoed?")}</summary>
        <ul>
          <li><strong>{tx("Tegoed")}:</strong> {user.is_staff ? tx("een voorschot waarmee AI wordt gebruikt. Elke aanroep wordt van het tegoed afgeboekt, tegen de prijs per token (in en uit) met de marge van de reseller.") : tx("een voorschot waarmee AI wordt gebruikt. Elke aanroep wordt van het tegoed afgeboekt, tegen de prijs per token (in en uit).")}</li>
          <li><strong>{tx("Wanneer verplicht")}:</strong> {user.is_staff ? tx("de superadmin zet dat aan (Super admin → AI → Tegoed, of per standaard installatie). Gebruikers en admins zonder tegoed kunnen dan geen AI gebruiken. Superadmins en het systeem hebben geen tegoed nodig.") : tx("Gebruikers en admins zonder tegoed kunnen geen AI gebruiken.")}</li>
          <li><strong>{tx("Opwaarderen")}:</strong> {tx("kies met de schuifbalk een bedrag; het voorstel volgt uit het gebruik van de laatste 30 dagen. Je betaalt via de betaalkoppeling en na de betaling wordt het tegoed direct bijgeschreven.")}</li>
          <li><strong>{tx("Tegoed beheren")}:</strong> {tx("alleen de superadmin: de schakelaar, de bedragen van de schuifbalk en het bijschrijven of afboeken per gebruiker.")}</li>
          <li><strong>{tx("Inzicht")}:</strong> {tx("hierboven zie je per gebruiker het gebruik, de kosten en het tegoed; met de PDF-knop maak je een rapport per gebruiker, zonder inkoopprijzen.")}</li>
        </ul>
      </details>
      {buy && me && <AiCreditPopup info={me} onClose={() => { setBuy(false); load(); }} />}
      {adj && (
        <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setAdj(null); }}>
          <div className="card modal form" role="dialog" aria-label={tx("Opwaarderen")} style={{ maxWidth: 420 }} onMouseDown={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0 }}>{tx("Tegoed aanpassen")}: {adj.row.user}</h2>
            <p className="muted" style={{ margin: 0 }}>{tx("Een negatief bedrag boekt tegoed af.")}</p>
            <label>{tx("Bedrag")} ({cur})<input type="number" step="0.5" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} autoFocus /></label>
            <label>{tx("Omschrijving")}<input value={adj.note} maxLength={200} onChange={(e) => setAdj({ ...adj, note: e.target.value })} placeholder={tx("Bijvoorbeeld: cadeau of correctie")} /></label>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => setAdj(null)}>{tx("Annuleren")}</button>
              <button type="button" className="btn primary" disabled={!Number(adj.amount)} onClick={save}>{tx("Opslaan")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

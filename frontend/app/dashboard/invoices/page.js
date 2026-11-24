// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useMemo, useState } from "react";
import { api, errorText } from "../../../lib/api";
import { tx } from "../../../lib/t";
import { money } from "../../../components/AiCharts";

// The invoices of the easy2edit server (the master): a customer sees his own, a reseller those of the websites he sells, a superadmin+ all of them (and records that one is paid).
const STATUS = { open: "Open", paid: "Betaald", void: "Vervallen" };
const day = (s) => (s ? new Date(s).toLocaleDateString() : "");

export default function InvoicesPage() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);  // the invoice that is shown
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  useEffect(() => { api("/invoices/").then(setD).catch((e) => setErr(errorText(e))); }, []);
  const rows = useMemo(() => (d?.invoices || []).filter((i) => (!st || i.status === st) && `${i.number} ${i.bill_name} ${i.site} ${i.reseller}`.toLowerCase().includes(q.trim().toLowerCase())), [d, q, st]);
  const show = async (i) => { setErr(""); try { setOpen(await api(`/invoices/${i.id}/`)); } catch (e) { setErr(errorText(e)); } };
  const paid = async (on) => {
    try { const r = await api(`/invoices/${open.id}/paid/`, { method: "POST", body: { paid: on } }); setOpen(r); setD({ ...d, invoices: d.invoices.map((x) => (x.id === r.id ? { ...x, status: r.status, paid_at: r.paid_at } : x)) }); }
    catch (e) { setErr(errorText(e)); }
  };
  if (!d) return err ? <div className="alert">{err}</div> : <p className="muted">{tx("Bezig…")}</p>;
  const total = rows.filter((i) => i.status === "open").reduce((a, i) => a + i.incl, 0);
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{tx("Facturen")}</h1>
      <p className="muted" style={{ margin: 0 }}>{d.role === "superadmin" ? tx("Alle facturen van easy2edit.") : d.role === "reseller" ? tx("De facturen van de websites van jouw klanten.") : tx("Jouw facturen van easy2edit: AI-tegoed, licentie, hosting en meer.")}</p>
      {err && <div className="alert">{err}</div>}
      <div className="wl-top">
        <div className="lg-search" style={{ flex: "1 1 260px", maxWidth: 420 }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoek een factuur…")} aria-label={tx("Zoeken")} /></div>
        <div className="lg-seg" role="group" aria-label={tx("Status")}>
          {[["", "Alles"], ["open", "Open"], ["paid", "Betaald"]].map(([k, l]) => <button type="button" key={k} className={st === k ? "on" : ""} aria-pressed={st === k} onClick={() => setSt(k)}>{tx(l)}</button>)}
        </div>
      </div>
      {!rows.length ? <p className="muted">{tx("Er zijn geen facturen.")}</p> : (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="table" style={{ width: "100%" }}>
            <thead><tr><th>{tx("Factuur")}</th><th>{tx("Op naam van")}</th>{d.role !== "customer" && <th>{tx("Website")}</th>}{d.role === "superadmin" && <th>{tx("Reseller")}</th>}<th>{tx("Datum")}</th><th style={{ textAlign: "right" }}>{tx("Bedrag")}</th><th>{tx("Status")}</th></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} onClick={() => show(i)} style={{ cursor: "pointer" }}>
                  <td><strong>{i.number}</strong></td><td>{i.bill_name || "—"}</td>{d.role !== "customer" && <td>{i.site}</td>}{d.role === "superadmin" && <td>{i.reseller}</td>}
                  <td>{day(i.issued_at)}</td><td style={{ textAlign: "right" }}>{money(i.incl, i.currency)}</td><td><span className={`badge ${i.status === "paid" ? "ok" : ""}`}>{tx(STATUS[i.status] || i.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.some((i) => i.status === "open") && <small className="muted">{tx("Openstaand")}: <strong>{money(total, "EUR")}</strong></small>}
      {open && (
        <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <div className="card modal form" role="dialog" aria-label={tx("Factuur")} style={{ maxWidth: 720 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><h2 style={{ margin: 0 }}>{tx("Factuur")} {open.number}</h2><small className="muted">{day(open.issued_at)}{open.due_at ? ` · ${tx("te betalen voor")} ${day(open.due_at)}` : ""}</small></div>
              <span className={`badge ${open.status === "paid" ? "ok" : ""}`}>{tx(STATUS[open.status] || open.status)}</span>
            </div>
            <div style={{ padding: ".7rem .8rem", borderRadius: 12, border: "1px solid var(--line)", background: "color-mix(in srgb, var(--blue) 5%, var(--card, #fff))" }}>
              <strong>{open.bill_name || "—"}</strong>{open.bill_vat ? <small className="muted"> · {tx("BTW")} {open.bill_vat}</small> : null}
              <div className="muted" style={{ fontSize: ".85rem" }}>{[open.bill_address?.street && `${open.bill_address.street} ${open.bill_address.house_number || ""}`.trim(), [open.bill_address?.postal_code, open.bill_address?.city].filter(Boolean).join(" "), open.bill_address?.country].filter(Boolean).join(", ")}{open.bill_email ? ` · ${open.bill_email}` : ""}</div>
              {open.site && <small className="muted">{tx("Website")}: {open.site}{open.reseller ? ` · ${tx("Reseller")}: ${open.reseller}` : ""}</small>}
            </div>
            <table className="table" style={{ width: "100%" }}>
              <thead><tr><th>{tx("Omschrijving")}</th><th style={{ textAlign: "right" }}>{tx("Excl. btw")}</th><th style={{ textAlign: "right" }}>{tx("Btw")}</th><th style={{ textAlign: "right" }}>{tx("Incl. btw")}</th></tr></thead>
              <tbody>{open.lines.map((l, k) => <tr key={k}><td>{l.description} <small className="muted">· {tx(l.kind_label)}</small></td><td style={{ textAlign: "right" }}>{money(l.amount_ex, open.currency)}</td><td style={{ textAlign: "right" }}>{l.vat_rate}%</td><td style={{ textAlign: "right" }}>{money(l.amount_incl, open.currency)}</td></tr>)}</tbody>
              <tfoot><tr><td><strong>{tx("Totaal")}</strong></td><td style={{ textAlign: "right" }}>{money(open.ex, open.currency)}</td><td style={{ textAlign: "right" }}>{money(open.vat, open.currency)}</td><td style={{ textAlign: "right" }}><strong>{money(open.incl, open.currency)}</strong></td></tr></tfoot>
            </table>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              {d.can_settle && (open.status === "open" ? <button type="button" className="btn primary" onClick={() => paid(true)}>{tx("Als betaald markeren")}</button> : <button type="button" className="btn" onClick={() => paid(false)}>{tx("Weer open zetten")}</button>)}
              <button type="button" className="btn" onClick={() => setOpen(null)}>{tx("Sluiten")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NotificationPrefs from "../../../components/NotificationPrefs";
import DashHero from "../../../components/DashHero";
import Tabs from "../../../components/Tabs";
import Paged from "../../../components/Paged";
import { Busy } from "../../../components/PageLoader";
import { KIND_LABEL, ago } from "../../../components/NotificationFeed";
import { IconCheck, IconX } from "../../../components/Icons";
import { api, errorText } from "../../../lib/api";
import { confirmDialog } from "../../../lib/dialog";
import { tx } from "../../../lib/t";

function Inbox() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => api("/notify/?limit=500").then(setData).catch((e) => { setData({ items: [], unread: 0 }); setError(errorText(e)); }), []);
  useEffect(() => { load(); }, [load]);
  if (!data) return <Busy />;
  const items = data.items.filter((n) => (filter === "unread" ? !n.read : filter ? n.kind === filter : true));
  const kinds = [...new Set(data.items.map((n) => n.kind))];
  const act = async (fn) => { try { await fn(); await load(); } catch (e) { setError(errorText(e)); } };
  const del = (n) => act(() => api(`/notify/${n.id}/`, { method: "DELETE" }));
  const markAll = () => act(() => api("/notify/mark/", { method: "POST", body: { all: true } }));
  const delRead = () => act(() => api("/notify/?read=1", { method: "DELETE" }));
  const delAll = async () => { if (await confirmDialog(tx("Alle meldingen verwijderen? Dit kan niet ongedaan worden gemaakt."), { okLabel: tx("Verwijderen"), cancelLabel: tx("Annuleren") })) act(() => api("/notify/", { method: "DELETE" })); };
  return (
    <>
      {error && <div className="alert">{error}</div>}
      <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", alignItems: "center", marginBottom: ".75rem" }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">{tx("Alle meldingen")}</option>
          <option value="unread">{tx("Ongelezen")}</option>
          {kinds.map((k) => <option key={k} value={k}>{tx(KIND_LABEL[k] || k)}</option>)}
        </select>
        <button type="button" className="btn sm" onClick={markAll} disabled={!data.unread}>{tx("Alles gelezen")}</button>
        <button type="button" className="btn sm" onClick={delRead}>{tx("Gelezen verwijderen")}</button>
        <button type="button" className="btn sm" onClick={delAll} disabled={!data.items.length}>{tx("Alles verwijderen")}</button>
      </div>
      {!items.length ? <p className="muted">{tx("Nog geen meldingen.")}</p> : (
        <div className="card">
          <Paged id="notifications" selector=".notif-list"><div className="notif-list">{items.map((n) => (
            <div key={n.id} className={`notif-page-row ${n.read ? "" : "new"}`}>
              <button type="button" className="notif-main" onClick={async () => { if (!n.read) await api("/notify/mark/", { method: "POST", body: { ids: [n.id] } }).catch(() => {}); if (n.url) (/^https?:/.test(n.url) ? (window.location.href = n.url) : router.push(n.url)); else load(); }}>
                <strong>{n.title}</strong>
                {n.body && <small style={{ whiteSpace: "normal" }}>{n.body}</small>}
                <small className="muted">{tx(KIND_LABEL[n.kind] || n.kind)} · {ago(n.created_at)}</small>
              </button>
              {!n.read && <button type="button" className="btn sm ghost" title={tx("Gelezen")} aria-label={tx("Gelezen")} onClick={() => act(() => api("/notify/mark/", { method: "POST", body: { ids: [n.id] } }))}><IconCheck /></button>}
              <button type="button" className="btn sm ghost" title={tx("Verwijderen")} aria-label={tx("Verwijderen")} onClick={() => del(n)}><IconX /></button>
            </div>
          ))}</div></Paged>
        </div>
      )}
    </>
  );
}

export default function NotificationsPage() {
  const [tab, setTab] = useState("inbox");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("tab") === "prefs") setTab("prefs"); }, []);
  return (
    <>
      <DashHero title="Meldingen" textId="page.notifications.intro" fallback="Lees, verwijder en beheer hier al je meldingen." />
      <Tabs value={tab} onChange={setTab} tabs={[["inbox", "Mijn meldingen"], ["prefs", "Instellingen"]]} />
      <div style={{ marginTop: "1rem" }}>{tab === "inbox" ? <Inbox /> : <NotificationPrefs />}</div>
    </>
  );
}

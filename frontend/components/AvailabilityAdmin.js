"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { availLabel } from "./Availability";

// Admin -> Community -> "Beschikbaar voor": the items members can choose in their profile and search on.
// Items from a module (a game, direct connection, chat, video chat) appear by themselves while that module is on and can be switched off; own items are made here.
export default function AvailabilityAdmin({ langs = [] }) {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [draft, setDraft] = useState({}); // new item per group: {group: {nl: "...", en: "..."}}
  const load = useCallback(() => api("/community/availability/admin/").then(setD).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  const act = async (fn) => { setMsg(null); try { await fn(); await load(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } };
  if (!d) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Laden…")}</p>;
  const codes = (langs.length ? langs : [{ code: "nl", native_name: "Nederlands" }]).filter((l) => l.enabled !== false);
  const add = (g) => act(async () => { await api("/community/availability/admin/", { method: "POST", body: { group: g, label: draft[g] || {} } }); setDraft((x) => ({ ...x, [g]: {} })); });
  const patch = (it, body) => act(() => api(`/community/availability/admin/${it.id}/`, { method: "PATCH", body }));
  return (
    <div className="stack-sm">
      <p className="muted" style={{ margin: 0 }}>{tx("Wat leden in hun profiel kunnen kiezen bij \"Beschikbaar voor\", en waarop ze kunnen zoeken. Games, directe verbinding, chat en videochat komen vanzelf als die onderdelen aan staan; de rest maak je hier.")}</p>
      {msg && <div className="alert">{msg.text}</div>}
      {d.groups.map((g) => {
        const items = d.items.filter((i) => i.group === g.key);
        return (
          <div key={g.key} className="card" style={{ display: "grid", gap: ".5rem" }}>
            <strong>{availLabel(g.label)}</strong>
            {items.map((it) => (
              <div key={it.id} className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap", alignItems: "center", opacity: it.available ? 1 : 0.55 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{availLabel(it.label)}</strong>{" "}
                  {!it.own && <small className="muted">{it.available ? tx("Van een onderdeel (komt vanzelf)") : tx("Onderdeel staat uit")}</small>}
                </span>
                {it.own && <button type="button" className="btn sm" title={tx("Omhoog")} onClick={() => { const i = items.indexOf(it); if (i > 0) patch(it, { order: items[i - 1].order - 1 >= 0 ? items[i - 1].order - 1 : 0 }); }}>↑</button>}
                <label className="check sec-toggle" style={{ margin: 0 }}><span className="switch"><input type="checkbox" checked={it.enabled} onChange={(e) => patch(it, { enabled: e.target.checked })} /><span /></span></label>
                {it.own && <button type="button" className="btn sm danger" onClick={() => act(() => api(`/community/availability/admin/${it.id}/`, { method: "DELETE" }))}>{tx("Verwijder")}</button>}
              </div>
            ))}
            {!items.length && <small className="muted">{tx("Nog geen items.")}</small>}
            <div className="theme-grid" style={{ marginTop: ".3rem" }}>
              {codes.slice(0, 4).map((l) => (
                <label key={l.code}>{l.native_name || l.code}<input value={draft[g.key]?.[l.code] || ""} maxLength={60} onChange={(e) => setDraft({ ...draft, [g.key]: { ...(draft[g.key] || {}), [l.code]: e.target.value } })} placeholder={l.code === "nl" ? tx("Nieuw item") : ""} /></label>
              ))}
            </div>
            <div><button type="button" className="btn sm primary" disabled={!Object.values(draft[g.key] || {}).some((v) => v && v.trim())} onClick={() => add(g.key)}>+ {tx("Item toevoegen")}</button></div>
          </div>
        );
      })}
    </div>
  );
}

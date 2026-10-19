"use client";

import { tx } from "../../../../lib/t";
import { confirmDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useState } from "react";
import Collapsible from "../../../../components/Collapsible";
import { api, errorText } from "../../../../lib/api";

export default function Blocked() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api("/blocks/").then(setList).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (q.trim()) api(`/people/?q=${encodeURIComponent(q)}`).then(setFound).catch(() => {}); else setFound([]); }, [q]);

  const block = async (u) => { if ((await confirmDialog(tx("{0} blokkeren? Jullie kunnen elkaar dan niet meer zien, vinden, berichten of chatten.", u.name)))) { await api("/blocks/", { method: "POST", body: { user: u.id } }); setQ(""); load(); } };
  const unblock = async (u) => { await api(`/blocks/${u.id}/`, { method: "DELETE" }); load(); };

  return (
    <>
      <h1>{tx("Geblokkeerde users")}</h1>
      <p className="muted">{tx("Wie je blokkeert kan jou niet meer zien of vinden in dit systeem, en jij hem of haar ook niet. Berichten, chat en profielen zijn dan voor elkaar onzichtbaar.")}</p>
      {msg && <div className="alert">{msg.text}</div>}
      <Collapsible id="block-add" title={tx("Iemand blokkeren")}>
        <input type="search" placeholder={tx("Zoek een lid op naam…")} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="suggest">{found.map((u) => <button key={u.id} type="button" onClick={() => block(u)}>{u.name} {tx("blokkeren")}</button>)}</div>
        <small className="muted">{tx("Je vindt hier alleen leden die jij kunt zien. Staat iemand er niet bij? Open zijn profielpagina en blokkeer daar.")}</small>
      </Collapsible>
      <Collapsible id="block-list" title={tx("Mijn geblokkeerde users ({0})", list.length)}>
        <div className="int-list">
          {list.map((u) => (
            <div className="card int-item" key={u.id}>
              <div className="int-main"><strong>{u.name}</strong><span className="muted">{tx("Geblokkeerd sinds")} {new Date(u.since).toLocaleDateString("nl-NL")}</span></div>
              <div className="int-actions"><button className="btn sm" onClick={() => unblock(u)}>{tx("Deblokkeren")}</button></div>
            </div>
          ))}
          {!list.length && <p className="muted">{tx("Je hebt niemand geblokkeerd.")}</p>}
        </div>
      </Collapsible>
    </>
  );
}

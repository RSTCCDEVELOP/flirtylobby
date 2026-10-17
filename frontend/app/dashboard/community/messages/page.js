"use client";

import { tx } from "../../../../lib/t";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../../../../lib/api";

const Av = ({ u }) => (u.photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={u.photo.startsWith("http") ? u.photo : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${u.photo}`} alt="" className="avatar-img" data-g={u.gender || undefined} /> : <span className="avatar" data-g={u.gender || undefined}>{u.name[0]}</span>);

export default function Messages() {
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState(null);
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [q, setQ] = useState("");
  const [people, setPeople] = useState([]);
  const [err, setErr] = useState("");
  const box = useRef(null);

  const loadConvs = useCallback(() => api("/messages/conversations/").then(setConvs).catch((e) => setErr(errorText(e))), []);
  const loadThread = useCallback((id) => api(`/messages/with/${id}/`).then((d) => { setThread(d); loadConvs(); }).catch(() => setThread(null)), [loadConvs]);
  useEffect(() => { loadConvs(); const t = setInterval(loadConvs, 15000); return () => clearInterval(t); }, [loadConvs]);
  useEffect(() => { if (active) { loadThread(active.id); const t = setInterval(() => loadThread(active.id), 8000); return () => clearInterval(t); } }, [active, loadThread]);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [thread]);
  useEffect(() => { if (q.trim()) api(`/people/?q=${encodeURIComponent(q)}`).then(setPeople).catch(() => {}); else setPeople([]); }, [q]);

  async function send(e) {
    e.preventDefault();
    setErr("");
    try { setThread(await api(`/messages/with/${active.id}/`, { method: "POST", body: { body, subject } })); setBody(""); setSubject(""); loadConvs(); } catch (ex) { setErr(errorText(ex)); }
  }
  const del = (id) => api(`/messages/item/${id}/`, { method: "DELETE" }).then(() => loadThread(active.id));

  return (
    <>
      <h1>{tx("Berichten")}</h1>
      <p className="muted">{tx("Je privéberichten met andere leden. Ze krijgen een melding per e-mail.")}</p>
      {err && <div className="alert" style={{ marginBottom: ".75rem" }}>{err}</div>}
      <div className="chat" style={{ minHeight: 520 }}>
        <div className="chat-list">
          <input placeholder={tx("Nieuw bericht aan…")} value={q} onChange={(e) => setQ(e.target.value)} />
          {people.filter((p) => p.accept_messages).map((p) => <button key={p.id} className="chat-row" onClick={() => { setActive(p); setQ(""); }}><Av u={p} /> {p.name}</button>)}
          {convs.map((c) => (
            <button key={c.user.id} className={`chat-row ${active?.id === c.user.id ? "active" : ""}`} onClick={() => setActive(c.user)}>
              <Av u={c.user} />
              <span><strong>{c.user.name}</strong><small className="muted">{c.last.subject || c.last.body}</small></span>
              {c.unread > 0 && <span className="cart-count">{c.unread}</span>}
            </button>
          ))}
          {!convs.length && !people.length && <small className="muted" style={{ padding: ".5rem" }}>{tx("Nog geen berichten. Zoek hierboven een lid.")}</small>}
        </div>
        {active ? (
          <div className="chat-thread">
            <div className="chat-head"><strong>{active.name}</strong></div>
            <div className="chat-msgs" ref={box}>
              {thread?.messages.map((m) => (
                <div key={m.id} className={`bubble ${m.from_me ? "me" : ""}`}>
                  {m.subject && <strong>{m.subject}</strong>}
                  <span style={{ whiteSpace: "pre-wrap" }}>{m.body}</span>
                  <small style={{ opacity: .7 }}>{new Date(m.at).toLocaleString("nl-NL")} <button className="link-btn" onClick={() => del(m.id)}>{tx("verwijder")}</button></small>
                </div>
              ))}
              {thread && !thread.messages.length && <p className="muted" style={{ textAlign: "center" }}>{tx("Nog geen berichten.")}</p>}
            </div>
            <form className="chat-input" style={{ flexDirection: "column" }} onSubmit={send}>
              <input placeholder={tx("Onderwerp (optioneel)")} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
              <textarea rows={3} placeholder={tx("Typ je bericht…")} value={body} onChange={(e) => setBody(e.target.value)} required />
              <div><button className="btn primary" disabled={!body.trim()}>{tx("Versturen")}</button></div>
            </form>
          </div>
        ) : <div className="chat-thread" style={{ display: "grid", placeItems: "center" }}><p className="muted">{tx("Kies een gesprek of zoek een lid.")}</p></div>}
      </div>
    </>
  );
}

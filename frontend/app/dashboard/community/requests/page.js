"use client";

import { tx } from "../../../../lib/t";
import { confirmDialog } from "../../../../lib/dialog";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Collapsible from "../../../../components/Collapsible";
import { api, errorText, mediaUrl } from "../../../../lib/api";

const KIND = { friend: "wil vrienden worden", photos: "wil je foto's bekijken", profile: "wil je profiel bekijken" };
const KIND_OWN = { friend: "Vriendschap", photos: "Foto's bekijken", profile: "Profiel bekijken" };
const STATUS = { pending: "In afwachting", declined: "Geweigerd", accepted: "Toegestaan" };

function Who({ u, children }) {
  return (
    <div className="request-row">
      {u.photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(u.photo)} alt="" className="avatar-img" data-g={u.gender || undefined} /> : <span className="avatar" data-g={u.gender || undefined}>{u.name[0]?.toUpperCase()}</span>}
      <span className="grow">
        {u.slug ? <Link href={`/leden/${u.slug}`} style={{ color: "var(--blue)", fontWeight: 600 }}>{u.name}</Link> : <strong>{u.name}</strong>}
        {children[0]}
      </span>
      {children[1]}
    </div>
  );
}

export default function Requests() {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => api("/connections/").then(setD).catch((e) => setError(errorText(e))), []);
  useEffect(() => { load(); }, [load]);
  const act = (fn) => fn().then(load).catch((e) => setError(errorText(e)));
  const respond = (c, action) => act(() => api(`/connections/${c.id}/respond/`, { method: "POST", body: { action } }));
  const remove = async (c, text) => (await confirmDialog(text)) && act(() => api(`/connections/${c.id}/`, { method: "DELETE" }));

  if (!d) return error ? <div className="alert">{error}</div> : <p className="muted">{tx("Laden…")}</p>;
  return (
    <>
      <h1>{tx("Vrienden & verzoeken")}</h1>
      {error && <div className="alert">{error}</div>}

      <Collapsible id="req-in" title={tx("Verzoeken aan jou ({0})", d.incoming.length)}>
        {!d.incoming.length && <p className="muted" style={{ margin: 0 }}>{tx("Geen openstaande verzoeken.")}</p>}
        {d.incoming.map((c) => (
          <Who key={c.id} u={c.user}>
            {[<span key="t" className="muted">{KIND[c.kind]}{c.message ? ` — “${c.message}”` : ""}</span>,
              <span key="a" className="request-actions"><button className="btn sm primary" onClick={() => respond(c, "accept")}>{tx("Accepteren")}</button><button className="btn sm" onClick={() => respond(c, "decline")}>{tx("Weigeren")}</button></span>]}
          </Who>
        ))}
      </Collapsible>

      <Collapsible id="req-friends" title={tx("Vrienden ({0})", d.friends.length)}>
        {!d.friends.length && <p className="muted" style={{ margin: 0 }}>{tx("Je hebt nog geen vrienden. Vrienden zien je wazige foto's en je profiel, ook als dat alleen voor geselecteerde leden is.")}</p>}
        {d.friends.map((c) => (
          <Who key={c.id} u={c.user}>
            {[<span key="t" className="muted">{tx("sinds {0}", new Date(c.at).toLocaleDateString("nl-NL"))}</span>,
              <button key="a" className="btn sm danger" onClick={() => remove(c, `${c.user.name} als vriend verwijderen? Jullie zien elkaars wazige foto's dan niet meer.`)}>{tx("Verwijderen")}</button>]}
          </Who>
        ))}
      </Collapsible>

      <Collapsible id="req-grants" title={tx("Toegang die je hebt gegeven ({0})", d.grants.filter((c) => !c.mine).length)}>
        {!d.grants.some((c) => !c.mine) && <p className="muted" style={{ margin: 0 }}>{tx("Je hebt niemand los toegang gegeven tot je foto's of profiel.")}</p>}
        {d.grants.filter((c) => !c.mine).map((c) => (
          <Who key={c.id} u={c.user}>
            {[<span key="t" className="muted">{KIND_OWN[c.kind]}</span>,
              <button key="a" className="btn sm danger" onClick={() => remove(c, `Toegang van ${c.user.name} intrekken?`)}>{tx("Intrekken")}</button>]}
          </Who>
        ))}
      </Collapsible>

      <Collapsible id="req-out" title={tx("Jouw verzoeken ({0})", d.outgoing.length)}>
        {!d.outgoing.length && <p className="muted" style={{ margin: 0 }}>{tx("Je hebt geen verzoeken verstuurd. Dat doe je op de profielpagina van een lid.")}</p>}
        {d.outgoing.map((c) => (
          <Who key={c.id} u={c.user}>
            {[<span key="t" className="muted">{KIND_OWN[c.kind]} · {STATUS[c.status]}</span>,
              c.status === "pending" ? <button key="a" className="btn sm" onClick={() => remove(c, tx("Verzoek intrekken?"))}>{tx("Intrekken")}</button> : <span key="a" />]}
          </Who>
        ))}
      </Collapsible>
    </>
  );
}

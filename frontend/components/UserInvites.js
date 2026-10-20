"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import Collapsible from "./Collapsible";

const VALID = [[1, "1 uur"], [24, "1 dag"], [72, "3 dagen"], [168, "7 dagen"], [336, "14 dagen"], [720, "30 dagen"]];
const LEVELS = [[0, "Geen"], [1, "Gebruik"], [2, "Bewerken"], [3, "Beheer"]];
const STATUS = { open: ["ok", "Open"], accepted: ["ok", "Geaccepteerd"], expired: ["off", "Verlopen"] };
const EMPTY = { first_name: "", last_name: "", email: "", require_terms: true, terms_url: "", require_email_verify: true, roles: [], groups: [], grants: {}, valid_hours: 168 };
const Switch = ({ checked, onChange, label, hint }) => (
  <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span /></span><span>{label}{hint && <small className="muted" style={{ display: "block" }}>{hint}</small>}</span></label>
);

// "Nodig uit" (Admin → Users): the form (sections fold, one open at a time) and the list of invitations. The button in the page sends the event "invite-open".
export default function UserInvites({ roles, groups }) {
  const [data, setData] = useState({ items: [], modules: [], can_grants: false });
  const [modal, setModal] = useState(null);
  const [open, setOpen] = useState("user");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const load = useCallback(() => api("/invitations/").then(setData).catch((e) => setError(errorText(e))), []);
  useEffect(() => {
    load();
    const on = () => { setOpen("user"); setModal({ ...EMPTY, terms_url: (() => { try { return localStorage.getItem("invite:terms") || ""; } catch { return ""; } })() }); };
    window.addEventListener("invite-open", on);
    return () => window.removeEventListener("invite-open", on);
  }, [load]);

  async function send(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const grants = Object.entries(modal.grants).filter(([, l]) => l > 0).map(([module, level]) => ({ module, level }));
      await api("/invitations/", { method: "POST", body: { ...modal, grants } });
      try { localStorage.setItem("invite:terms", modal.terms_url); } catch {}
      setInfo(tx("Uitnodiging verstuurd naar {0}.", modal.email));
      setModal(null); load();
    } catch (er) {
      setError(er.data && !er.data.detail ? Object.values(er.data).flat().join(" ") : errorText(er));
      setOpen("user");
    }
    setBusy(false);
  }
  const resend = async (i) => { try { await api(`/invitations/${i.id}/resend/`, { method: "POST", body: { valid_hours: 168 } }); setInfo(tx("Nieuwe uitnodiging verstuurd naar {0}.", i.email)); load(); } catch (er) { setError(errorText(er)); } };
  const del = async (i) => { if (await confirmDialog(tx("Uitnodiging voor {0} intrekken?", i.email), { danger: true })) { try { await api(`/invitations/${i.id}/`, { method: "DELETE" }); load(); } catch (er) { setError(errorText(er)); } } };
  const toggle = (k, id) => setModal({ ...modal, [k]: modal[k].includes(id) ? modal[k].filter((x) => x !== id) : [...modal[k], id] });
  const sec = (key, title, body) => (
    <div className="info-acc">
      <button type="button" className="info-acc-head" aria-expanded={open === key} onClick={() => setOpen(open === key ? "" : key)}><span>{tx(title)}</span><span className="info-chev" data-open={open === key}>▾</span></button>
      {open === key && <div style={{ padding: ".6rem .2rem", display: "grid", gap: ".7rem" }}>{body}</div>}
    </div>
  );

  return (
    <>
      <Collapsible id="users-invites" title={tx("Uitnodigingen")}>
        {info && <div className="alert ok">{info}</div>}
        {error && !modal && <div className="alert">{error}</div>}
        {!data.items.length ? <p className="muted">{tx("Nog geen uitnodigingen verstuurd.")}</p> : (
          <table>
            <thead><tr><th>{tx("Naam")}</th><th>{tx("E-mail")}</th><th>{tx("Status")}</th><th>{tx("Geldig tot")}</th><th></th></tr></thead>
            <tbody>
              {data.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.first_name} {i.last_name}</td><td>{i.email}</td>
                  <td><span className={`badge ${STATUS[i.status][0]}`}>{tx(STATUS[i.status][1])}</span></td>
                  <td>{new Date(i.expires_at).toLocaleString()}</td>
                  <td className="actions">
                    {i.status !== "accepted" && <button type="button" className="btn sm" onClick={() => resend(i)}>{tx("Opnieuw versturen")}</button>}
                    <button type="button" className="btn sm danger" onClick={() => del(i)}>{i.status === "accepted" ? tx("Verwijderen") : tx("Intrekken")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Collapsible>
      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form int-modal" onClick={(e) => e.stopPropagation()} onSubmit={send}>
            <h2>{tx("Gebruiker uitnodigen")}</h2>
            {sec("user", "Gebruiker", <>
              <div className="grid2">
                <label>{tx("Voornaam")}<input value={modal.first_name} onChange={(e) => setModal({ ...modal, first_name: e.target.value })} required /></label>
                <label>{tx("Achternaam")}<input value={modal.last_name} onChange={(e) => setModal({ ...modal, last_name: e.target.value })} required /></label>
              </div>
              <label>{tx("E-mailadres")}<input type="email" value={modal.email} onChange={(e) => setModal({ ...modal, email: e.target.value })} required /></label>
            </>)}
            {sec("security", "Voorwaarden en verificatie", <>
              <Switch checked={modal.require_terms} onChange={(v) => setModal({ ...modal, require_terms: v })} label={tx("Voorwaarden accepteren verplicht")} />
              {modal.require_terms && <label>{tx("Link naar de voorwaarden")}<input value={modal.terms_url} placeholder="/voorwaarden" onChange={(e) => setModal({ ...modal, terms_url: e.target.value })} /></label>}
              <Switch checked={modal.require_email_verify} onChange={(v) => setModal({ ...modal, require_email_verify: v })} label={tx("E-mailverificatie verplicht")} hint={tx("De gebruiker voert een code in die per e-mail komt.")} />
            </>)}
            {sec("rights", "Rollen en rechten", <>
              <strong style={{ fontSize: ".85rem" }}>{tx("Rollen")}</strong>
              <div className="perm-list">
                {roles.map((r) => <label className="check" key={r.id}><input type="checkbox" checked={modal.roles.includes(r.id)} onChange={() => toggle("roles", r.id)} /> {r.name} <small className="muted">{r.description}</small></label>)}
                {!roles.length && <span className="muted">{tx("Geen rollen beschikbaar.")}</span>}
              </div>
              <strong style={{ fontSize: ".85rem" }}>{tx("User groups")}</strong>
              <div className="perm-list">
                {groups.map((g) => <label className="check" key={g.id}><input type="checkbox" checked={modal.groups.includes(g.id)} onChange={() => toggle("groups", g.id)} /> {g.name}</label>)}
                {!groups.length && <span className="muted">{tx("Nog geen groepen.")}</span>}
              </div>
            </>)}
            {data.can_grants && sec("modules", "Toegang per module", (
              <div style={{ display: "grid", gap: ".4rem" }}>
                {data.modules.map((m) => (
                  <label key={m.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".5rem" }}>
                    <span>{tx(m.label)} <small className="muted">{tx(m.group)}</small></span>
                    <select value={modal.grants[m.key] || 0} onChange={(e) => setModal({ ...modal, grants: { ...modal.grants, [m.key]: Number(e.target.value) } })}>
                      {LEVELS.map(([v, l]) => <option key={v} value={v}>{tx(l)}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            ))}
            {sec("valid", "Geldigheid van de link", (
              <label>{tx("De link is geldig voor")}
                <select value={modal.valid_hours} onChange={(e) => setModal({ ...modal, valid_hours: Number(e.target.value) })}>{VALID.map(([h, l]) => <option key={h} value={h}>{tx(l)}</option>)}</select>
              </label>
            ))}
            {error && <div className="alert">{error}</div>}
            <div className="row">
              <button type="button" className="btn" onClick={() => setModal(null)}>{tx("Annuleren")}</button>
              <button className="btn primary" disabled={busy}>{busy ? tx("Versturen…") : tx("Uitnodiging versturen")}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

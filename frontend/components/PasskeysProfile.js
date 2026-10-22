"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import { addPasskey, onIpAddress, passkeysSupported } from "../lib/webauthn";

// In the profile: the passkeys of this person (add one from this device, remove one).
export default function PasskeysProfile() {
  const [list, setList] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const load = useCallback(() => api("/auth/passkeys/").then(setList).catch(() => setList([])), []);
  useEffect(() => { load(); }, [load]);
  if (!list) return null;
  const add = async () => {
    setBusy(true); setMsg(null);
    try { await addPasskey(name.trim() || tx("Passkey")); setName(""); setMsg({ ok: true, text: tx("De passkey is toegevoegd.") }); load(); } catch (e) { if (e?.name !== "NotAllowedError") setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const remove = async (p) => {
    if (!(await confirmDialog(tx("De passkey \"{0}\" verwijderen? Daarmee kun je niet meer inloggen.", p.name), { okLabel: tx("Verwijderen"), danger: true }))) return;
    try { await api(`/auth/passkeys/${p.id}/`, { method: "DELETE" }); load(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  return (
    <div className="form" style={{ marginTop: ".8rem" }}>
      <strong style={{ fontSize: ".9rem" }}>{tx("Passkeys")}</strong>
      <p className="muted" style={{ margin: ".2rem 0 .5rem", fontSize: ".85rem" }}>{tx("Log in zonder wachtwoord met je vingerafdruk, gezicht of pincode.")}</p>
      {list.map((p) => (
        <div key={p.id} className="row between" style={{ gap: ".5rem" }}>
          <span>🔑 {p.name} <small className="muted">{p.last_used_at ? `${tx("laatst gebruikt")} ${new Date(p.last_used_at).toLocaleDateString()}` : tx("nog niet gebruikt")}</small></span>
          <button type="button" className="btn sm danger" onClick={() => remove(p)}>{tx("Verwijderen")}</button>
        </div>
      ))}
      {passkeysSupported() ? (
        <div className="row" style={{ gap: ".5rem", flexWrap: "wrap" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tx("Naam, bijvoorbeeld MacBook")} maxLength={80} style={{ maxWidth: 260 }} />
          <button type="button" className="btn" disabled={busy} onClick={add}>{busy ? tx("Bezig…") : tx("Passkey toevoegen")}</button>
        </div>
      ) : onIpAddress() ? (
        <div className="stack" style={{ gap: ".4rem" }}>
          <small className="muted">{tx("Een passkey hoort bij een domeinnaam en werkt niet op een IP-adres. Open deze pagina via https://localhost (op deze computer) of via een domeinnaam.")}</small>
          <div><a className="btn sm" href={`${window.location.protocol}//localhost${window.location.port ? `:${window.location.port}` : ""}${window.location.pathname}`}>{tx("Open via localhost")}</a></div>
        </div>
      ) : <small className="muted">{tx("Passkeys werken alleen op een beveiligd adres (https) in een browser die ze ondersteunt.")}</small>}
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
    </div>
  );
}

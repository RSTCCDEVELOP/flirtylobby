"use client";

import MediaField from "../../../../components/MediaField";
import { tx } from "../../../../lib/t";
import { confirmDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../components/AuthContext";
import VerifyBadge, { VERIFY } from "../../../../components/VerifyBadge";
import Collapsible from "../../../../components/Collapsible";
import Tabs from "../../../../components/Tabs";
import UserInvites from "../../../../components/UserInvites";
import ViewBar from "../../../../components/ViewBar";
import TableView from "../../../../components/TableView";
import { useView } from "../../../../lib/useView";
import { api, errorText, mediaUrl } from "../../../../lib/api";
import { GENDER_LABELS, useGenders } from "../../../../lib/genders";
import { lvl } from "../../../../lib/perms";

const EMPTY = { user_groups: [], email: "", password: "", first_name: "", last_name: "", function: "", short: "", description: "", link: "", link_external: false, show_public: false, verification: "open", roles: [], is_staff: false, file: null };
const initials = (u) => (u.first_name?.[0] || u.email?.[0] || "?").toUpperCase();

export default function Users() {
  const genders = useGenders();
  const tv = useView("users", "list");
  const { user: me } = useAuth();
  const router = useRouter();
  const L = lvl(me, "users"); // 1 gebruik, 2 bewerken, 3 beheer
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // null | form object (with id when editing)

  const load = useCallback(() => api("/users/").then(setUsers).catch((e) => setError(errorText(e))), []);

  useEffect(() => {
    if (lvl(me, "users") < 1) router.replace("/dashboard");
    else { load(); api("/roles/").then(setRoles).catch(() => {}); api("/user-groups/").then(setGroups).catch(() => {}); }
  }, [me, router, load]);

  async function act(fn) {
    setError("");
    try { await fn(); await load(); } catch (e) { setError(errorText(e)); }
  }

  const toggleBlock = (u) => act(() => api(`/users/${u.id}/${u.is_active ? "block" : "unblock"}/`, { method: "POST" }));
  const remove = async (u) => (await confirmDialog(tx("Gebruiker {0} definitief verwijderen?", u.email), { danger: true })) && act(() => api(`/users/${u.id}/`, { method: "DELETE" }));

  async function save(e) {
    e.preventDefault();
    const { id, file, error: _e, image, ...body } = modal;
    if (id && !body.password) delete body.password;
    try {
      const saved = await (id ? api(`/users/${id}/`, { method: "PATCH", body }) : api("/users/", { method: "POST", body }));
      if (file) { // photo chosen while creating
        const fd = new FormData();
        fd.append("image", file);
        await api(`/users/${saved.id}/image/`, { method: "POST", body: fd });
      }
      setModal(null);
      setError("");
      load();
    } catch (err) {
      setModal({ ...modal, error: errorText(err) });
    }
  }

  // photo of an existing user: uploaded / removed straight away
  async function photo(file) {
    if (!modal.id) return setModal({ ...modal, file, preview: file ? URL.createObjectURL(file) : null });
    try {
      let r;
      if (file) { const fd = new FormData(); fd.append("image", file); r = await api(`/users/${modal.id}/image/`, { method: "POST", body: fd }); }
      else r = await api(`/users/${modal.id}/image/`, { method: "DELETE" });
      setModal({ ...modal, image: r.image, file: null });
      load();
    } catch (err) { setModal({ ...modal, error: errorText(err) }); }
  }

  const [tab, setTab] = useState("account");
  const [fake, setFake] = useState(null); // {available, simulated, count, fields} for the fake-users tool
  const [fk, setFk] = useState(null); // the fake-users popup
  useEffect(() => { if (L >= 3) api("/users/fake/").then(setFake).catch(() => {}); }, [L]);
  async function makeFakes(e) {
    e.preventDefault();
    setFk((f) => ({ ...f, busy: true, error: "", done: "" }));
    try {
      const r = await api("/users/fake/", { method: "POST", body: { count: fk.count, gender: fk.gender, photos: fk.photos, mood: fk.mood } });
      setFake((x) => ({ ...x, count: r.count }));
      setFk((f) => ({ ...f, busy: false, done: `${r.created.length} ${tx("nep-gebruikers gemaakt")}: ${r.created.map((c) => c.name).join(", ")}${r.simulated ? ` (${tx("gesimuleerd door de sandbox")})` : ""}` }));
      load();
    } catch (er) { setFk((f) => ({ ...f, busy: false, error: errorText(er) })); }
  }
  async function dropFakes() {
    if (!(await confirmDialog(tx("Alle nep-gebruikers met hun foto's en gegevens verwijderen?"), { danger: true }))) return;
    try { const r = await api("/users/fake/", { method: "DELETE" }); setFake((x) => ({ ...x, count: 0 })); setFk((f) => ({ ...f, done: `${r.deleted} ${tx("nep-gebruikers verwijderd")}` })); load(); }
    catch (er) { setFk((f) => ({ ...f, error: errorText(er) })); }
  }

  const set = (k) => (e) => setModal({ ...modal, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <>
      <div className="page-head">
        <h1>{tx("Users")}</h1>
        <div className="head-actions">
          {L >= 3 && fake?.available && <button className="btn" onClick={() => setFk({ count: 3, gender: "", photos: 2, mood: "", busy: false, error: "", done: "" })}>✨ {tx("Nep-gebruikers (AI)")}</button>}
          {L >= 3 && <button className="btn" onClick={() => window.dispatchEvent(new Event("invite-open"))}>{tx("Nodig uit")}</button>}
          {L >= 3 && <button className="btn primary" onClick={() => { setTab("account"); setModal({ ...EMPTY }); }}>{tx("+ Nieuwe gebruiker")}</button>}
        </div>
      </div>
      {error && <div className="alert">{error}</div>}

      <Collapsible id="users-list" title={tx("Gebruikers")}>
      <ViewBar view={tv} />
      <TableView view={tv}>
        <table>
          <thead>
            <tr><th>{tx("Naam")}</th><th>{tx("E-mail")}</th><th>{tx("Functie")}</th><th>{tx("Rol")}</th><th>{tx("Verificatie")}</th><th>{tx("Status")}</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <span className="user-cell">
                    {u.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(u.image)} alt="" className="avatar-img" data-g={u.gender || undefined} /> : <span className="avatar" data-g={u.gender || undefined}>{initials(u)}</span>}
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                    {u.is_fake && <span className="badge off" title={tx("Nep-gebruiker voor testen")}>{tx("Nep")}</span>}
                    {u.show_public && <span className="badge ok" title={tx("Wordt getoond op de website")}>{tx("Op website")}</span>}
                  </span>
                </td>
                <td>{u.email}</td>
                <td>{u.function || "—"}</td>
                <td>
                  {u.is_staff && <span className="badge ok" style={{ marginRight: ".3rem" }}>{tx("Superadmin")}</span>}
                  {u.roles.map((id) => <span key={id} className="chip" style={{ cursor: "default", marginRight: ".3rem" }}>{roles.find((r) => r.id === id)?.name || "…"}</span>)}
                  {u.user_groups.map((id) => <span key={id} className="chip" style={{ cursor: "default", marginRight: ".3rem" }}>{groups.find((g) => g.id === id)?.name || "…"}</span>)}
                  {!u.is_staff && !u.roles.length && !u.user_groups.length && <span className="muted">{tx("User")}</span>}
                </td>
                <td><VerifyBadge status={u.verification} label /></td>
                <td><span className={`badge ${u.is_active ? "ok" : "off"}`}>{u.is_active ? tx("Actief") : tx("Geblokkeerd")}</span></td>
                <td className="actions">
                  {L >= 2 && <button className="btn sm" onClick={() => { setTab("account"); setModal({ ...EMPTY, ...u, password: "" }); }}>{tx("Wijzig")}</button>}
                  {u.id !== me.id && (
                    <>
                      {L >= 2 && <button className="btn sm" onClick={() => toggleBlock(u)}>{u.is_active ? tx("Blokkeer") : tx("Deblokkeer")}</button>}
                      {L >= 3 && <button className="btn sm danger" onClick={() => remove(u)}>{tx("Verwijder")}</button>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableView>
      </Collapsible>

      {L >= 3 && <UserInvites roles={roles} groups={groups} />}

      {fk && (
        <div className="overlay" onClick={() => !fk.busy && setFk(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={makeFakes}>
            <h2>✨ {tx("Nep-gebruikers maken met AI")}</h2>
            <p className="muted" style={{ margin: 0, fontSize: ".88rem" }}>{tx("Claude verzint personen met voor- en achternaam en vult het profiel in volgens de profielvelden van de community-instellingen")}{fake?.fields?.length ? ` (${fake.fields.slice(0, 6).join(", ")}${fake.fields.length > 6 ? ", …" : ""})` : ""}. {tx("Als foto's krijgen ze getekende avatars in de kleur van hun geslacht. Een echt portret kan AI hier niet maken.")}</p>
            <div className="form-grid">
              <label>{tx("Aantal (1–10)")}<input type="number" min={1} max={10} value={fk.count} onChange={(e) => setFk({ ...fk, count: e.target.value })} /></label>
              <label>{tx("Geslacht")}<select value={fk.gender} onChange={(e) => setFk({ ...fk, gender: e.target.value })}><option value="">{tx("Gemengd")}</option>{genders.map((g) => <option key={g} value={g}>{tx(GENDER_LABELS[g])}</option>)}</select></label>
              <label>{tx("Foto's per gebruiker (0–4)")}<input type="number" min={0} max={4} value={fk.photos} onChange={(e) => setFk({ ...fk, photos: e.target.value })} /></label>
            </div>
            <label>{tx("Sfeer of wens (optioneel)")}<input value={fk.mood} maxLength={300} placeholder={tx("bv. sportieve mensen tussen 30 en 45 uit Brabant")} onChange={(e) => setFk({ ...fk, mood: e.target.value })} /></label>
            {fk.error && <div className="alert">{fk.error}</div>}
            {fk.done && <div className="alert ok">{fk.done}</div>}
            <div className="row">
              {fake?.count > 0 && <button type="button" className="btn danger" disabled={fk.busy} onClick={dropFakes}>{tx("Alle nep-gebruikers verwijderen")} ({fake.count})</button>}
              <button type="button" className="btn" disabled={fk.busy} onClick={() => setFk(null)}>{tx("Sluiten")}</button>
              <button className="btn primary" disabled={fk.busy}>{fk.busy ? tx("Bezig met maken…") : tx("Maken")}</button>
            </div>
          </form>
        </div>
      )}

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form int-modal" onClick={(e) => e.stopPropagation()} onSubmit={save} onInvalidCapture={() => setTab("account")}>
            <h2>{modal.id ? tx("Gebruiker wijzigen") : tx("Nieuwe gebruiker")}</h2>
            <Tabs value={tab} onChange={setTab} tabs={[["account", "Account"], ["profile", "Profiel"], ["rights", "Rechten"]]} />
            <div className="grid2" hidden={tab !== "account"}>
              <label>{tx("Voornaam")}<input value={modal.first_name} onChange={set("first_name")} /></label>
              <label>{tx("Achternaam")}<input value={modal.last_name} onChange={set("last_name")} /></label>
              <label>{tx("E-mailadres")}<input type="email" value={modal.email} onChange={set("email")} required /></label>
              <label>{modal.id ? tx("Nieuw wachtwoord (optioneel)") : tx("Wachtwoord")}
                <input type="password" value={modal.password} onChange={set("password")} required={!modal.id} autoComplete="new-password" />
              </label>
              <label>{tx("Verificatiestatus")}
                <select value={modal.verification} onChange={set("verification")} disabled={L < 2}>
                  {Object.entries(VERIFY).map(([k, v]) => <option key={k} value={k}>{tx(v.label)}: {tx(v.hint)}</option>)}
                </select>
              </label>
            </div>
            <div className="grid2" hidden={tab !== "profile"}>
              <label>{tx("Functie")}<input value={modal.function} onChange={set("function")} /></label>
              <label>{tx("Korte tekst")}<input value={modal.short} onChange={set("short")} maxLength={255} /></label>
            </div>
            <label hidden={tab !== "profile"}>{tx("Omschrijving / biografie")}<textarea rows={4} value={modal.description} onChange={set("description")} /></label>
            <div className="grid2" hidden={tab !== "profile"}>
              <label>{tx("Link")}<input value={modal.link} onChange={set("link")} maxLength={255} placeholder="https://…" /></label>
              <label className="check" style={{ alignSelf: "end" }}><input type="checkbox" checked={modal.link_external} onChange={set("link_external")} /> {tx("Link opent extern")}</label>
            </div>
            <div className="photo-row" hidden={tab !== "profile"}>
              {modal.preview || modal.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={modal.preview || mediaUrl(modal.image)} alt="" className="photo-preview" /> : <span className="avatar photo-preview">{initials(modal)}</span>}
              <span className="row" style={{ justifyContent: "flex-start" }}>
                <MediaField onFiles={(fs) => photo(fs[0])} />
                {(modal.image || modal.preview) && <button type="button" className="btn sm danger" onClick={() => photo(null)}>{tx("Foto verwijderen")}</button>}
              </span>
            </div>
            <label className="check" hidden={tab !== "profile"}><input type="checkbox" checked={modal.show_public} onChange={set("show_public")} /> {tx("Tonen op de website als member (foto, functie en omschrijving)")}</label>
            <div hidden={tab !== "rights"}>
              <strong style={{ fontSize: ".85rem" }}>{tx("Rollen")}</strong>
              <div className="perm-list">
                {roles.map((r) => (
                  <label className="check" key={r.id}>
                    <input type="checkbox" checked={modal.roles.includes(r.id)}
                      onChange={() => setModal({ ...modal, roles: modal.roles.includes(r.id) ? modal.roles.filter((x) => x !== r.id) : [...modal.roles, r.id] })} />
                    {r.name} <small className="muted">{r.description}</small>
                  </label>
                ))}
                {!roles.length && <span className="muted">{tx("Geen rollen beschikbaar.")}</span>}
              </div>
            </div>
            <div hidden={tab !== "rights"}>
              <strong style={{ fontSize: ".85rem" }}>{tx("User groups")}</strong>
              <div className="perm-list">
                {groups.map((g) => (
                  <label className="check" key={g.id}>
                    <input type="checkbox" checked={modal.user_groups.includes(g.id)}
                      onChange={() => setModal({ ...modal, user_groups: modal.user_groups.includes(g.id) ? modal.user_groups.filter((x) => x !== g.id) : [...modal.user_groups, g.id] })} />
                    {g.name} <small className="muted">{g.description}</small>
                  </label>
                ))}
                {!groups.length && <span className="muted">{tx("Nog geen groepen.")}</span>}
              </div>
            </div>
            {me.is_staff && <label className="check" hidden={tab !== "rights"}>
              <input type="checkbox" checked={modal.is_staff} onChange={set("is_staff")} disabled={modal.id === me.id} /> {tx("Superadmin (alle rechten, beheert ook admins en superadmins)")}
            </label>}
            {modal.error && <div className="alert">{modal.error}</div>}
            <div className="row">
              <button type="button" className="btn" onClick={() => setModal(null)}>{tx("Annuleren")}</button>
              <button className="btn primary">{tx("Opslaan")}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

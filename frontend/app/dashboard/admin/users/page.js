// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import MediaField from "../../../../components/MediaField";
import PlusLock from "../../../../components/PlusLock";
import { tx } from "../../../../lib/t";
import { confirmDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../components/AuthContext";
import VerifyBadge, { VERIFY } from "../../../../components/VerifyBadge";
import Collapsible from "../../../../components/Collapsible";
import SmallEditor from "../../../../components/SmallEditor";
import Tabs from "../../../../components/Tabs";
import PaymentDetails from "../../../../components/PaymentDetails";
import PhoneInput from "../../../../components/PhoneInput";
import PostcodeSearch from "../../../../components/PostcodeSearch";
import { countryOptions } from "../../../../lib/countries";
import UserInvites from "../../../../components/UserInvites";
import ViewBar from "../../../../components/ViewBar";
import TableView from "../../../../components/TableView";
import { useView } from "../../../../lib/useView";
import KitScope from "../../../../lib/ui-kit/KitScope";
import { ColorDot, ColorField, TagChip, TagPicker, useTagMap } from "../../../../components/Tags";
import { IconBriefcase, IconShield } from "../../../../components/Icons";
import { api, errorText, mediaUrl } from "../../../../lib/api";
import { GENDER_LABELS, useGenders } from "../../../../lib/genders";
import { lvl } from "../../../../lib/perms";
import SuggestPassword from "../../../../components/SuggestPassword";

const EMPTY = { twofa_required: false, user_groups: [], entity_ids: [], color: "", email: "", password: "", first_name: "", last_name: "", function: "", short: "", description: "", phone: "", mobile: "", address: "", postal_code: "", city: "", country: "", link: "", link_external: false, show_public: false, verification: "open", roles: [], is_staff: false, file: null };
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
  const tagMap = useTagMap("user"); // the tags of the users (chips after the name)
  const [entities, setEntities] = useState([]); // the entities (companies, clubs ...) a user can belong to
  useEffect(() => { api("/entities/").then(setEntities).catch(() => {}); }, []);
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
    const { id, file, error: _e, image, entities: _en, ...body } = modal;
    if (id && !body.password) delete body.password;
    try {
      const saved = await (id ? api(`/users/${id}/`, { method: "PATCH", body }) : api("/users/", { method: "POST", body }));
      if (id && body.is_active === false) await api(`/users/${id}/block/`, { method: "POST" }).catch(() => {}); // (also ends the sessions of this account)
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
      <KitScope tag="ui-data-table"><TableView view={tv}>
        <table className="users-table">
          <thead>
            <tr><th>{tx("Naam")}</th><th>{tx("E-mail")}</th><th>{tx("Rol")}</th><th>{tx("Verificatie")}</th><th>{tx("Status")}</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <span className="user-cell">
                    {u.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(u.image)} alt="" className="avatar-img" data-g={u.gender || undefined} /> : <span className="avatar" data-g={u.gender || undefined}>{initials(u)}</span>}
                    <span className="user-name">
                      <strong><ColorDot color={u.color} size={11} title={tx("Kleur")} />{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</strong>
                      {(tagMap.of(u.id).length > 0 || u.is_fake || u.show_public) && (
                        <span className="cell-chips">
                          {tagMap.of(u.id).map((t) => <TagChip key={t.id} tag={t} />)}
                          {u.is_fake && <span className="badge off" title={tx("Nep-gebruiker voor testen")}>{tx("Nep")}</span>}
                          {u.show_public && <span className="badge ok" title={tx("Wordt getoond op de website")}>{tx("Op website")}</span>}
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td><span className="cell-two"><span>{u.email}</span>{u.function && <small className="muted">{u.function}</small>}</span></td>
                <td>
                  <span className="cell-chips">
                    {u.is_staff && <span className="badge ok">{u.is_superadmin_plus ? <>{tx("Superadmin+")}<PlusLock /></> : tx("Superadmin")}</span>}
                    {(u.role_list || u.roles.map((id) => ({ id, name: roles.find((r) => r.id === id)?.name || "…" }))).map((r) => <span key={`r${r.id}`} className="chip" style={{ cursor: "default" }}>{r.name}</span>)}
                    {u.user_groups.map((id) => <span key={id} className="chip" style={{ cursor: "default" }}>{groups.find((g) => g.id === id)?.name || "…"}</span>)}
                    {(u.entities || []).map((e) => <span key={`e${e.id}`} className="chip" style={{ cursor: "default" }} title={tx("Entiteit")}><ColorDot color={e.color} size={9} />{!e.color && <IconBriefcase width={12} height={12} />} {e.name}</span>)}
                    {!u.is_staff && !u.roles.length && !u.user_groups.length && !(u.entities || []).length && <span className="muted">{tx("User")}</span>}
                  </span>
                </td>
                <td><VerifyBadge status={u.verification} label /></td>
                <td><span className={`badge ${u.is_active ? "ok" : "off"}`}>{u.is_active ? tx("Actief") : tx("Geblokkeerd")}</span></td>
                <td className="actions"><div className="cell-actions">
                  {L >= 2 && <button className="btn sm" onClick={() => { setTab("account"); setModal({ ...EMPTY, ...u, password: "", entity_ids: (u.entities || []).map((x) => x.id) }); }}>{tx("Wijzig")}</button>}
                  {u.id !== me.id && (
                    <>
                      {L >= 2 && <button className="btn sm" onClick={() => toggleBlock(u)}>{u.is_active ? tx("Blokkeer") : tx("Deblokkeer")}</button>}
                      {L >= 3 && <button className="btn sm danger" onClick={() => remove(u)}>{tx("Verwijder")}</button>}
                    </>
                  )}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableView></KitScope>
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
            <Tabs className="tabs-one-row" value={tab} onChange={setTab} tabs={[["account", "Account"], ["profile", "Profiel"], ["contact", "Contact en adres"], ["media", "Media"], ["rights", "Rechten"], ...(L >= 2 ? [["payments", "Betaalgegevens"], ...(modal.id ? [["notes", "Notities"]] : [])] : [])]} />
            {tab === "account" && (
            <div className="grid2">
              <label>{tx("Voornaam")}<span style={{ display: "flex", gap: ".6rem", alignItems: "center" }}><ColorField inline value={modal.color || ""} onChange={(v) => setModal({ ...modal, color: v })} disabled={L < 2} /><input style={{ flex: 1 }} value={modal.first_name} onChange={set("first_name")} /></span></label>
              <label>{tx("Achternaam")}<input value={modal.last_name} onChange={set("last_name")} /></label>
              <label>{tx("E-mailadres")}<input type="email" value={modal.email} onChange={set("email")} required /></label>
              {modal.id && <>
                <label>{tx("Id")}<input value={modal.uid || ""} readOnly aria-readonly="true" style={{ opacity: .85 }} onFocus={(e) => e.target.select()} /></label>
                <label>{tx("easy2edit id")}<input value={modal.remote_id || ""} readOnly aria-readonly="true" placeholder={tx("Nog niet aangemaakt op de easy2edit server")} style={{ opacity: .85 }} onFocus={(e) => e.target.select()} /></label>
                {(modal.domains || []).length > 0 && <label style={{ gridColumn: "1 / -1" }}>{tx("Websites")}<input value={(modal.domains || []).join(", ")} readOnly aria-readonly="true" style={{ opacity: .85 }} /></label>}
              </>}
              <label>{modal.id ? tx("Nieuw wachtwoord (optioneel)") : tx("Wachtwoord")}
                <input type={modal.showPw ? "text" : "password"} value={modal.password} onChange={set("password")} required={!modal.id} autoComplete="new-password" />
              </label>
              <SuggestPassword onPick={(p) => setModal({ ...modal, password: p, showPw: true })} />
              <label>{tx("Verificatiestatus")}
                <select value={modal.verification} onChange={set("verification")} disabled={L < 2}>
                  {Object.entries(VERIFY).map(([k, v]) => <option key={k} value={k}>{tx(v.label)}: {tx(v.hint)}</option>)}
                </select>
              </label>
              {modal.id && <div style={{ gridColumn: "1 / -1" }}><TagPicker kind="user" refId={modal.id} label={tx("Tags")} canEdit={L >= 2} /></div>}
              {modal.id && (
                <div role="group" aria-label={tx("Inloggen met 2-staps verificatie")} style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: ".7rem", flexWrap: "wrap", padding: ".6rem .8rem", border: "1px solid var(--line, rgba(0,0,0,.12))", borderRadius: "var(--radius, 10px)" }}>
                  <span style={{ display: "inline-flex", color: modal.otp_active ? "var(--blue, #e8803f)" : "var(--muted)" }} aria-hidden="true"><IconShield /></span>
                  <span style={{ display: "grid", gap: ".1rem", flex: "1 1 240px", minWidth: 0 }}>
                    <strong style={{ fontSize: ".85rem" }}>{tx("Inloggen met 2-staps verificatie")}</strong>
                    <small className="muted">{modal.otp_active ? `${tx("Aan")} · ${modal.twofa_method === "app" ? tx("Authenticator-app (OTP)") : modal.twofa_method === "sms" ? "SMS" : tx("E-mail")}` : (modal.twofa_required ? tx("Verplicht, nog niet ingesteld") : tx("Uit"))}. {tx("De gebruiker kiest en wijzigt de methode (e-mail, authenticator-app of sms) zelf in het profiel.")}</small>
                  </span>
                </div>
              )}
              {modal.id && L >= 2 && (
                <label className="check sec-toggle" style={{ alignSelf: "end" }} title={modal.id === me.id ? tx("Je kunt je eigen account niet uitschakelen") : undefined}>
                  <span className="switch"><input type="checkbox" checked={modal.is_active !== false} disabled={modal.id === me.id} onChange={(e) => setModal({ ...modal, is_active: e.target.checked })} /><span /></span>
                  <span>{modal.is_active !== false ? tx("Account actief") : tx("Account niet actief (kan niet inloggen)")}</span>
                </label>
              )}
            </div>
            )}
            {tab === "profile" && (
              <>
            <div className="grid2">
              <label>{tx("Functie")}<input value={modal.function} onChange={set("function")} /></label>
              <label>{tx("Korte tekst")}<input value={modal.short} onChange={set("short")} maxLength={255} /></label>
            </div>
            <div className="field"><strong style={{ fontSize: ".85rem" }}>{tx("Omschrijving / biografie")}</strong><SmallEditor value={modal.description} onChange={(v) => setModal({ ...modal, description: v })} /></div>
            <div className="grid2">
              <label>{tx("Link")}<input value={modal.link} onChange={set("link")} maxLength={255} placeholder="https://…" /></label>
              <label className="check sec-toggle" style={{ alignSelf: "end" }}><span className="switch"><input type="checkbox" checked={modal.link_external} onChange={set("link_external")} /><span /></span><span>{tx("Link opent extern")}</span></label>
            </div>
            <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={modal.show_public} onChange={set("show_public")} /><span /></span><span>{tx("Tonen op de website als member (foto, functie en omschrijving)")}</span></label>
              </>
            )}
            {tab === "contact" && (
            <div className="grid2" style={{ alignItems: "start", rowGap: "1rem" }}>
              <label>{tx("Telefoon")}<PhoneInput value={modal.phone || ""} onChange={(v) => setModal((m) => ({ ...m, phone: v }))} /></label>
              <label>{tx("Mobiel")}<PhoneInput value={modal.mobile || ""} onChange={(v) => setModal((m) => ({ ...m, mobile: v }))} /></label>
              <small className="muted" style={{ gridColumn: "1 / -1", marginTop: "-.5rem" }}>{tx("Mobiel")}: {tx("Hierheen gaan codes per sms (tweestapsverificatie en bevestigingen).")}</small>
              <label style={{ gridColumn: "1 / -1" }}>{tx("Adres")}<input value={modal.address || ""} onChange={set("address")} maxLength={200} placeholder={tx("Straat en huisnummer")} /></label>
              <label>{tx("Postcode")}
                <span style={{ display: "flex", gap: ".5rem", alignItems: "stretch", flexWrap: "wrap" }}>
                  <input value={modal.postal_code || ""} onChange={set("postal_code")} maxLength={12} style={{ flex: 1, minWidth: 0 }} />
                  <PostcodeSearch query={`${modal.postal_code || ""} ${((modal.address || "").match(/(\d+\s?[A-Za-z]?)\s*$/) || [])[1] || ""}`}
                    onPick={(r) => setModal((m) => {
                      const nr = r.house_number || ((m.address || "").match(/(\d+\s?[A-Za-z]?)\s*$/) || [])[1] || "";
                      const country = (countryOptions("nl").find(([c, n]) => n.toLowerCase() === String(r.country || "").toLowerCase()) || [r.country === "Nederland" ? "NL" : m.country])[0] || m.country;
                      return { ...m, address: `${r.street || ""} ${nr}`.trim() || m.address, postal_code: r.postal_code || m.postal_code, city: r.city || m.city, country };
                    })} />
                </span>
              </label>
              <label>{tx("Plaats")}<input value={modal.city || ""} onChange={set("city")} maxLength={100} /></label>
              <label>{tx("Land")}
                <select value={modal.country || ""} onChange={set("country")}>
                  <option value="">{tx("Niet opgegeven")}</option>
                  {countryOptions("nl").map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                </select>
              </label>
            </div>
            )}
            {tab === "media" && (
            <div className="photo-row">
              {modal.preview || modal.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={modal.preview || mediaUrl(modal.image)} alt="" className="photo-preview" /> : <span className="avatar photo-preview">{initials(modal)}</span>}
              <span className="row" style={{ justifyContent: "flex-start" }}>
                <MediaField onFiles={(fs) => photo(fs[0])} />
                {(modal.image || modal.preview) && <button type="button" className="btn sm danger" onClick={() => photo(null)}>{tx("Foto verwijderen")}</button>}
              </span>
            </div>
            )}
            {tab === "notes" && modal.id && <Notes kind="user" id={modal.id} />}
            {tab === "payments" && !modal.id && <div className="alert" role="note" style={{ background: "color-mix(in srgb, var(--blue) 7%, var(--card, #fff))", borderColor: "var(--line)", color: "inherit" }}>{tx("Sla de gebruiker eerst op. Daarna kun je hier de betaalgegevens invullen, de keuze om op rekening te betalen en het maximum instellen.")}</div>}
            {tab === "payments" && modal.id && <PaymentDetails base={`/users/${modal.id}/payments/`} canEdit={L >= 2} forUser />}
            {tab === "rights" && (() => {
              const sec = { border: "1px solid color-mix(in srgb, var(--e2e-primary, var(--blue)) 16%, var(--e2e-border, #e5e0d8))", background: "color-mix(in srgb, var(--e2e-primary, var(--blue)) 5%, transparent)", borderRadius: "var(--e2e-radius, 10px)", padding: ".8rem .9rem", display: "grid", gap: ".6rem", alignContent: "start" };
              const grid = { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: ".5rem" };  // the cards of one block under each other, full width
              const item = (on) => ({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".7rem", padding: ".55rem .7rem", borderRadius: "var(--e2e-radius, 10px)", border: `1px solid ${on ? "var(--e2e-primary, #e8803f)" : "var(--e2e-border, #e5e0d8)"}`, background: on ? "color-mix(in srgb, var(--e2e-primary, #e8803f) 8%, transparent)" : "transparent", cursor: "pointer", minWidth: 0 });
              const Card = ({ on, onChange, title, sub, disabled, hint }) => (
                <label className="check sec-toggle" style={item(on)} title={hint}>
                  <span style={{ display: "grid", minWidth: 0, gap: ".1rem" }}>
                    <span style={{ fontWeight: 600, fontSize: ".85rem", overflowWrap: "anywhere" }}>{title}</span>
                    {sub ? <small className="muted" style={{ overflowWrap: "anywhere" }}>{sub}</small> : null}
                  </span>
                  <span className="switch" style={{ flex: "0 0 auto" }}><input type="checkbox" checked={!!on} onChange={onChange} disabled={disabled} /><span /></span>
                </label>
              );
              const toggle = (key, id) => setModal({ ...modal, [key]: (modal[key] || []).includes(id) ? modal[key].filter((x) => x !== id) : [...(modal[key] || []), id] });
              return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))", gap: ".9rem", alignItems: "start" }}>
                <div style={sec}>
                  <strong style={{ fontSize: ".85rem" }}>{tx("Rollen")}</strong>
                  <div style={grid}>
                    {roles.map((r) => <Card key={r.id} on={modal.roles.includes(r.id)} onChange={() => toggle("roles", r.id)} title={r.name} sub={r.description} />)}
                    {!roles.length && <span className="muted">{tx("Geen rollen beschikbaar.")}</span>}
                  </div>
                </div>
                <div style={sec}>
                  <strong style={{ fontSize: ".85rem" }}>{tx("User groups")}</strong>
                  <div style={grid}>
                    {groups.map((g) => <Card key={g.id} on={modal.user_groups.includes(g.id)} onChange={() => toggle("user_groups", g.id)} title={g.name} sub={g.description} />)}
                    {!groups.length && <span className="muted">{tx("Nog geen groepen.")}</span>}
                  </div>
                </div>
                <div style={sec}>
                  <strong style={{ fontSize: ".85rem" }}>{tx("Entiteiten")}</strong>
                  <div style={grid}>
                    {entities.map((en) => <Card key={en.id} on={(modal.entity_ids || []).includes(en.id)} onChange={() => toggle("entity_ids", en.id)} title={en.name || tx("Naamloos")} sub={`${tx(en.kind_label)}${en.city ? ` · ${en.city}` : ""}`} />)}
                    {!entities.length && <span className="muted">{tx("Nog geen entiteiten.")}</span>}
                  </div>
                </div>
                <div style={sec}>
                  <strong style={{ fontSize: ".85rem" }}>{tx("Beheerrechten")}</strong>
                  <div style={grid}>
                    {me.is_superadmin_plus && <Card on={modal.is_superadmin_plus} onChange={(e) => setModal({ ...modal, is_superadmin_plus: e.target.checked, ...(e.target.checked ? { is_staff: true } : {}) })} disabled={modal.id === me.id} title="Superadmin+" sub={tx("Ziet en beheert ook de easy2edit-modules")} />}
                    {me.is_staff && <Card on={modal.is_staff} onChange={set("is_staff")} disabled={modal.id === me.id} title="Superadmin" sub={tx("Alle rechten, beheert ook admins en superadmins")} />}
                    <Card on={modal.twofa_required} onChange={set("twofa_required")} disabled={L < 2} title={tx("Tweestapsverificatie verplicht")} sub={tx("Instellen direct na de eerste keer inloggen")} hint={tx("Staat tweestapsverificatie bij Admin → Beveiliging uit, dan kan niemand het instellen.")} />
                  </div>
                </div>
              </div>
              );
            })()}
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

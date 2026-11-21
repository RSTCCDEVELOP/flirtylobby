// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import { IconBriefcase, IconCheck, IconEdit, IconGroup, IconInfo, IconMail, IconPlus, IconTrash, IconUsers, IconX } from "./Icons";
import KitScope from "../lib/ui-kit/KitScope";
import PhoneInput from "./PhoneInput";
import { ColorDot, ColorField, TagChip, TagPicker, useTagMap } from "./Tags";
import SmallEditor from "./SmallEditor";
import Tabs from "./Tabs";

// The other entities of the site (module Entiteit): companies, organisations, associations or clubs that users and user groups belong to.
// Rows with edit and delete, "+" on top; the popup has tabs and a "Gekoppeld" tab where users and user groups are picked through a search.
const ROW = { display: "grid", alignItems: "center", gap: ".7rem", padding: ".5rem .5rem", borderBottom: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.12)))", gridTemplateColumns: "minmax(160px,2fr) minmax(110px,1fr) minmax(100px,1fr) 90px 90px 80px" };
const cut = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 };
const nameOf = (u) => [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
const EMPTY = { name: "", color: "", kind: "bedrijf", kind_name: "", legal_name: "", description: "", email: "", phone: "", website: "", street: "", house_number: "", postal_code: "", city: "", country: "", registration_no: "", vat_no: "", user_ids: [], group_ids: [] };


// A list of who is linked, with a "+" in its header: it opens a search; click a result to add it, the cross on a row removes it.
function LinkList({ title, icon, items, ids, onChange, render, matchText, canEdit, emptyText, searchLabel }) {
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const chosen = ids.map((i) => (items || []).find((x) => x.id === i)).filter(Boolean);
  const hits = (items || []).filter((x) => !ids.includes(x.id) && matchText(x).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  const add = (x) => { onChange([...ids, x.id]); setQ(""); };
  return (
    <KitScope tag="ui-link-list"><div className="e2e-linklist">
      <div className="e2e-linklist__head">
        <span className="e2e-linklist__title">{icon}{title}</span><span className="e2e-linklist__count">{ids.length}</span>
        {canEdit && <button type="button" className={`e2e-btn e2e-btn--sm e2e-linklist__add${adding ? " e2e-btn--primary" : ""}`} aria-label={tx("Toevoegen")} title={tx("Toevoegen")} aria-expanded={adding} onClick={() => { setAdding(!adding); setQ(""); }}><IconPlus width={14} height={14} /></button>}
      </div>
      {adding && (
        <div className="e2e-linklist__search">
          <input className="e2e-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setAdding(false); if (e.key === "Enter" && hits[0]) { e.preventDefault(); add(hits[0]); } }} placeholder={searchLabel} aria-label={searchLabel} />
          <div className="e2e-linklist__results">
            {hits.map((x) => (
              <button type="button" key={x.id} className="e2e-linklist__row e2e-linklist__pick" onClick={() => add(x)}>{render(x)}<span className="e2e-linklist__plus"><IconPlus width={14} height={14} /></span></button>
            ))}
            {!hits.length && <div className="e2e-linklist__empty">{tx("Niets gevonden.")}</div>}
          </div>
        </div>
      )}
      <div className="e2e-linklist__list">
        {chosen.map((x) => (
          <div key={x.id} className="e2e-linklist__row">
            {render(x)}
            {canEdit && <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm e2e-linklist__x" aria-label={tx("Verwijderen")} title={tx("Verwijderen")} onClick={() => onChange(ids.filter((i) => i !== x.id))}><IconX width={14} height={14} /></button>}
          </div>
        ))}
        {!chosen.length && <div className="e2e-linklist__empty">{items ? emptyText : ""}</div>}
      </div>
    </div></KitScope>
  );
}
const initials = (t) => String(t || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const userLine = (u) => <><span className="e2e-linklist__ico">{initials(nameOf(u))}</span><span className="e2e-linklist__txt"><strong><ColorDot color={u.color} />{nameOf(u)}</strong>{nameOf(u) !== u.email && <small>{u.email}</small>}</span></>;
const userMatch = (u) => `${nameOf(u)} ${u.email}`;
const groupLine = (g) => <><span className="e2e-linklist__ico"><IconGroup width={14} height={14} /></span><span className="e2e-linklist__txt"><strong>{g.name}</strong></span></>;

export default function EntityList({ canEdit, canManage }) {
  const [rows, setRows] = useState(null);
  const tagMap = useTagMap("entity");
  const [q, setQ] = useState("");
  const router = useRouter();
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api("/entities/").then(setRows).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);

  const open = (row) => router.push(row ? `/dashboard/admin/entity/edit?id=${row.id}` : "/dashboard/admin/entity/edit"); // editing happens on its own screen
  const remove = async (row) => {
    if (!(await confirmDialog(tx("{0} definitief verwijderen? De gekoppelde gebruikers en groepen blijven bestaan.", row.name), { danger: true, okLabel: tx("Verwijderen"), cancelLabel: tx("Annuleren") }))) return;
    try { await api(`/entities/${row.id}/`, { method: "DELETE" }); load(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  const shown = useMemo(() => (rows || []).filter((r) => `${r.name} ${r.city} ${r.email} ${r.kind_label}`.toLowerCase().includes(q.trim().toLowerCase())), [rows, q]);

  if (!rows) return msg ? <div className="alert">{msg.text}</div> : null;
  return (
    <KitScope tag="ui-data-table">
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: ".8rem" }}>{msg.text}</div>}
      <div style={{ display: "flex", gap: ".6rem", alignItems: "center", marginBottom: ".6rem", flexWrap: "wrap" }}>
        {canManage && <button type="button" className="btn primary" onClick={() => open(null)} aria-label={tx("Entiteit toevoegen")}><IconPlus /> {tx("Toevoegen")}</button>}
        <input className="e2e-input" style={{ maxWidth: 260 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoeken")} aria-label={tx("Zoeken")} />
        <span className="muted" style={{ fontSize: ".85rem" }}>{shown.length}</span>
      </div>
      {shown.length ? (
        <div style={{ overflowX: "auto" }}>
          <div style={{ ...ROW, fontSize: ".78rem", textTransform: "uppercase", letterSpacing: ".04em", opacity: 0.65, padding: ".3rem .5rem" }}><span>{tx("Naam")}</span><span>{tx("Soort")}</span><span>{tx("Plaats")}</span><span>{tx("Gebruikers")}</span><span>{tx("Groepen")}</span><span /></div>
          {shown.map((r) => (
            <div key={r.id} style={ROW}>
              <strong style={cut} title={r.name}><ColorDot color={r.color} size={11} />{r.name}{r.is_own && <span className="e2e-chip" style={{ marginLeft: ".4rem", fontSize: ".72rem", fontWeight: 500, opacity: .75 }}>{tx("Deze website")}</span>}{tagMap.of(r.id).map((t) => <span key={t.id} style={{ marginLeft: ".35rem" }}><TagChip tag={t} /></span>)}</strong>
              <span style={cut}>{tx(r.kind_label)}</span>
              <span style={cut}>{r.city}</span>
              <span>{r.user_count}</span>
              <span>{r.group_count}</span>
              <div style={{ display: "flex", gap: ".25rem", justifyContent: "flex-end" }}>
                <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Bewerken")} title={tx("Bewerken")} onClick={() => open(r)}><IconEdit width={14} height={14} /></button>
                {canManage && !r.is_own && <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Verwijderen")} title={tx("Verwijderen")} onClick={() => remove(r)}><IconTrash width={14} height={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      ) : <p className="muted">{rows.length ? tx("Niets gevonden.") : tx("Nog geen entiteiten. Voeg er een toe met de knop Toevoegen: bijvoorbeeld een klant, een werkgever of een club waar gebruikers bij horen.")}</p>}
    </KitScope>
  );
}

// A value that is shown and can not be changed (the unique id, the easy2edit id, the websites): selectable text, no input.
export function ReadOnly({ label, value, empty = "", wide = false }) {
  return <div className="e2e-field" style={wide ? { gridColumn: "1 / -1" } : undefined}><label className="e2e-label"><span>{label}</span></label><div className="e2e-input" style={{ opacity: .85, userSelect: "all", fontFamily: "ui-monospace, monospace", fontSize: ".85rem", overflowWrap: "anywhere" }} aria-readonly="true">{value || <span className="muted">{empty}</span>}</div></div>;
}
export const EMPTY_ENTITY = EMPTY;
const VARS = [["naam", "Naam"], ["juridische_naam", "Juridische naam"], ["omschrijving", "Omschrijving"], ["email", "E-mail"], ["telefoon", "Telefoon"], ["website", "Website"], ["adres", "Adres"], ["plaats", "Plaats"], ["postcode", "Postcode"], ["land", "Land"], ["kvk", "Registratienummer (KvK)"], ["btw", "Btw-nummer"], ["soort", "Soort"]];
const USER_VARS = [["naam", "Naam"], ["voornaam", "Voornaam"], ["achternaam", "Achternaam"], ["email", "E-mail"], ["functie", "Functie"], ["bedrijf", "Bedrijf"]];

// The screen to edit one entity (own page, not a popup): tabs General, Contact and address, Registration, Gekoppeld and, for the entity of the website, Tekstvariabelen.
export function EntityForm({ init, kinds, variables, canEdit, onClose, onSaved }) {
  const [f, setF] = useState(init);
  const [tab, setTab] = useState("general");
  const [users, setUsers] = useState(null);
  const [groups, setGroups] = useState(null);
  const [err, setErr] = useState(null);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/users/").then(setUsers).catch(() => setUsers([])); api("/user-groups/").then(setGroups).catch(() => setGroups([])); }, []);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    const x = {};
    if (!String(f.name || "").trim()) x.name = tx("Vul een naam in.");
    if (f.kind === "vrij" && !String(f.kind_name || "").trim() && !f.own) x.kind_name = tx("Geef de vrije naam een naam.");
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(f.email)) x.email = tx("Het e-mailadres is niet geldig.");
    if (f.website && !/^https?:\/\/\S{3,190}$/.test(f.website)) x.website = tx("Het websiteadres moet beginnen met http:// of https://.");
    setErrs(x);
    if (Object.keys(x).length) { setTab(x.name || x.kind_name ? "general" : "contact"); return; }
    setBusy(true); setErr(null);
    try {
      const body = { ...f }; delete body.users0; delete body.groups0; delete body.own; delete body.id; delete body.ids;
      await api(f.id ? `/entities/${f.id}/` : "/entities/", { method: f.id ? "PUT" : "POST", body });
      onSaved();
    } catch (e) { setErr(errorText(e)); }
    setBusy(false);
  };

  const field = (k, label, extra = {}) => (
    <div className="e2e-field" style={extra.wide ? { gridColumn: "1 / -1" } : undefined}>
      <label className="e2e-label" htmlFor={`el-${k}`}><span>{tx(label)}{extra.required && <span style={{ color: "var(--e2e-danger)" }}> *</span>}</span></label>
      {k === "phone" ? <PhoneInput id={`el-${k}`} value={f[k] || ""} onChange={(v) => set(k, v)} />
        : <input id={`el-${k}`} className={`e2e-input${errs[k] ? " e2e-input--error" : ""}`} value={f[k] || ""} maxLength={extra.max || 160} disabled={!canEdit} onChange={(e) => set(k, e.target.value)} placeholder={extra.placeholder || ""} />}
      {errs[k] && <span className="e2e-error">{errs[k]}</span>}
    </div>
  );
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: ".8rem 1rem" };
  return (
      <div className="card" style={{ padding: "1rem" }}>
        <Tabs value={tab} onChange={setTab} tabs={[["general", tx("Algemeen"), <IconBriefcase key="g" />], ["contact", tx("Contact en adres"), <IconMail key="c" />], ["registration", tx("Registratie"), <IconInfo key="r" />], ["links", `${tx("Gekoppeld")} (${f.user_ids.length + f.group_ids.length})`, <IconUsers key="l" />], ...(f.own ? [["variables", tx("Tekstvariabelen"), <IconCheck key="v" />]] : [])]} />
        {err && <div className="alert">{err}</div>}
        <div style={{ paddingTop: ".8rem" }}>
          {tab === "general" && (
            <div style={grid}>
              <div className="e2e-field">
                <label className="e2e-label" htmlFor="el-name"><span>{tx("Naam")}<span style={{ color: "var(--e2e-danger)" }}> *</span></span></label>
                <div style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
                  <ColorField inline value={f.color || ""} onChange={(v) => set("color", v)} disabled={!canEdit} />
                  <input id="el-name" className={`e2e-input${errs.name ? " e2e-input--error" : ""}`} style={{ flex: 1 }} value={f.name || ""} maxLength={120} disabled={!canEdit} onChange={(e) => set("name", e.target.value)} />
                </div>
                {errs.name && <span className="e2e-error">{errs.name}</span>}
              </div>
              {field("legal_name", "Juridische naam", { max: 160 })}
              {!f.own && (
                <>
                  <div className="e2e-field">
                    <label className="e2e-label" htmlFor="el-kind"><span>{tx("Soort")}</span></label>
                    <select id="el-kind" className="e2e-input" value={f.kind} disabled={!canEdit} onChange={(e) => set("kind", e.target.value)}>{kinds.map((k) => <option key={k.key} value={k.key}>{tx(k.label)}</option>)}</select>
                  </div>
                  {f.kind === "vrij" && field("kind_name", "Vrije naam", { max: 40, placeholder: tx("Bijvoorbeeld: Stichting") })}
                </>
              )}
              {f.id && <div style={{ gridColumn: "1 / -1" }}><TagPicker kind="entity" refId={f.id} label={tx("Tags")} canEdit={canEdit} /></div>}
              <div className="e2e-field" style={{ gridColumn: "1 / -1" }}><label className="e2e-label"><span>{tx("Omschrijving")}</span></label><SmallEditor value={f.description || ""} onChange={(v) => set("description", v)} minHeight={110} disabled={!canEdit} /></div>
            </div>
          )}
          {tab === "contact" && (
            <div style={grid}>
              {field("email", "E-mail")}{field("phone", "Telefoon", { max: 40 })}{field("website", "Website", { max: 200, placeholder: "https://" })}
              {field("street", "Straat", { max: 120 })}{field("house_number", "Huisnummer", { max: 20 })}{field("postal_code", "Postcode", { max: 20 })}{field("city", "Plaats", { max: 80 })}{field("country", "Land", { max: 80 })}
            </div>
          )}
          {tab === "registration" && <div style={grid}>{field("registration_no", "Registratienummer (KvK)", { max: 40 })}{field("vat_no", "Btw-nummer", { max: 40 })}
            {f.id && f.ids && <>
              <ReadOnly label={tx("Id")} value={f.ids.uid} />
              <ReadOnly label={tx("easy2edit id")} value={f.ids.remote_id} empty={tx("Nog niet aangemaakt op de easy2edit server")} />
              <ReadOnly label={tx("Websites")} value={(f.ids.domains || []).join(", ")} empty={tx("(geen)")} wide />
            </>}</div>}
          {tab === "variables" && (
            <div>
              <p className="muted" style={{ marginTop: 0 }}>{tx("Schrijf een variabele in een tekst op een pagina (in de bewerkmodus): de website vult hem in. Verander je hier iets, dan werkt dat door op alle pagina's. In de bewerkmodus blijft de variabele zelf staan. In de pagina-editor staan ze ook als systeemobject (Variabele).")}</p>
              <div className="e2e-table-wrap"><table className="e2e-table"><thead><tr><th>{tx("Variabele")}</th><th>{tx("Wordt")}</th></tr></thead><tbody>
                {VARS.map(([k, label]) => <tr key={k}><td><code>{`{{organisatie.${k}}}`}</code> <small className="muted">{tx(label)}</small></td><td>{(variables || {})[k] || <span className="muted">{tx("(leeg)")}</span>}</td></tr>)}
                {USER_VARS.map(([k, label]) => <tr key={`u${k}`}><td><code>{`{{user.${k}}}`}</code> <small className="muted">{tx(label)}</small></td><td className="muted">{tx("De gebruiker die de pagina bekijkt")}</td></tr>)}
              </tbody></table></div>
            </div>
          )}
          {tab === "links" && (
            <div style={{ ...grid, alignItems: "start" }}>
              <LinkList title={tx("Gebruikers")} icon={<IconUsers width={14} height={14} />} items={users} ids={f.user_ids} onChange={(v) => set("user_ids", v)} render={userLine} matchText={userMatch} canEdit={canEdit} emptyText={tx("Nog niemand gekoppeld.")} searchLabel={tx("Zoek een gebruiker")} />
              <LinkList title={tx("Groepen")} icon={<IconGroup width={14} height={14} />} items={groups} ids={f.group_ids} onChange={(v) => set("group_ids", v)} render={groupLine} matchText={(g) => g.name} canEdit={canEdit} emptyText={tx("Nog geen groep gekoppeld.")} searchLabel={tx("Zoek een groep")} />
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: ".6rem", justifyContent: "flex-end", borderTop: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.12)))", paddingTop: ".8rem", marginTop: "1rem" }}>
          <button type="button" className="btn" onClick={onClose}>{tx("Annuleren")}</button>
          {canEdit && <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? tx("Bezig…") : tx("Opslaan")}</button>}
        </div>
      </div>
  );
}


// The users and user groups that belong to the entity of the website itself (tab Gekoppeld of the page Bedrijf): pick them through a search and save.
export function EntityLinks({ canEdit }) {
  const [id, setId] = useState(null);
  const [users, setUsers] = useState(null);
  const [groups, setGroups] = useState(null);
  const [f, setF] = useState(null); // { user_ids, group_ids }
  const [base, setBase] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const list = await api("/entities/");
      const own = list.find((x) => x.is_own);
      if (!own) { setF({ user_ids: [], group_ids: [] }); return; }
      const d = await api(`/entities/${own.id}/`);
      const v = { user_ids: d.users.map((u) => u.id), group_ids: d.groups.map((g) => g.id) };
      setId(own.id); setF(v); setBase(JSON.stringify([[...v.user_ids].sort(), [...v.group_ids].sort()]));
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }, []);
  useEffect(() => { load(); api("/users/").then(setUsers).catch(() => setUsers([])); api("/user-groups/").then(setGroups).catch(() => setGroups([])); }, [load]);
  if (!f) return msg ? <div className="alert">{msg.text}</div> : null;
  const dirty = JSON.stringify([[...f.user_ids].sort(), [...f.group_ids].sort()]) !== base;
  const save = async () => {
    setBusy(true); setMsg(null);
    try { await api(`/entities/${id}/`, { method: "PUT", body: { user_ids: f.user_ids, group_ids: f.group_ids } }); setMsg({ ok: true, text: tx("Opgeslagen.") }); await load(); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  return (
    <div className="stack" style={{ gap: ".8rem" }}>
      <p className="muted" style={{ margin: 0 }}>{tx("De gebruikers en groepen die bij dit bedrijf horen. Voeg iemand toe met de + en zoek op naam; sla daarna op.")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.2rem", alignItems: "start" }}>
        <LinkList title={tx("Gebruikers")} icon={<IconUsers width={14} height={14} />} items={users} ids={f.user_ids} onChange={(v) => setF((x) => ({ ...x, user_ids: v }))} render={userLine} matchText={userMatch} canEdit={canEdit} emptyText={tx("Nog niemand gekoppeld.")} searchLabel={tx("Zoek een gebruiker")} />
        <LinkList title={tx("Groepen")} icon={<IconGroup width={14} height={14} />} items={groups} ids={f.group_ids} onChange={(v) => setF((x) => ({ ...x, group_ids: v }))} render={groupLine} matchText={(g) => g.name} canEdit={canEdit} emptyText={tx("Nog geen groep gekoppeld.")} searchLabel={tx("Zoek een groep")} />
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      {canEdit && <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="btn primary" disabled={!dirty || busy} onClick={save}>{busy ? tx("Bezig…") : tx("Opslaan")}</button></div>}
    </div>
  );
}

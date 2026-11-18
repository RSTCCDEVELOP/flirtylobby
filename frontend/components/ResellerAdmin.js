// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import KitScope from "../lib/ui-kit/KitScope";
import { IconCheck, IconEdit, IconTrash, IconX } from "./Icons";
import Loading from "./Loading";
import PhoneInput from "./PhoneInput";
import SmallEditor from "./SmallEditor";

// Super admin+ -> Licence -> Resellers: the resellers of easy2edit (company, three contact persons, websites, more information, the share of RST for the use of easy2edit)
// and their logins (made in the websites of the customers, passed on through the API). The public page /resellers shows them (searchable).
const ROLES = [["sales", "Sales"], ["financial", "Financieel"], ["support", "Support"], ["other", "Overig"]];
const ADDR = [["street", "Straat"], ["house_number", "Huisnummer"], ["postal_code", "Postcode"], ["city", "Plaats"], ["country", "Land"]];
const TABS = [["data", "Bedrijf"], ["address", "Adres"], ["info", "Informatie"], ["contact", "Contactpersonen"], ["margin", "Marge"], ["sites", "Websites"], ["logins", "Logins"]];
const ACCESS = [["user", "User"], ["admin", "Admin"], ["superadmin", "Superadmin"]];
const ACCESS_HINT = { user: "Gewone gebruiker, zonder extra rechten.", admin: "Beheerder: kan de website beheren (rol Admin).", superadmin: "Superadmin: alle rechten van een superadmin in de website van de klant." };
const EMPTY = { name: "", active: true, website: "", websites: [], info: "", address: {}, kvk: "", vat_id: "", contacts: {}, rst_share: "", notes: "" };
// how the share of a reseller compares to the standard of the price list: {kind: higher|lower|same, diff}
const compare = (own, def) => { const d = Math.round((Number(own) - Number(def)) * 100) / 100; return { kind: d > 0 ? "higher" : d < 0 ? "lower" : "same", diff: Math.abs(d) }; };
const ShareBadge = ({ own, def }) => { const c = compare(own, def); return <span className={`e2e-badge ${c.kind === "higher" ? "e2e-badge--success" : ""}`}>{c.kind === "same" ? tx("Gelijk aan de standaard") : c.kind === "higher" ? tx("Hoger dan de standaard ({0}%)", `+${c.diff}`) : tx("Lager dan de standaard ({0}%)", `-${c.diff}`)}</span>; };
// a block of the Gegevens tab: a heading with a short explanation, the fields below it
const Section = ({ title, hint, children }) => (
  <section className="e2e-stack" style={{ gap: ".8rem", paddingBottom: "1.4rem", borderBottom: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.12)))" }}>
    <div><strong style={{ fontSize: "1.02rem" }}>{tx(title)}</strong><br /><span className="e2e-hint">{tx(hint)}</span></div>
    {children}
  </section>
);
// a list as rows: a header row, a row per item with edit and delete; the form of an item opens under its row
const ROW = { display: "grid", alignItems: "center", gap: ".7rem", padding: ".5rem .5rem", borderBottom: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.12)))" };
const PCOLS = "minmax(170px,1.4fr) minmax(90px,.8fr) minmax(170px,1.5fr) minmax(130px,1fr) 84px";
const LCOLS = "minmax(190px,1.5fr) minmax(120px,1fr) minmax(90px,.7fr) minmax(90px,.7fr) minmax(110px,.8fr) 84px";
const RowHead = ({ cols, labels }) => <div style={{ ...ROW, gridTemplateColumns: cols, padding: ".3rem .5rem", fontSize: ".78rem", textTransform: "uppercase", letterSpacing: ".04em", opacity: 0.65 }}>{labels.map((l, i) => <span key={i}>{l ? tx(l) : ""}</span>)}</div>;
const RowActions = ({ onEdit, onDelete, open }) => (
  <div className="e2e-row" style={{ gap: ".25rem", justifyContent: "flex-end", flexWrap: "nowrap" }} onClick={(e) => e.stopPropagation()}>
    <button type="button" className={`e2e-btn e2e-btn--ghost e2e-btn--sm${open ? " is-active" : ""}`} aria-label={tx("Bewerken")} title={tx("Bewerken")} aria-expanded={!!open} onClick={onEdit}><IconEdit width={14} height={14} /></button>
    <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Verwijderen")} title={tx("Verwijderen")} onClick={onDelete}><IconTrash width={14} height={14} /></button>
  </div>
);
const cut = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 };
const eur = (v) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(v) || 0);

export default function ResellerAdmin() {
  const [list, setList] = useState(null);
  const [sites, setSites] = useState([]);
  const [defShare, setDefShare] = useState("0");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);  // the reseller in the pop-up
  const [error, setError] = useState("");
  const load = () => api("/system/resellers/").then((r) => { setList(r.resellers); setSites(r.sites); setDefShare(r.default_share); }).catch((e) => setError(errorText(e)));
  useEffect(() => { load(); }, []);
  const shown = (list || []).filter((r) => !q.trim() || [r.name, r.website, r.address?.city, r.contacts?.sales?.email].join(" ").toLowerCase().includes(q.trim().toLowerCase()));
  const remove = async (r) => {
    if (!(await confirmDialog(tx("Reseller {0} verwijderen? Zijn logins en koppelingen met websites vervallen.", r.name), { okLabel: tx("Verwijderen"), cancelLabel: tx("Annuleren") }))) return;
    try { await api(`/system/resellers/${r.id}/`, { method: "DELETE" }); load(); } catch (e) { setError(errorText(e)); }
  };
  return (
    <KitScope tag="ui-form-fields">
      <div className="e2e-stack" style={{ gap: "1rem" }}>
        <div className="e2e-row" style={{ gap: ".7rem", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}><strong style={{ fontSize: "1.05rem" }}>{tx("Resellers")}</strong><br /><span className="e2e-hint">{tx("Wie easy2edit verkoopt. Bezoekers vinden ze op de pagina /resellers van de easy2edit-site; de gegevens komen via de API.")}</span></div>
          <input className="e2e-input" style={{ maxWidth: 240 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoeken")} aria-label={tx("Zoeken")} />
          <button type="button" className="e2e-btn" onClick={() => setEdit({ ...EMPTY })}>{tx("Reseller toevoegen")}</button>
        </div>
        {error && <span className="e2e-error">{error}</span>}
        {!list ? <span className="e2e-hint">{tx("Laden…")}</span> : shown.length === 0 ? <span className="e2e-hint">{tx("Nog geen resellers.")}</span> : (
          <div className="e2e-grid" style={{ "--e2e-min": "300px", gap: ".8rem" }}>
            {shown.map((r) => (
              <div key={r.id} className="e2e-field" data-easy2edit-tag="ui-kpi" style={{ gap: ".35rem", padding: "1rem 1.1rem", border: "1px solid var(--line)", borderRadius: "var(--radius, 12px)", background: "var(--card)" }}>
                <div className="e2e-row" style={{ gap: ".5rem", alignItems: "center", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: "1.05rem" }}>{r.name}</strong>
                  <span className={`e2e-badge ${r.active ? "e2e-badge--success" : ""}`}>{r.active ? tx("actief") : tx("niet actief")}</span>
                </div>
                <span className="e2e-hint">{[r.address?.city, r.website].filter(Boolean).join(" · ") || "-"}</span>
                <span className="e2e-hint">{tx("Aandeel RST")}: {Number(r.share)}% · {r.sites.length} {tx("websites")} · {r.logins.length} {tx("logins")}</span>
                <div><ShareBadge own={r.share} def={defShare} /></div>
                <div className="e2e-row" style={{ gap: ".5rem", marginTop: ".4rem" }}>
                  <button type="button" className="e2e-btn e2e-btn--outline e2e-btn--sm" onClick={() => setEdit(r)}>{tx("Bewerken")}</button>
                  <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" onClick={() => remove(r)}>{tx("Verwijderen")}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {edit && <ResellerDialog start={edit} sites={sites} defShare={defShare} onClose={() => { setEdit(null); load(); }} />}
    </KitScope>
  );
}

function ResellerDialog({ start, sites, defShare, onClose }) {
  const [r, setR] = useState(start);  // (rst_share empty = the standard of the price list, which is the share that is shown)
  const [tab, setTab] = useState("data");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errs, setErrs] = useState({});
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [shownPw, setShownPw] = useState(null);  // the blue block of a login: {id, email, name, password (only when it was made or sent here), sent}
  const [pws, setPws] = useState({});  // the passwords that were made in this pop-up (never kept anywhere else: they are stored scrambled)
  const rememberPw = (id, email, password, sent) => { if (id != null) setPws((v) => ({ ...v, [id]: { password, sent } })); setShownPw({ id, email, password, sent }); };
  const pickLogin = (l) => setShownPw(shownPw?.id === l.id ? null : { id: l.id, email: l.email, name: l.name, ...(pws[l.id] || { password: null, sent: false }) });
  const saved = !!r.id;
  const set = (k, v) => { setNote(""); setR((x) => ({ ...x, [k]: v })); };
  // contact persons: a list (more than one is possible); the address is the main address of the reseller unless the person has its own
  const people = Array.isArray(r.contacts) ? r.contacts : [];
  const [pickSite, setPickSite] = useState(false);  // the search for a website to link
  const [siteQ, setSiteQ] = useState("");
  const [work, setWork] = useState(null);  // the pop-up while a login is made or deleted: {state: busy | done | error, title, text, login}
  const [openL, setOpenL] = useState(null);  // the login whose form is open
  const [openP, setOpenP] = useState(null);  // the person whose form is open
  const setPeople = (list) => { setNote(""); setR((x) => ({ ...x, contacts: list })); };
  const person = (n, k, v) => setPeople(people.map((p, i) => (i === n ? { ...p, [k]: v } : p)));
  // the switch "also make a login": on = the login is made at once (and the password mailed), off = the login is deleted
  const loginOf = (p) => (p.email ? (r.logins || []).find((l) => l.email.toLowerCase() === String(p.email).trim().toLowerCase()) : null);
  const toggleLogin = async (p, on) => {
    setError(""); setShownPw(null); setNote("");
    const fail = (text) => setWork({ state: "error", title: on ? tx("Login maken") : tx("Login verwijderen"), text });
    if (!saved) { fail(tx("Bewaar de reseller eerst.")); return; }
    if (on) {
      if (!String(p.email || "").trim()) { fail(tx("Een login heeft een e-mailadres nodig.")); return; }
      if (!String(p.first_name || "").trim() || !String(p.last_name || "").trim()) { fail(tx("Vul de voornaam en de achternaam in.")); return; }
      setWork({ state: "busy", title: tx("Login maken"), text: tx("De login wordt gemaakt en het wachtwoord gemaild…") });
      try {
        const x = await api(`/system/resellers/${r.id}/logins/`, { method: "POST", body: { email: p.email.trim(), name: `${p.first_name.trim()} ${p.last_name.trim()}`, function: p.function, phone: p.phone, mobile: p.mobile, access: "admin", otp: "email", all_sites: true, host: true, send: true } });
        setR((v) => ({ ...v, logins: [...(v.logins || []), x.login] }));
        rememberPw(x.login.id, x.login.email, x.password, x.sent);
        setWork({ state: "done", title: tx("Login gemaakt"), text: x.sent ? tx("Het wachtwoord is per e-mail verstuurd.") : tx("Het wachtwoord is niet per e-mail verstuurd: geef het zelf door."), login: { email: x.login.email, password: x.password } });
      } catch (e) { const er = e?.data?.errors || {}; fail(Object.keys(er).length ? Object.values(er).map((m) => tx(m)).join(" ") : errorText(e)); }
      return;
    }
    const l = loginOf(p);
    if (!l || !(await confirmDialog(tx("Login {0} verwijderen?", l.email), { okLabel: tx("Verwijderen"), cancelLabel: tx("Annuleren") }))) return;
    setWork({ state: "busy", title: tx("Login verwijderen"), text: tx("De login wordt verwijderd…") });
    try {
      await api(`/system/resellers/${r.id}/logins/${l.id}/`, { method: "DELETE" });
      setR((v) => ({ ...v, logins: (v.logins || []).filter((y) => y.id !== l.id) }));
      setWork({ state: "done", title: tx("Login verwijderd"), text: l.email });
    } catch (e) { fail(errorText(e)); }
  };
  const addPerson = () => { const np = { id: `n${Date.now()}`, role: ["sales", "financial", "support"].find((k) => !people.some((p) => p.role === k)) || "other", first_name: "", last_name: "", function: "", email: "", phone: "", mobile: "", same_address: true, address: {} }; setPeople([...people, np]); setOpenP(np.id); };
  const save = async () => {
    setBusy(true); setError(""); setErrs({}); setNote("");
    const body = { name: r.name, active: r.active, website: r.website, email: r.email, phone: r.phone, websites: r.websites, info: r.info, address: r.address, kvk: r.kvk, vat_id: r.vat_id, contacts: r.contacts, rst_share: Number(String(r.rst_share ?? "").replace(",", ".")) === Number(defShare) ? "" : (r.rst_share ?? ""), notes: r.notes };
    try { const x = saved ? await api(`/system/resellers/${r.id}/`, { method: "PUT", body }) : await api("/system/resellers/", { method: "POST", body }); setR(x); setNote(tx("Opgeslagen.")); if (x.new_logins?.length) { const l = x.new_logins[0]; rememberPw(null, l.email, l.password, l.sent); setTab("logins"); } }
    catch (e) { const er = e?.data?.errors || {}; setErrs(er); setError(Object.keys(er).length ? Object.values(er).map((m) => tx(m)).join(" ") : errorText(e)); if (er.name) setTab("data"); else if (Object.keys(er).some((k) => k.startsWith("contact_"))) setTab("contact"); else if (er.rst_share) setTab("margin"); }
    setBusy(false);
  };
  const setSites = async (ids) => { try { setR(await api(`/system/resellers/${r.id}/sites/`, { method: "PUT", body: { site_ids: ids } })); } catch (e) { setError(errorText(e)); } };
  const addLogin = async (body) => {  // -> true when it worked
    setError(""); setShownPw(null);
    try { const x = await api(`/system/resellers/${r.id}/logins/`, { method: "POST", body }); rememberPw(x.login.id, x.login.email, x.password, x.sent); setR(await api(`/system/resellers/${r.id}/`)); return true; }
    catch (e) { setError(errorText(e)); return false; }
  };
  const patchLogin = async (l, body) => {
    setError(""); setShownPw(null);
    try { const x = await api(`/system/resellers/${r.id}/logins/${l.id}/`, { method: "PATCH", body }); if (x.password) rememberPw(l.id, l.email, x.password, x.sent); setR(await api(`/system/resellers/${r.id}/`)); }
    catch (e) { setError(errorText(e)); }
  };
  const delLogin = async (l) => {
    if (!(await confirmDialog(tx("Login {0} verwijderen?", l.email), { okLabel: tx("Verwijderen"), cancelLabel: tx("Annuleren") }))) return;
    try { await api(`/system/resellers/${r.id}/logins/${l.id}/`, { method: "DELETE" }); setR(await api(`/system/resellers/${r.id}/`)); } catch (e) { setError(errorText(e)); }
  };
  // the standard is not stored (empty): it follows the price list
  const share = r.rst_share === "" || r.rst_share == null ? Number(defShare) : Number(String(r.rst_share).replace(",", ".")) || 0;
  const lines = (label, v, k) => <div className="e2e-field" key={k}><label className="e2e-label" htmlFor={`rs-${k}`}><span>{tx(label.replace(/ \*$/, ""))}{/ \*$/.test(label) && <span style={{ color: "var(--e2e-danger)" }}> *</span>}</span></label>{v}</div>;
  const inp = (k, label, extra = {}) => lines(label, <input id={`rs-${k}`} className="e2e-input" value={r[k] || ""} onChange={(e) => set(k, e.target.value)} {...extra} />, k);
  const mineSites = sites.filter((s) => !s.reseller || s.reseller === r.id);
  const picked = new Set((r.sites || []).map((s) => s.id));
  return createPortal(
    <div className="overlay" style={{ zIndex: 3050 }} onClick={onClose}>
      <div className="card modal wide" role="dialog" aria-label={tx("Reseller")} style={{ width: "min(1120px, 96vw)", maxWidth: "96vw", maxHeight: "92vh", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <KitScope tag="ui-form-fields" className="sw-col">
          <div className="sw-wrap">
            <div style={{ padding: "1.3rem 1.6rem 0", borderBottom: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.12)))", display: "grid", gap: "1rem", flex: "0 0 auto" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                <div><h2 style={{ margin: 0 }}>{saved ? r.name : tx("Nieuwe reseller")}</h2><span className="e2e-hint">{tx("Een reseller is compleet met contactpersonen, websites en de marge voor easy2edit.")}</span></div>
                <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Sluiten")} onClick={onClose}><IconX width={16} height={16} /></button>
              </div>
              <div className="e2e-tabs gs-tabs" data-easy2edit-tag="ui-tabs"><div className="e2e-tabs__list" role="tablist">
                {TABS.map(([k, label]) => <button key={k} type="button" role="tab" className="e2e-tabs__tab" aria-selected={tab === k} onClick={() => setTab(k)}>{tx(label)}</button>)}
              </div></div>
            </div>
            <div className="sw-body rs-compact" style={{ padding: "1.1rem 1.6rem" }}>
              <style>{`.rs-compact .e2e-input, .rs-compact select.e2e-input { min-height: 0; height: 34px; padding: .25rem .65rem; font-size: .9rem; }
.rs-compact textarea.e2e-input { height: auto; }
.rs-compact .e2e-label { font-size: .82rem; margin-bottom: .15rem; }
.rs-compact .e2e-field { gap: .2rem; }
.rs-compact .e2e-grid { gap: .6rem .8rem; }
.rs-compact button[aria-haspopup], .rs-compact [class*="phone"] button { min-height: 0; height: 34px; }`}</style>
              {tab === "data" && (
                <div className="e2e-stack" style={{ gap: "1.6rem" }}>
                  <Section title="Bedrijf" hint="De naam waaronder de reseller bekend is en of hij op de pagina Resellers getoond wordt.">
                    <div className="e2e-grid" style={{ "--e2e-min": "230px" }}>
                  <div className="e2e-field" style={{ gridColumn: "1 / -1" }}><label className="e2e-label" htmlFor="rs-name"><span>{tx("Naam van de reseller")} <span style={{ color: "var(--e2e-danger)" }}>*</span></span></label>
                    <input id="rs-name" className={`e2e-input${errs.name ? " e2e-input--error" : ""}`} value={r.name} onChange={(e) => set("name", e.target.value)} />{errs.name && <span className="e2e-error">{tx(errs.name)}</span>}</div>
                      {inp("kvk", "KvK-nummer")}
                      {inp("vat_id", "BTW-nummer")}
                    </div>
                  <label className="e2e-switch" style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: ".5rem" }}><input type="checkbox" checked={!!r.active} onChange={(e) => set("active", e.target.checked)} /> {tx("Actief: tonen op de pagina Resellers")}</label>
                  </Section>
                  <Section title="Contact" hint="Het algemene contact van het bedrijf. Persoonlijke contacten staan bij Contactpersonen.">
                    <div className="e2e-grid" style={{ "--e2e-min": "230px" }}>
                      {inp("website", "Website", { placeholder: "https://www.voorbeeld.nl" })}
                  <div className="e2e-field"><label className="e2e-label" htmlFor="rs-email"><span>{tx("E-mail")}</span></label><input id="rs-email" type="email" className={`e2e-input${errs.email ? " e2e-input--error" : ""}`} value={r.email || ""} onChange={(e) => set("email", e.target.value)} />{errs.email && <span className="e2e-error">{tx(errs.email)}</span>}</div>
                  <div className="e2e-field"><label className="e2e-label" htmlFor="rs-phone"><span>{tx("Telefoon")}</span></label><PhoneInput id="rs-phone" value={r.phone || ""} onChange={(v) => set("phone", v)} />{errs.phone && <span className="e2e-error">{tx(errs.phone)}</span>}</div>
                    </div>
                  </Section>
                </div>
              )}
              {tab === "address" && (
                <div className="e2e-stack" style={{ gap: "1.6rem" }}>
                  <Section title="Adres" hint="Het hoofdadres. Contactpersonen nemen dit standaard over.">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: ".9rem" }}>
                      {ADDR.map(([k, label]) => {
                        const span = { street: 4, house_number: 2, postal_code: 2, city: 4 }[k] || 3;
                        return <div key={k} style={{ gridColumn: `span ${span}`, minWidth: 0 }}>{lines(label, <input id={`rs-a-${k}`} className="e2e-input" value={r.address?.[k] || ""} onChange={(e) => set("address", { ...(r.address || {}), [k]: e.target.value })} />, `a-${k}`)}</div>;
                      })}
                    </div>
                  </Section>
                </div>
              )}
              {tab === "info" && (
                <div className="e2e-stack" style={{ gap: "1.6rem" }}>
                  <Section title="Openbare informatie" hint="Wordt getoond op de openbare pagina Resellers.">
                  <div className="e2e-field" style={{ gridColumn: "1 / -1" }}><label className="e2e-label"><span>{tx("Meer informatie (openbaar)")}</span></label><SmallEditor value={r.info} onChange={(v) => set("info", v)} minHeight={110} /></div>
                  </Section>
                  <Section title="Intern" hint="Alleen zichtbaar voor een superadmin+.">
                  <div className="e2e-field" style={{ gridColumn: "1 / -1" }}><label className="e2e-label" htmlFor="rs-notes"><span>{tx("Interne notitie")}</span></label><textarea id="rs-notes" className="e2e-input" rows={3} value={r.notes || ""} onChange={(e) => set("notes", e.target.value)} /><span className="e2e-hint">{tx("Alleen zichtbaar voor een superadmin+.")}</span></div>
                  </Section>
                </div>
              )}
              {tab === "contact" && (
                <div className="e2e-stack" style={{ gap: ".8rem" }}>
                  <div className="e2e-row" style={{ justifyContent: "space-between", alignItems: "center", gap: ".8rem" }}>
                    <span />
                    <button type="button" className="e2e-btn e2e-btn--sm" onClick={addPerson}>+ {tx("Persoon toevoegen")}</button>
                  </div>
                  {people.length > 0 && <div style={{ overflowX: "auto" }}><RowHead cols={PCOLS} labels={["Naam", "Functie", "E-mail", "Telefoon", ""]} />
                  {people.map((p, n) => (
                    <div key={p.id || n} className="e2e-stack" style={{ gap: 0 }}>
                      <div style={{ ...ROW, gridTemplateColumns: PCOLS }}>
                        <span style={{ ...cut, display: "flex", gap: ".5rem", alignItems: "center" }}><strong style={{ ...cut }}>{[p.first_name, p.last_name].filter(Boolean).join(" ") || <em className="e2e-hint">{tx("Nieuwe persoon")}</em>}</strong><span className="e2e-badge">{tx(ROLES.find((x) => x[0] === p.role)?.[1] || "Overig")}</span>{loginOf(p) && <span className="e2e-badge e2e-badge--success" title={tx("Deze persoon heeft een login (zie Logins).")}>{tx("Login")}</span>}</span>
                        <span style={{ ...cut }} title={p.function}>{p.function || "–"}</span>
                        <span style={{ ...cut }} title={p.email}>{p.email || "–"}</span>
                        <span style={{ ...cut }}>{p.phone || p.mobile || "–"}</span>
                        <RowActions open={openP === (p.id || n)} onEdit={() => setOpenP(openP === (p.id || n) ? null : (p.id || n))} onDelete={() => setPeople(people.filter((_, i) => i !== n))} />
                      </div>
                      {openP === (p.id || n) && (
                    <div data-easy2edit-tag="ui-kpi" className="e2e-stack" style={{ gap: ".7rem", padding: "1rem 1.1rem", border: "1px solid var(--line)", borderRadius: "var(--radius, 12px)", background: "var(--card)"  , margin: ".4rem 0 .8rem" }}>
                      <div className="e2e-row" style={{ gap: ".5rem", alignItems: "center", justifyContent: "space-between" }}>
                        <select className="e2e-input" style={{ width: "auto" }} value={p.role} aria-label={tx("Rol")} onChange={(e) => person(n, "role", e.target.value)}>{ROLES.map(([k, label]) => <option key={k} value={k}>{tx(label)}</option>)}</select>
                        <button type="button" className="e2e-btn e2e-btn--sm" onClick={() => setOpenP(null)}>{tx("Klaar")}</button>
                      </div>
                      <div className="e2e-grid" style={{ "--e2e-min": "210px" }}>
                        {lines("Voornaam *", <><input className={`e2e-input${errs[`contact_name_${n}`] && !p.first_name ? " e2e-input--error" : ""}`} value={p.first_name || ""} maxLength={60} onChange={(e) => person(n, "first_name", e.target.value)} /></>, `p${n}-fn`)}
                        {lines("Achternaam *", <><input className={`e2e-input${errs[`contact_name_${n}`] && !p.last_name ? " e2e-input--error" : ""}`} value={p.last_name || ""} maxLength={60} onChange={(e) => person(n, "last_name", e.target.value)} />{errs[`contact_name_${n}`] && <span className="e2e-error">{tx(errs[`contact_name_${n}`])}</span>}</>, `p${n}-ln`)}
                        {lines("Functie", <input className="e2e-input" value={p.function || ""} onChange={(e) => person(n, "function", e.target.value)} />, `p${n}-f`)}
                        {lines("E-mail", <><input type="email" className={`e2e-input${errs[`contact_${n}`] ? " e2e-input--error" : ""}`} value={p.email || ""} onChange={(e) => person(n, "email", e.target.value)} />{errs[`contact_${n}`] && <span className="e2e-error">{tx(errs[`contact_${n}`])}</span>}</>, `p${n}-e`)}
                        {lines("Telefoon", <PhoneInput value={p.phone || ""} onChange={(v) => person(n, "phone", v)} />, `p${n}-p`)}
                        {lines("Mobiel", <><PhoneInput value={p.mobile || ""} onChange={(v) => person(n, "mobile", v)} />{errs[`contact_phone_${n}`] && <span className="e2e-error">{tx(errs[`contact_phone_${n}`])}</span>}</>, `p${n}-m`)}
                      </div>
                      <label className="e2e-switch" style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: ".5rem" }}><input type="checkbox" disabled={busy || work?.state === "busy"} checked={!!loginOf(p)} onChange={(e) => toggleLogin(p, e.target.checked)} /> {tx("Ook een login maken")}</label>
                      <span className="e2e-hint">{loginOf(p) ? tx("Deze persoon heeft een login (zie Logins). Zet je de schakelaar uit, dan wordt de login verwijderd.") : tx("Zet je de schakelaar aan, dan wordt direct een login gemaakt met dit e-mailadres (rechten Admin, code per e-mail) en het wachtwoord gemaild. Rechten en websites pas je aan bij Logins.")}</span>
                      <label className="e2e-switch" style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: ".5rem" }}><input type="checkbox" checked={p.same_address !== false} onChange={(e) => setPeople(people.map((x, i) => (i === n ? { ...x, same_address: e.target.checked, address: e.target.checked || Object.values(x.address || {}).some(Boolean) ? x.address : { ...(r.address || {}) } } : x)))} /> {tx("Zelfde adres als het hoofdadres")}</label>
                      {p.same_address === false && (
                        <div className="e2e-grid" style={{ "--e2e-min": "130px" }}>
                          {ADDR.map(([k, label]) => lines(label, <input className="e2e-input" value={p.address?.[k] || ""} onChange={(e) => person(n, "address", { ...(p.address || {}), [k]: e.target.value })} />, `p${n}-a-${k}`))}
                        </div>
                      )}
                    </div>
                      )}
                    </div>
                  ))}
                  </div>}
                </div>
              )}
              {tab === "margin" && (
                <div className="e2e-stack" style={{ gap: "1rem" }}>
                  <p style={{ margin: 0 }}>{tx("Voor elke reseller leg je vast welk deel van de softwareprijs naar RST gaat voor het gebruik van easy2edit. De rest is de marge van de reseller. Zie ook het prijssysteem (Super admin → Prijzen).")}</p>
                  <div className="e2e-field" style={{ maxWidth: 360 }}><label className="e2e-label" htmlFor="rs-share"><span>{tx("Aandeel RST (%)")}</span></label>
                    <div className="e2e-row" style={{ gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>
                      <input id="rs-share" className={`e2e-input${errs.rst_share ? " e2e-input--error" : ""}`} style={{ maxWidth: 120 }} inputMode="decimal" value={r.rst_share === "" || r.rst_share == null ? String(Number(defShare)) : r.rst_share} onChange={(e) => set("rst_share", e.target.value)} />
                      <ShareBadge own={share} def={defShare} />
                      {share !== Number(defShare) && <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" onClick={() => set("rst_share", "")}>{tx("Standaard herstellen")}</button>}
                    </div>
                    <span className="e2e-hint">{tx("De standaard uit de prijslijst is {0}%. Een ander percentage geldt alleen voor deze reseller.", Number(defShare))}</span>{errs.rst_share && <span className="e2e-error">{tx(errs.rst_share)}</span>}</div>
                  <div className="e2e-grid" style={{ "--e2e-min": "170px" }}>
                    <div className="e2e-field" data-easy2edit-tag="ui-kpi"><span className="e2e-hint">{tx("Voorbeeld: softwareprijs")}</span><strong style={{ fontSize: "1.3rem" }}>{eur(100)}</strong></div>
                    <div className="e2e-field" data-easy2edit-tag="ui-kpi"><span className="e2e-hint">{tx("RST krijgt")}</span><strong style={{ fontSize: "1.3rem" }}>{eur(share)}</strong></div>
                    <div className="e2e-field" data-easy2edit-tag="ui-kpi"><span className="e2e-hint">{tx("Marge van de reseller")}</span><strong style={{ fontSize: "1.3rem" }}>{eur(100 - share)}</strong></div>
                  </div>
                </div>
              )}
              {tab === "sites" && (!saved ? <span className="e2e-hint">{tx("Bewaar de reseller eerst.")}</span> : (
                <div className="e2e-stack" style={{ gap: "1.2rem" }}>
                  <div className="e2e-stack" style={{ gap: ".6rem" }}>
                    <strong>{tx("Websites van de reseller")}</strong>
                    {(r.websites || []).map((w, i) => (
                      <div key={i} className="e2e-row" style={{ gap: ".5rem" }}>
                        <input className="e2e-input" style={{ maxWidth: 200 }} value={w.label} placeholder={tx("Naam")} onChange={(e) => set("websites", r.websites.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                        <input className="e2e-input" style={{ flex: 1 }} value={w.url} placeholder="https://" onChange={(e) => set("websites", r.websites.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                        <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Verwijderen")} onClick={() => set("websites", r.websites.filter((_, j) => j !== i))}><IconX width={14} height={14} /></button>
                      </div>
                    ))}
                    <div><button type="button" className="e2e-btn e2e-btn--outline e2e-btn--sm" onClick={() => set("websites", [...(r.websites || []), { label: "", url: "" }])}>{tx("Website toevoegen")}</button> <span className="e2e-hint">{tx("Bewaar daarna met Opslaan.")}</span></div>
                  </div>
                  <div className="e2e-stack" style={{ gap: ".7rem" }}>
                    <div className="e2e-row" style={{ justifyContent: "space-between", alignItems: "center", gap: ".8rem" }}>
                      <div><strong>{tx("easy2edit-websites van klanten")}</strong><br /><span className="e2e-hint">{tx("De logins van deze reseller worden aangemaakt in de websites die je hier koppelt.")}</span></div>
                      {!pickSite && <button type="button" className="e2e-btn e2e-btn--sm" onClick={() => { if (!saved) { setError(tx("Bewaar de reseller eerst.")); return; } setPickSite(true); setSiteQ(""); }}>+ {tx("Website koppelen")}</button>}
                    </div>
                    {pickSite && (
                      <div className="e2e-stack" data-easy2edit-tag="ui-kpi" style={{ gap: ".5rem", padding: ".8rem 1rem", border: "1px solid var(--line)", borderRadius: "var(--radius, 12px)", background: "var(--card)" }}>
                        <div className="e2e-row" style={{ gap: ".5rem", alignItems: "center", flexWrap: "nowrap" }}>
                          <input className="e2e-input" autoFocus type="search" value={siteQ} onChange={(e) => setSiteQ(e.target.value)} placeholder={tx("Zoek een website op naam of adres")} aria-label={tx("Zoeken")} style={{ flex: 1 }} />
                          <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Sluiten")} title={tx("Sluiten")} onClick={() => setPickSite(false)}><IconX width={14} height={14} /></button>
                        </div>
                        {(() => {
                          const q = siteQ.trim().toLowerCase();
                          const found = mineSites.filter((x) => !picked.has(x.id) && (!q || `${x.name} ${x.url}`.toLowerCase().includes(q)));
                          if (!found.length) return <span className="e2e-hint">{mineSites.length === 0 ? tx("Er zijn nog geen websites aangemeld bij de Site manager.") : tx("Geen websites gevonden.")}</span>;
                          return (
                            <div style={{ maxHeight: 240, overflowY: "auto" }}>
                              {found.slice(0, 50).map((x) => (
                                <button key={x.id} type="button" className="e2e-btn e2e-btn--ghost" style={{ ...ROW, gridTemplateColumns: "minmax(140px,1fr) minmax(180px,2fr) auto", width: "100%", textAlign: "left", borderRadius: 0 }} onClick={() => setSites([...picked, x.id])}>
                                  <strong style={{ ...cut }}>{x.name || x.url}</strong><span className="e2e-hint" style={{ ...cut }}>{x.url}</span><span>+</span>
                                </button>
                              ))}
                              {found.length > 50 && <span className="e2e-hint">{tx("Er zijn meer websites: verfijn je zoekopdracht.")}</span>}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {(r.sites || []).length === 0 ? <span className="e2e-hint">{tx("Nog geen websites gekoppeld.")}</span> : (
                      <div style={{ overflowX: "auto" }}>
                        <RowHead cols="minmax(160px,1fr) minmax(200px,2fr) 50px" labels={["Naam", "Website", ""]} />
                        {(r.sites || []).map((x) => (
                          <div key={x.id} style={{ ...ROW, gridTemplateColumns: "minmax(160px,1fr) minmax(200px,2fr) 50px" }}>
                            <strong style={{ ...cut }}>{x.name || x.url}</strong>
                            <span style={{ ...cut }} title={x.url}>{x.url}</span>
                            <div className="e2e-row" style={{ justifyContent: "flex-end" }}><button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Ontkoppelen")} title={tx("Ontkoppelen")} onClick={() => setSites([...picked].filter((y) => y !== x.id))}><IconTrash width={14} height={14} /></button></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {tab === "logins" && (!saved ? <span className="e2e-hint">{tx("Bewaar de reseller eerst.")}</span> : (
                <div className="e2e-stack" style={{ gap: "1.1rem" }}>
                  {shownPw && (
                    <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts" style={{ alignItems: "flex-start" }}>
                      <span className="e2e-alert__icon"><IconCheck width={14} height={14} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ overflowWrap: "anywhere" }}>{shownPw.email}</strong>{shownPw.name ? <span className="e2e-hint"> · {shownPw.name}</span> : null}<br />
                        {shownPw.password
                          ? <>{tx("Wachtwoord")}: <code style={{ userSelect: "all" }}>{shownPw.password}</code><br /><span className="e2e-hint">{shownPw.sent ? tx("Het wachtwoord is per e-mail verstuurd.") : tx("Het wachtwoord wordt maar één keer getoond.")}</span></>
                          : <span className="e2e-hint">{tx("Het wachtwoord is niet meer te zien. Mail een nieuw wachtwoord als de persoon het kwijt is.")}</span>}
                        {shownPw.id != null && !shownPw.password && <div style={{ marginTop: ".5rem" }}><button type="button" className="e2e-btn e2e-btn--outline e2e-btn--sm" onClick={() => { const l = (r.logins || []).find((y) => y.id === shownPw.id); if (l) patchLogin(l, { new_password: true, send: true }); }}>{tx("Nieuw wachtwoord mailen")}</button></div>}
                      </div>
                      <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Sluiten")} title={tx("Sluiten")} onClick={() => setShownPw(null)}><IconX width={14} height={14} /></button>
                    </div>
                  )}
                  <div className="e2e-stack" style={{ gap: ".8rem" }}>
                    <div className="e2e-row" style={{ justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                      <div style={{ minWidth: 0 }}><strong style={{ fontSize: "1.02rem" }}>{tx("Logins")}</strong><br /><span className="e2e-hint">{tx("Met een login kan de reseller inloggen op de easy2edit van de klant. De logins worden via de API doorgegeven aan de websites van de klanten (zie Websites).")}</span></div>
                      {!adding && <button type="button" className="e2e-btn e2e-btn--sm" style={{ flex: "0 0 auto" }} onClick={() => { setAdding(true); setOpenL(null); }}>+ {tx("Login toevoegen")}</button>}
                    </div>
                    {adding && <LoginTile isNew l={{ email: "", name: "", function: "", phone: "", mobile: "", access: "admin", otp: "email", all_sites: true, site_ids: [], host: true, active: true }} sites={r.sites || []} lines={lines} onSave={async (body) => { if (await addLogin(body)) setAdding(false); }} onRemove={() => setAdding(false)} />}
                    {(r.logins || []).length === 0 && !adding && <div className="e2e-stack" style={{ alignItems: "center", textAlign: "center", gap: ".3rem", padding: "1.6rem 1rem", border: "1px dashed var(--e2e-line, var(--line, rgba(0,0,0,.2)))", borderRadius: "var(--radius, 12px)" }}><strong>{tx("Nog geen logins")}</strong><span className="e2e-hint">{tx("Voeg een login toe, of zet bij een contactpersoon de schakelaar “Ook een login maken” aan.")}</span></div>}
                    {(r.logins || []).length > 0 && (
                      <div style={{ overflowX: "auto" }}>
                        <RowHead cols={LCOLS} labels={["E-mail", "Naam", "Rechten", "Code", "Websites", ""]} />
                        {(r.logins || []).map((l) => (
                          <div key={l.id} className="e2e-stack" style={{ gap: 0 }}>
                            <div role="button" tabIndex={0} aria-pressed={shownPw?.id === l.id} onClick={() => pickLogin(l)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickLogin(l); } }} style={{ ...ROW, gridTemplateColumns: LCOLS, opacity: l.active ? 1 : 0.6, cursor: "pointer", background: shownPw?.id === l.id ? "var(--e2e-surface, rgba(80,140,200,.10))" : "transparent" }}>
                              <strong style={{ ...cut }} title={l.email}>{l.email}</strong>
                              <span style={{ ...cut }}>{l.name || "–"}</span>
                              <span><span className="e2e-badge">{tx(ACCESS.find((x) => x[0] === l.access)?.[1] || l.access)}</span></span>
                              <span style={{ ...cut }}>{l.otp === "email" ? tx("E-mail") : l.otp === "sms" ? "SMS" : "–"}</span>
                              <span style={{ ...cut }}>{l.all_sites ? tx("Alle websites") : `${(l.site_ids || []).length} ${tx("websites")}`}</span>
                              <RowActions open={openL === l.id} onEdit={() => { setOpenL(openL === l.id ? null : l.id); setAdding(false); }} onDelete={() => delLogin(l)} />
                            </div>
                            {openL === l.id && <div style={{ margin: ".4rem 0 .8rem" }}><LoginTile l={l} sites={r.sites || []} lines={lines} onSave={(body) => patchLogin(l, body)} onRemove={() => setOpenL(null)} /></div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: ".9rem 1.6rem", borderTop: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.12)))", display: "flex", alignItems: "center", gap: ".8rem", flex: "0 0 auto" }}>
              <div style={{ flex: 1 }}>{error ? <span className="e2e-error">{error}</span> : note ? <span className="e2e-hint">{note}</span> : null}</div>
              <button type="button" className="e2e-btn e2e-btn--ghost" onClick={onClose}>{tx("Sluiten")}</button>
              <button type="button" className="e2e-btn" disabled={busy} onClick={save}>{tx("Opslaan")}</button>
            </div>
          </div>
        </KitScope>
      </div>
      {work && (
        <div className="overlay" style={{ zIndex: 3100 }} onClick={(e) => { e.stopPropagation(); if (work.state !== "busy") setWork(null); }}>
          <div className="card modal" role="alertdialog" aria-live="polite" aria-label={work.title} style={{ maxWidth: 440, width: "92vw", padding: "1.4rem 1.6rem" }} onClick={(e) => e.stopPropagation()}>
            <KitScope tag="ui-alerts">
              <div className="e2e-stack" style={{ gap: ".9rem", textAlign: "center", alignItems: "center" }}>
                {work.state === "busy" ? <Loading /> : <span className={`e2e-alert__icon${work.state === "error" ? " e2e-alert__icon--danger" : ""}`} style={{ width: 40, height: 40 }}>{work.state === "error" ? <IconX width={20} height={20} /> : <IconCheck width={20} height={20} />}</span>}
                <h3 style={{ margin: 0 }}>{work.title}</h3>
                <span className={work.state === "error" ? "e2e-error" : "e2e-hint"} style={{ overflowWrap: "anywhere" }}>{work.text}</span>
                {work.login && (
                  <div style={{ width: "100%", padding: ".7rem", borderRadius: "var(--e2e-radius, 10px)", border: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.12)))" }}>
                    <strong style={{ overflowWrap: "anywhere" }}>{work.login.email}</strong><br />
                    <span className="e2e-hint">{tx("Wachtwoord")}: </span><code style={{ userSelect: "all" }}>{work.login.password}</code>
                  </div>
                )}
                {work.state !== "busy" && <button type="button" className="e2e-btn" autoFocus onClick={() => setWork(null)}>{tx("Sluiten")}</button>}
              </div>
            </KitScope>
          </div>
        </div>
      )}
    </div>, document.body);
}

// One login as a tile (also the new one): all data, the rights in the websites, the code check (OTP) at login and where the person may log in.
function LoginTile({ l, isNew = false, sites, lines, onSave, onRemove }) {
  const [d, setD] = useState(() => { const [f, ...rest] = String(l.name || "").trim().split(/\s+/); return { ...l, first_name: f || "", last_name: rest.join(" "), password: "", send: true }; });
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const picked = new Set(d.site_ids || []);
  const body = { name: `${(d.first_name || "").trim()} ${(d.last_name || "").trim()}`.trim(), function: d.function, phone: d.phone, mobile: d.mobile, access: d.access, otp: d.otp, all_sites: d.all_sites, site_ids: d.site_ids, host: d.host, active: d.active, ...(isNew ? { email: d.email, password: d.password, send: d.send } : {}) };
  const dirty = isNew || ["first_name", "last_name", "function", "phone", "mobile", "access", "otp", "all_sites", "host", "active"].some((k) => (k === "first_name" || k === "last_name" ? d[k] !== (k === "first_name" ? String(l.name || "").trim().split(/\s+/)[0] || "" : String(l.name || "").trim().split(/\s+/).slice(1).join(" ")) : d[k] !== l[k])) || JSON.stringify(d.site_ids || []) !== JSON.stringify(l.site_ids || []);
  return (
    <div data-easy2edit-tag="ui-kpi" className="e2e-stack" style={{ gap: ".7rem", padding: "1rem 1.1rem", border: "1px solid var(--line)", borderRadius: "var(--radius, 12px)", background: "var(--card)", opacity: d.active ? 1 : 0.7 }}>
      <div className="e2e-row" style={{ gap: ".5rem", alignItems: "center", justifyContent: "space-between" }}>
        {isNew ? <strong>{tx("Login toevoegen")}</strong> : <strong style={{ overflowWrap: "anywhere" }}>{l.email}</strong>}
        <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx(isNew ? "Annuleren" : "Sluiten")} title={tx(isNew ? "Annuleren" : "Sluiten")} onClick={onRemove}><IconX width={14} height={14} /></button>
      </div>
      <div className="e2e-grid" style={{ "--e2e-min": "210px" }}>
        {isNew && lines("E-mail", <input type="email" className="e2e-input" value={d.email} onChange={(e) => set("email", e.target.value)} />, "l-e")}
        {lines("Voornaam *", <input className="e2e-input" value={d.first_name || ""} maxLength={60} onChange={(e) => set("first_name", e.target.value)} />, "l-fn")}
        {lines("Achternaam *", <input className="e2e-input" value={d.last_name || ""} maxLength={60} onChange={(e) => set("last_name", e.target.value)} />, "l-ln")}
        {lines("Functie", <input className="e2e-input" value={d.function || ""} onChange={(e) => set("function", e.target.value)} />, "l-f")}
        {lines("Telefoon", <PhoneInput value={d.phone || ""} onChange={(v) => set("phone", v)} />, "l-p")}
        {lines("Mobiel", <PhoneInput value={d.mobile || ""} onChange={(v) => set("mobile", v)} />, "l-m")}
        {lines("Rechten", <><select className="e2e-input" value={d.access} onChange={(e) => set("access", e.target.value)}>{ACCESS.map(([k, label]) => <option key={k} value={k}>{tx(label)}</option>)}</select><span className="e2e-hint">{tx(ACCESS_HINT[d.access])}</span></>, "l-a")}
        {lines("Codecontrole bij inloggen (OTP)", <><select className="e2e-input" value={d.otp} onChange={(e) => set("otp", e.target.value)}><option value="email">{tx("Code per e-mail")}</option><option value="sms">{tx("Code per sms")}</option><option value="">{tx("Geen codecontrole")}</option></select><span className="e2e-hint">{tx("De code wordt gevraagd bij elke login. Dit werkt als de tweestapsverificatie van de website aan staat.")}</span></>, "l-o")}
      </div>
      <div className="e2e-stack" style={{ gap: ".4rem" }}>
        <strong>{tx("Waar mag deze persoon inloggen?")}</strong>
        <label className="e2e-switch" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: ".5rem" }}><input type="checkbox" checked={!!d.host} onChange={(e) => set("host", e.target.checked)} /> {tx("Op de easy2edit-site zelf (zonder extra rechten)")}</label>
        <label className="e2e-switch" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: ".5rem" }}><input type="checkbox" checked={!!d.all_sites} onChange={(e) => set("all_sites", e.target.checked)} /> {tx("Op alle websites van de reseller")}</label>
        {!d.all_sites && (sites.length === 0 ? <span className="e2e-hint">{tx("Er zijn nog geen websites aan deze reseller gekoppeld.")}</span> : sites.map((s) => (
          <label key={s.id} className="e2e-switch" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: ".5rem", marginLeft: "1.2rem" }}><input type="checkbox" checked={picked.has(s.id)} onChange={(e) => set("site_ids", e.target.checked ? [...picked, s.id] : [...picked].filter((x) => x !== s.id))} /> {s.name || s.url}</label>
        )))}
      </div>
      {isNew && (
        <div className="e2e-stack" style={{ gap: ".5rem" }}>
          {lines("Wachtwoord (leeg = laten maken)", <input className="e2e-input" autoComplete="new-password" value={d.password} onChange={(e) => set("password", e.target.value)} />, "l-w")}
          <label className="e2e-switch" style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: ".5rem" }}><input type="checkbox" checked={d.send} onChange={(e) => set("send", e.target.checked)} /> {tx("Stuur een e-mail met het wachtwoord")}</label>
        </div>
      )}
      <div className="e2e-row" style={{ gap: ".5rem", flexWrap: "wrap", alignItems: "center" }}>
        {!isNew && <label className="e2e-switch" style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: ".4rem" }}><input type="checkbox" checked={!!d.active} onChange={(e) => set("active", e.target.checked)} /> {tx("actief")}</label>}
        <span style={{ flex: 1 }} />
        {!isNew && <button type="button" className="e2e-btn e2e-btn--outline e2e-btn--sm" onClick={() => onSave({ new_password: true, send: true })}>{tx("Nieuw wachtwoord mailen")}</button>}
        <button type="button" className="e2e-btn e2e-btn--sm" disabled={!dirty || (isNew && !String(d.email).trim())} onClick={() => onSave(body)}>{isNew ? tx("Login aanmaken") : tx("Bewaren")}</button>
      </div>
    </div>
  );
}

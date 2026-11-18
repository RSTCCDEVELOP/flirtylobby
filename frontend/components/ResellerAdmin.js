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
import { IconCheck, IconX } from "./Icons";
import PhoneInput from "./PhoneInput";
import SmallEditor from "./SmallEditor";

// Super admin+ -> Licence -> Resellers: the resellers of easy2edit (company, three contact persons, websites, more information, the share of RST for the use of easy2edit)
// and their logins (made in the websites of the customers, passed on through the API). The public page /resellers shows them (searchable).
const ROLES = [["sales", "Sales"], ["financial", "Financieel"], ["support", "Support"], ["other", "Overig"]];
const ADDR = [["street", "Straat"], ["house_number", "Huisnummer"], ["postal_code", "Postcode"], ["city", "Plaats"], ["country", "Land"]];
const TABS = [["data", "Gegevens"], ["contact", "Contactpersonen"], ["margin", "Marge"], ["sites", "Websites"], ["logins", "Logins"]];
const ACCESS = [["user", "User"], ["admin", "Admin"], ["superadmin", "Superadmin"]];
const ACCESS_HINT = { user: "Gewone gebruiker, zonder extra rechten.", admin: "Beheerder: kan de website beheren (rol Admin).", superadmin: "Superadmin: alle rechten van een superadmin in de website van de klant." };
const EMPTY = { name: "", active: true, website: "", websites: [], info: "", address: {}, kvk: "", vat_id: "", contacts: {}, rst_share: "", notes: "" };
// how the share of a reseller compares to the standard of the price list: {kind: higher|lower|same, diff}
const compare = (own, def) => { const d = Math.round((Number(own) - Number(def)) * 100) / 100; return { kind: d > 0 ? "higher" : d < 0 ? "lower" : "same", diff: Math.abs(d) }; };
const ShareBadge = ({ own, def }) => { const c = compare(own, def); return <span className={`e2e-badge ${c.kind === "higher" ? "e2e-badge--success" : ""}`}>{c.kind === "same" ? tx("Gelijk aan de standaard") : c.kind === "higher" ? tx("Hoger dan de standaard ({0}%)", `+${c.diff}`) : tx("Lager dan de standaard ({0}%)", `-${c.diff}`)}</span>; };
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
  const [shownPw, setShownPw] = useState(null);
  const saved = !!r.id;
  const set = (k, v) => setR((x) => ({ ...x, [k]: v }));
  // contact persons: a list (more than one is possible); the address is the main address of the reseller unless the person has its own
  const people = Array.isArray(r.contacts) ? r.contacts : [];
  const setPeople = (list) => setR((x) => ({ ...x, contacts: list }));
  const person = (n, k, v) => setPeople(people.map((p, i) => (i === n ? { ...p, [k]: v } : p)));
  const addPerson = () => setPeople([...people, { id: `n${Date.now()}`, role: ["sales", "financial", "support"].find((k) => !people.some((p) => p.role === k)) || "other", name: "", function: "", email: "", phone: "", mobile: "", same_address: true, address: {} }]);
  const save = async () => {
    setBusy(true); setError(""); setErrs({}); setNote("");
    const body = { name: r.name, active: r.active, website: r.website, email: r.email, phone: r.phone, websites: r.websites, info: r.info, address: r.address, kvk: r.kvk, vat_id: r.vat_id, contacts: r.contacts, rst_share: Number(String(r.rst_share ?? "").replace(",", ".")) === Number(defShare) ? "" : (r.rst_share ?? ""), notes: r.notes };
    try { const x = saved ? await api(`/system/resellers/${r.id}/`, { method: "PUT", body }) : await api("/system/resellers/", { method: "POST", body }); setR(x); setNote(tx("Opgeslagen.")); }
    catch (e) { const er = e?.data?.errors || {}; setErrs(er); setError(Object.keys(er).length ? Object.values(er).map((m) => tx(m)).join(" ") : errorText(e)); if (er.name) setTab("data"); else if (Object.keys(er).some((k) => k.startsWith("contact_"))) setTab("contact"); else if (er.rst_share) setTab("margin"); }
    setBusy(false);
  };
  const setSites = async (ids) => { try { setR(await api(`/system/resellers/${r.id}/sites/`, { method: "PUT", body: { site_ids: ids } })); } catch (e) { setError(errorText(e)); } };
  const addLogin = async (body) => {  // -> true when it worked
    setError(""); setShownPw(null);
    try { const x = await api(`/system/resellers/${r.id}/logins/`, { method: "POST", body }); setShownPw({ email: x.login.email, password: x.password, sent: x.sent }); setR(await api(`/system/resellers/${r.id}/`)); return true; }
    catch (e) { setError(errorText(e)); return false; }
  };
  const patchLogin = async (l, body) => {
    setError(""); setShownPw(null);
    try { const x = await api(`/system/resellers/${r.id}/logins/${l.id}/`, { method: "PATCH", body }); if (x.password) setShownPw({ email: l.email, password: x.password, sent: x.sent }); setR(await api(`/system/resellers/${r.id}/`)); }
    catch (e) { setError(errorText(e)); }
  };
  const delLogin = async (l) => {
    if (!(await confirmDialog(tx("Login {0} verwijderen?", l.email), { okLabel: tx("Verwijderen"), cancelLabel: tx("Annuleren") }))) return;
    try { await api(`/system/resellers/${r.id}/logins/${l.id}/`, { method: "DELETE" }); setR(await api(`/system/resellers/${r.id}/`)); } catch (e) { setError(errorText(e)); }
  };
  // the standard is not stored (empty): it follows the price list
  const share = r.rst_share === "" || r.rst_share == null ? Number(defShare) : Number(String(r.rst_share).replace(",", ".")) || 0;
  const lines = (label, v, k) => <div className="e2e-field" key={k}><label className="e2e-label" htmlFor={`rs-${k}`}><span>{tx(label)}</span></label>{v}</div>;
  const inp = (k, label, extra = {}) => lines(label, <input id={`rs-${k}`} className="e2e-input" value={r[k] || ""} onChange={(e) => set(k, e.target.value)} {...extra} />, k);
  const mineSites = sites.filter((s) => !s.reseller || s.reseller === r.id);
  const picked = new Set((r.sites || []).map((s) => s.id));
  return createPortal(
    <div className="overlay" style={{ zIndex: 3050 }} onClick={onClose}>
      <div className="card modal wide" role="dialog" aria-label={tx("Reseller")} style={{ width: "min(900px, 96vw)", maxWidth: "96vw", maxHeight: "92vh", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
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
            <div className="sw-body" style={{ padding: "1.3rem 1.6rem" }}>
              {tab === "data" && (
                <div className="e2e-grid" style={{ "--e2e-min": "230px" }}>
                  <div className="e2e-field" style={{ gridColumn: "1 / -1" }}><label className="e2e-label" htmlFor="rs-name"><span>{tx("Naam van de reseller")} <span style={{ color: "var(--e2e-danger)" }}>*</span></span></label>
                    <input id="rs-name" className={`e2e-input${errs.name ? " e2e-input--error" : ""}`} value={r.name} onChange={(e) => set("name", e.target.value)} />{errs.name && <span className="e2e-error">{tx(errs.name)}</span>}</div>
                  {inp("website", "Website", { placeholder: "https://www.voorbeeld.nl" })}
                  <div className="e2e-field"><label className="e2e-label" htmlFor="rs-email"><span>{tx("E-mail")}</span></label><input id="rs-email" type="email" className={`e2e-input${errs.email ? " e2e-input--error" : ""}`} value={r.email || ""} onChange={(e) => set("email", e.target.value)} />{errs.email && <span className="e2e-error">{tx(errs.email)}</span>}</div>
                  <div className="e2e-field"><label className="e2e-label" htmlFor="rs-phone"><span>{tx("Telefoon")}</span></label><PhoneInput id="rs-phone" value={r.phone || ""} onChange={(v) => set("phone", v)} /></div>
                  {inp("kvk", "KvK-nummer")}
                  {inp("vat_id", "BTW-nummer")}
                  {ADDR.map(([k, label]) => lines(label, <input id={`rs-a-${k}`} className="e2e-input" value={r.address?.[k] || ""} onChange={(e) => set("address", { ...(r.address || {}), [k]: e.target.value })} />, `a-${k}`))}
                  <div className="e2e-field" style={{ gridColumn: "1 / -1" }}><label className="e2e-label"><span>{tx("Meer informatie (openbaar)")}</span></label><SmallEditor value={r.info} onChange={(v) => set("info", v)} minHeight={110} /></div>
                  <div className="e2e-field" style={{ gridColumn: "1 / -1" }}><label className="e2e-label" htmlFor="rs-notes"><span>{tx("Interne notitie")}</span></label><textarea id="rs-notes" className="e2e-input" rows={3} value={r.notes || ""} onChange={(e) => set("notes", e.target.value)} /><span className="e2e-hint">{tx("Alleen zichtbaar voor een superadmin+.")}</span></div>
                  <label className="e2e-switch" style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: ".5rem" }}><input type="checkbox" checked={!!r.active} onChange={(e) => set("active", e.target.checked)} /> {tx("Actief: tonen op de pagina Resellers")}</label>
                </div>
              )}
              {tab === "contact" && (
                <div className="e2e-grid" style={{ "--e2e-min": "380px", gap: "1rem", alignItems: "start" }}>
                  {people.map((p, n) => (
                    <div key={p.id || n} data-easy2edit-tag="ui-kpi" className="e2e-stack" style={{ gap: ".7rem", padding: "1rem 1.1rem", border: "1px solid var(--line)", borderRadius: "var(--radius, 12px)", background: "var(--card)" }}>
                      <div className="e2e-row" style={{ gap: ".5rem", alignItems: "center", justifyContent: "space-between" }}>
                        <select className="e2e-input" style={{ width: "auto" }} value={p.role} aria-label={tx("Rol")} onChange={(e) => person(n, "role", e.target.value)}>{ROLES.map(([k, label]) => <option key={k} value={k}>{tx(label)}</option>)}</select>
                        <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Persoon verwijderen")} title={tx("Persoon verwijderen")} onClick={() => setPeople(people.filter((_, i) => i !== n))}><IconX width={14} height={14} /></button>
                      </div>
                      <div className="e2e-grid" style={{ "--e2e-min": "150px" }}>
                        {lines("Naam", <input className="e2e-input" value={p.name || ""} onChange={(e) => person(n, "name", e.target.value)} />, `p${n}-n`)}
                        {lines("Functie", <input className="e2e-input" value={p.function || ""} onChange={(e) => person(n, "function", e.target.value)} />, `p${n}-f`)}
                        {lines("E-mail", <><input type="email" className={`e2e-input${errs[`contact_${n}`] ? " e2e-input--error" : ""}`} value={p.email || ""} onChange={(e) => person(n, "email", e.target.value)} />{errs[`contact_${n}`] && <span className="e2e-error">{tx(errs[`contact_${n}`])}</span>}</>, `p${n}-e`)}
                        {lines("Telefoon", <PhoneInput value={p.phone || ""} onChange={(v) => person(n, "phone", v)} />, `p${n}-p`)}
                        {lines("Mobiel", <PhoneInput value={p.mobile || ""} onChange={(v) => person(n, "mobile", v)} />, `p${n}-m`)}
                      </div>
                      <label className="e2e-switch" style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: ".5rem" }}><input type="checkbox" checked={p.same_address !== false} onChange={(e) => setPeople(people.map((x, i) => (i === n ? { ...x, same_address: e.target.checked, address: e.target.checked || Object.values(x.address || {}).some(Boolean) ? x.address : { ...(r.address || {}) } } : x)))} /> {tx("Zelfde adres als het hoofdadres")}</label>
                      {p.same_address === false && (
                        <div className="e2e-grid" style={{ "--e2e-min": "130px" }}>
                          {ADDR.map(([k, label]) => lines(label, <input className="e2e-input" value={p.address?.[k] || ""} onChange={(e) => person(n, "address", { ...(p.address || {}), [k]: e.target.value })} />, `p${n}-a-${k}`))}
                        </div>
                      )}
                    </div>
                  ))}
                  <button type="button" className="e2e-btn e2e-btn--outline" onClick={addPerson} style={{ minHeight: 120, borderStyle: "dashed", fontSize: "1.05rem" }}>+ {tx("Persoon toevoegen")}</button>
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
                  <div className="e2e-stack" style={{ gap: ".6rem" }}>
                    <strong>{tx("easy2edit-websites van klanten")}</strong>
                    <span className="e2e-hint">{tx("De logins van deze reseller worden aangemaakt in de websites die je hier aanvinkt.")}</span>
                    {mineSites.length === 0 ? <span className="e2e-hint">{tx("Er zijn nog geen websites aangemeld bij de Site manager.")}</span> : mineSites.map((s) => (
                      <label key={s.id} className="e2e-switch" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: ".5rem" }}><input type="checkbox" checked={picked.has(s.id)} onChange={(e) => setSites(e.target.checked ? [...picked, s.id] : [...picked].filter((x) => x !== s.id))} /> {s.name || s.url} <span className="e2e-hint">{s.url}</span></label>
                    ))}
                  </div>
                </div>
              ))}
              {tab === "logins" && (!saved ? <span className="e2e-hint">{tx("Bewaar de reseller eerst.")}</span> : (
                <div className="e2e-stack" style={{ gap: "1.1rem" }}>
                  <p style={{ margin: 0 }}>{tx("Met een login kan de reseller inloggen op de easy2edit van de klant. De logins worden via de API doorgegeven aan de websites van de klanten (zie Websites).")}</p>
                  {shownPw && <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon"><IconCheck width={14} height={14} /></span><div><strong>{shownPw.email}</strong><br />{tx("Wachtwoord")}: <code style={{ userSelect: "all" }}>{shownPw.password}</code><br /><span className="e2e-hint">{shownPw.sent ? tx("Het wachtwoord is per e-mail verstuurd.") : tx("Het wachtwoord wordt maar één keer getoond.")}</span></div></div>}
                  <div className="e2e-grid" style={{ "--e2e-min": "400px", gap: "1rem", alignItems: "start" }}>
                    {(r.logins || []).map((l) => <LoginTile key={l.id} l={l} sites={r.sites || []} lines={lines} onSave={(body) => patchLogin(l, body)} onRemove={() => delLogin(l)} />)}
                    {adding
                      ? <LoginTile isNew l={{ email: "", name: "", function: "", phone: "", mobile: "", access: "admin", otp: "email", all_sites: true, site_ids: [], host: true, active: true }} sites={r.sites || []} lines={lines} onSave={async (body) => { if (await addLogin(body)) setAdding(false); }} onRemove={() => setAdding(false)} />
                      : <button type="button" className="e2e-btn e2e-btn--outline" onClick={() => setAdding(true)} style={{ minHeight: 120, borderStyle: "dashed", fontSize: "1.05rem" }}>+ {tx("Login toevoegen")}</button>}
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
    </div>, document.body);
}

// One login as a tile (also the new one): all data, the rights in the websites, the code check (OTP) at login and where the person may log in.
function LoginTile({ l, isNew = false, sites, lines, onSave, onRemove }) {
  const [d, setD] = useState({ ...l, password: "", send: true });
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const picked = new Set(d.site_ids || []);
  const body = { name: d.name, function: d.function, phone: d.phone, mobile: d.mobile, access: d.access, otp: d.otp, all_sites: d.all_sites, site_ids: d.site_ids, host: d.host, active: d.active, ...(isNew ? { email: d.email, password: d.password, send: d.send } : {}) };
  const dirty = isNew || ["name", "function", "phone", "mobile", "access", "otp", "all_sites", "host", "active"].some((k) => d[k] !== l[k]) || JSON.stringify(d.site_ids || []) !== JSON.stringify(l.site_ids || []);
  return (
    <div data-easy2edit-tag="ui-kpi" className="e2e-stack" style={{ gap: ".7rem", padding: "1rem 1.1rem", border: "1px solid var(--line)", borderRadius: "var(--radius, 12px)", background: "var(--card)", opacity: d.active ? 1 : 0.7 }}>
      <div className="e2e-row" style={{ gap: ".5rem", alignItems: "center", justifyContent: "space-between" }}>
        {isNew ? <strong>{tx("Login toevoegen")}</strong> : <strong style={{ overflowWrap: "anywhere" }}>{l.email}</strong>}
        <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx(isNew ? "Annuleren" : "Verwijderen")} title={tx(isNew ? "Annuleren" : "Verwijderen")} onClick={onRemove}><IconX width={14} height={14} /></button>
      </div>
      <div className="e2e-grid" style={{ "--e2e-min": "150px" }}>
        {isNew && lines("E-mail", <input type="email" className="e2e-input" value={d.email} onChange={(e) => set("email", e.target.value)} />, "l-e")}
        {lines("Naam", <input className="e2e-input" value={d.name || ""} onChange={(e) => set("name", e.target.value)} />, "l-n")}
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

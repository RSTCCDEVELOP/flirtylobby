"use client";

import { Busy } from "../../../../components/PageLoader";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import { useModules } from "../../../../components/Modules";
import Link from "next/link";
import FaqPage from "../../../../components/FaqPage";
import Tabs from "../../../../components/Tabs";
import { refreshFaqSettings } from "../../../../lib/faq-settings";
import Paged from "../../../../components/Paged";
import { api, errorText } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { lvl } from "../../../../lib/perms";
import { tx } from "../../../../lib/t";

// The website owner's own FAQ (page /faq): question and answer per language, in the order they are shown.
const Sw = ({ checked, onChange, disabled, label }) => (
  <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span>{label && <span>{label}</span>}</label>
);

function WebsiteFaq() {
  const { user } = useAuth();
  const mods = useModules();
  const L = lvl(user, "faq");
  const [items, setItems] = useState(null);
  const [langs, setLangs] = useState({ languages: [], default: "nl" });
  const [ai, setAi] = useState(false);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null); // {id?, question, answer, category}
  const [lang, setLang] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api("/faq/admin/").then((d) => setItems(d.items)).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); api("/languages/").then(setLangs).catch(() => {}); api("/pages/").then((d) => setAi(!!d.ai)).catch(() => {}); }, [load]);
  const edit = langs.languages.length ? langs.languages : [{ code: "nl", native_name: "Nederlands" }];
  const cur = edit.some((l) => l.code === lang) ? lang : langs.default;
  const title = (e) => e.question?.[langs.default] || Object.values(e.question || {})[0] || "";

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const { id, error, ...body } = modal;
    try {
      if (id) await api(`/faq/admin/${id}/`, { method: "PATCH", body }); else await api("/faq/admin/", { method: "POST", body });
      setModal(null); await load();
    } catch (err) { setModal({ ...modal, error: errorText(err) }); }
    setBusy(false);
  }
  async function translateAll() {
    setBusy(true);
    try {
      const d = langs.default;
      const r = await api("/faq/translate/", { method: "POST", body: { question: modal.question?.[d] || "", answer: modal.answer?.[d] || "", category: modal.category?.[d] || "" } });
      setModal({ ...modal, question: { ...modal.question, ...r.question }, answer: { ...modal.answer, ...r.answer }, category: { ...modal.category, ...r.category }, error: "" });
    } catch (err) { setModal({ ...modal, error: errorText(err) }); }
    setBusy(false);
  }
  const patch = async (e, body) => { try { await api(`/faq/admin/${e.id}/`, { method: "PATCH", body }); await load(); } catch (err) { setMsg({ ok: false, text: errorText(err) }); } };
  async function move(i, d) {
    const a = items[i], b = items[i + d];
    if (!b) return;
    await patch(a, { order: b.order === a.order ? a.order + d : b.order }); await patch(b, { order: a.order === b.order ? b.order - d : a.order });
    load();
  }
  async function remove(e) { if (await confirmDialog(tx("Deze vraag verwijderen?"), { danger: true })) { try { await api(`/faq/admin/${e.id}/`, { method: "DELETE" }); await load(); } catch (err) { setMsg({ ok: false, text: errorText(err) }); } } }

  if (mods.faq === false) return <p className="muted">{tx("Deze module staat uit. Een superadmin zet hem aan bij Super admin → Modules.")}</p>;
  if (!items) return msg ? <div className="alert">{msg.text}</div> : <Busy />;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("FAQ")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Je eigen veelgestelde vragen voor bezoekers, op de pagina /faq. Zet de pagina in het menu bij Pagina's. De uitleg van Easy2edit zelf staat apart bij Help in het dashboard.")}</p>
        </div>
        {L >= 2 && <button className="btn primary" onClick={() => setModal({ question: {}, answer: {}, category: {} })}>{tx("+ Nieuwe vraag")}</button>}
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
      <Paged id="faq-admin" selector=".plugin-items" defaultSize="25">
        <div className="plugin-items">
          {items.map((e, i) => (
            <div key={e.id} className="plugin-item">
              <span className="pi-main"><strong>{title(e)}</strong>{e.category?.[langs.default] && <small className="muted">{e.category[langs.default]}</small>}<span className="pi-desc">{(e.answer?.[langs.default] || "").slice(0, 140)}</span></span>
              <span className="pi-actions">
                <span className={`badge ${e.active ? "ok" : "off"}`}>{e.active ? tx("Aan") : tx("Uit")}</span>
                {L >= 2 && <>
                  <button type="button" className="btn sm" disabled={i === 0} onClick={() => move(i, -1)} title={tx("Omhoog")}>↑</button>
                  <button type="button" className="btn sm" disabled={i === items.length - 1} onClick={() => move(i, 1)} title={tx("Omlaag")}>↓</button>
                  <Sw checked={e.active} onChange={(v) => patch(e, { active: v })} />
                  <button type="button" className="btn sm" onClick={() => setModal({ ...e })}>{tx("Wijzig")}</button>
                  <button type="button" className="btn sm danger" onClick={() => remove(e)}>{tx("Verwijder")}</button>
                </>}
              </span>
            </div>
          ))}
          {!items.length && <p className="muted">{tx("Nog geen vragen. Maak de eerste met + Nieuwe vraag.")}</p>}
        </div>
      </Paged>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form" style={{ maxWidth: 640 }} onClick={(ev) => ev.stopPropagation()} onSubmit={save}>
            <h2>{modal.id ? tx("Vraag wijzigen") : tx("Nieuwe vraag")}</h2>
            <Tabs className="lang-tabs" value={cur} onChange={setLang} tabs={edit.map((l) => [l.code, l.native_name || l.code, null, modal.question?.[l.code] ? "✓" : null])} />
            {edit.filter((l) => l.code === cur).map((l) => (
              <div key={l.code} className="form">
                <label>{tx("Vraag")}<input value={modal.question?.[l.code] || ""} maxLength={300} required={l.code === langs.default} onChange={(ev) => setModal({ ...modal, question: { ...modal.question, [l.code]: ev.target.value } })} /></label>
                <label>{tx("Antwoord")}<textarea rows={6} value={modal.answer?.[l.code] || ""} maxLength={4000} required={l.code === langs.default} onChange={(ev) => setModal({ ...modal, answer: { ...modal.answer, [l.code]: ev.target.value } })} /></label>
                <label>{tx("Rubriek (optioneel)")}<input value={modal.category?.[l.code] || ""} maxLength={80} onChange={(ev) => setModal({ ...modal, category: { ...modal.category, [l.code]: ev.target.value } })} /></label>
              </div>
            ))}
            {ai ? <button type="button" className="btn sm" disabled={busy || !modal.question?.[langs.default] || !modal.answer?.[langs.default]} onClick={translateAll} style={{ alignSelf: "flex-start" }}>{tx("Vertaal naar alle talen met Claude")}</button>
              : <small className="muted">{tx("Claude is niet gekoppeld: vul elke taal zelf in. Koppelen kan bij Admin → API keys.")}</small>}
            {modal.error && <div className="alert">{modal.error}</div>}
            <div className="row"><button type="button" className="btn" onClick={() => setModal(null)}>{tx("Annuleren")}</button><button className="btn primary" disabled={busy}>{busy ? tx("Bezig…") : tx("Opslaan")}</button></div>
          </form>
        </div>
      )}
    </>
  );
}

function AdminHelp() {
  return (
    <>
      <p className="muted">{tx("De uitleg van Easy2edit zelf voor beheerders, in alle talen. Hij toont alleen wat aan staat en waar jij rechten voor hebt. De uitleg die in de bewerkmodus bij de iconen verschijnt wijzig je bij Help-teksten.")} <Link href="/dashboard/admin/helptips" style={{ color: "var(--blue)" }}>{tx("Naar Help-teksten")}</Link></p>
      <FaqPage layer="admin" withTitle={false} single />
    </>
  );
}

const SwHint = ({ checked, onChange, disabled, label, hint }) => (
  <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span><span>{label}{hint && <small className="muted"> {hint}</small>}</span></label>
);

// Where the FAQ can be seen: the link in the left menus, the icon in the header, the page itself (public or private)
function FaqSettings({ canEdit }) {
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api("/faq/settings/").then(setCfg).catch((e) => setMsg(errorText(e))); }, []);
  async function save(patch) {
    const next = { ...cfg, ...patch };
    setCfg(next);
    try { setCfg(await api("/faq/settings/", { method: "PUT", body: next })); refreshFaqSettings(); setMsg(null); } catch (e) { setMsg(errorText(e)); }
  }
  if (!cfg) return msg ? <div className="alert">{msg}</div> : <Busy />;
  return (
    <div className="form" style={{ maxWidth: 720 }}>
      {msg && <div className="alert">{msg}</div>}
      <p className="muted" style={{ margin: 0 }}>{tx("Kies waar de FAQ te zien is. Wijzigingen worden direct opgeslagen.")}</p>
      <div className="card form">
        <strong>{tx("Menu-item links")}</strong>
        <SwHint label={tx("Help- en FAQ-link in het linker menu")} hint={tx("In het gebruikersmenu, het Admin-menu en het Super admin-menu.")} checked={cfg.nav_link} disabled={!canEdit} onChange={(v) => save({ nav_link: v })} />
      </div>
      <div className="card form">
        <strong>{tx("Icoon in de header")}</strong>
        <SwHint label={tx("FAQ-icoon bovenin de header")} hint={tx("Opent de FAQ naast de pagina waar je bent; je blijft op die pagina.")} checked={cfg.header_icon} disabled={!canEdit} onChange={(v) => save({ header_icon: v })} />
      </div>
      <div className="card form">
        <strong>{tx("FAQ als pagina")}</strong>
        <div className="loader-tiles" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {[["public", "Publiek", "Iedereen ziet de FAQ op /faq."], ["private", "Privé", "Alleen ingelogde gebruikers, op /dashboard/faq."]].map(([k, l, h]) => (
            <button key={k} type="button" className={`loader-tile${cfg.page_scope === k ? " on" : ""}`} disabled={!canEdit} onClick={() => save({ page_scope: k })} aria-pressed={cfg.page_scope === k} style={{ alignItems: "flex-start", textAlign: "left" }}>
              <strong>{tx(l)}</strong><small className="muted">{tx(h)}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FaqAdmin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("website");
  const L = lvl(user, "faq");
  return (
    <>
      <Tabs value={tab} onChange={setTab} tabs={[["website", "Website"], ["admin", "Admin"], ["settings", "Instellingen"]]} />
      <div style={{ marginTop: "1rem" }}>
        {tab === "website" && <WebsiteFaq />}
        {tab === "admin" && <AdminHelp />}
        {tab === "settings" && <FaqSettings canEdit={L >= 3} />}
      </div>
    </>
  );
}

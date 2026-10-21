"use client";

import { tx } from "../lib/t";
import { useEffect, useState } from "react";
import { api, errorText, mediaUrl } from "../lib/api";
import { IconImage, IconSearch, IconSliders, IconUser } from "./Icons";
import LayoutPresets from "./LayoutPresets";
import MediaPicker from "./MediaPicker";
import Tabs from "./Tabs";
import { translateName } from "../lib/translate-name";
import { alertDialog, confirmDialog } from "../lib/dialog";

const AUDIENCE = { all: "Iedereen", members: "Alleen ingelogde users", guests: "Alleen bezoekers (niet ingelogd)" };
const BG = [["none", "Geen"], ["image", "Afbeelding"], ["video", "Video"]];
const emptySeo = { title: "", description: "", og_media: null, og_image: null, noindex: false, canonical: "" };

// Pop-up with the basics of one page: name, audience, SEO per language and a background (picture or video) from the media library.
export default function PageSettingsModal({ ai, page, languages, defaultLang, onClose, onSaved, canSeo }) {
  const langs = languages.length ? languages : [{ code: "nl", native_name: "Nederlands" }];
  const [tab, setTab] = useState("general");
  const [form, setForm] = useState({ slugs: { ...(page.slugs || {}) }, title: { ...page.title }, audience: page.audience, new_tab: !!page.new_tab, url: page.url || "" });
  const [setup, setSetup] = useState({ theme: page.setup?.theme || "", header: page.setup?.header || "", footer: page.setup?.footer || "" }); // this page only: its own theme, header and footer
  const [themes, setThemes] = useState([]);
  const [defaults, setDefaults] = useState({ page_header: "show", page_footer: "show" });
  const [mo, setMo] = useState({ devices: { desktop: page.devices?.desktop !== false, tablet: page.devices?.tablet !== false, mobile: page.devices?.mobile !== false }, cta: !!page.cta, label_link: !!page.label_link }); // the item in the header menu
  const [bg, setBg] = useState(page.background?.type ? { ...page.background } : { type: "none", overlay: 0.35 });
  const [nameLang, setNameLang] = useState(defaultLang || langs[0].code); // the language tab of the name
  const [seoLang, setSeoLang] = useState(defaultLang || langs[0].code);
  const [seo, setSeo] = useState({}); // lang -> fields
  const [seoIds, setSeoIds] = useState({}); // lang -> id of an existing record
  const [seoStart, setSeoStart] = useState("{}");
  const [seoNote, setSeoNote] = useState("");
  const [picker, setPicker] = useState(null); // "bg" | "og"
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hasPath = page.path?.startsWith("/");
  const canSetup = (page.kind === "content" || page.kind === "system") && page.scope !== "private";
  useEffect(() => {
    if (!canSetup) return;
    api("/theme/packs/").then((d) => setThemes((d.packs || []).filter((x) => x.builtin || x.enabled).map((x) => ({ key: x.key, name: x.name })))).catch(() => {});
    api("/theme/").then((d) => setDefaults({ page_header: d.values?.page_header || "show", page_footer: d.values?.page_footer || "show" })).catch(() => {});
  }, [canSetup]);
  const [trProg, setTrProg] = useState(null); // {done, total} while Claude translates the name
  const [allProg, setAllProg] = useState(null); // {done, total} while Claude makes every text and the SEO of this page in every language
  async function translateEverything() {
    if (!(await confirmDialog(tx("Claude maakt alle teksten van deze pagina en de SEO-titel en -omschrijving in alle talen (ook de talen die uit staan). Wat er al staat in die talen wordt bijgewerkt. Doorgaan?"), { okLabel: tx("Maken en bijwerken"), cancelLabel: tx("Annuleren") }))) return;
    setBusy(true); setError("");
    const sum = { texts: 0, seo: 0, names: 0, failed: [] };
    try {
      const { languages } = await api(`/pages/${page.id}/translate-all/`, { method: "POST", body: { list: true } });
      setAllProg({ done: 0, total: languages.length });
      let next = 0, done = 0;
      const worker = async () => {
        while (next < languages.length) {
          const l = languages[next++];
          try { const r = await api(`/pages/${page.id}/translate-all/`, { method: "POST", body: { lang: l.code } }); sum.texts += r.texts; sum.seo += r.seo ? 1 : 0; sum.names += r.title ? 1 : 0; } catch (e) { sum.failed.push(`${l.code}: ${errorText(e)}`); }
          setAllProg({ done: ++done, total: languages.length });
        }
      };
      await Promise.all([worker(), worker()]);
      setAllProg(null); setBusy(false);
      await alertDialog(`${tx("Klaar")}\n${tx("{0} teksten, {1} namen en {2} SEO-items gemaakt of bijgewerkt.", sum.texts, sum.names, sum.seo)}${sum.failed.length ? `\n\n${tx("Mislukt")}:\n${sum.failed.slice(0, 8).join("\n")}` : ""}`);
      onSaved();
    } catch (err) { setError(errorText(err)); setAllProg(null); setBusy(false); }
  }
  async function translateAll() { // the name in EVERY language (also the ones that are off) from the default one
    const text = (form.title?.[defaultLang] || "").trim();
    if (!text) return;
    setBusy(true); setError("");
    try {
      const { titles, failed } = await translateName(text, defaultLang, setTrProg);
      setForm((f) => ({ ...f, title: { ...f.title, ...titles } }));
      if (failed) setError(tx("{0} talen konden niet worden vertaald; die nemen de hoofdtaal over.", failed));
    } catch (err) { setError(errorText(err)); }
    setTrProg(null); setBusy(false);
  }
  const [acc, setAcc] = useState({ users: [...(page.access?.users || [])], groups: [...(page.access?.groups || [])] }); // who may open the page; both empty = everybody
  const [pick, setPick] = useState({ type: "all", id: "" });
  const [people, setPeople] = useState({ users: [], groups: [] });
  useEffect(() => {
    if (page.kind === "system") return;
    api("/users/").then((u) => setPeople((x) => ({ ...x, users: u }))).catch(() => {});
    api("/user-groups/").then((g) => setPeople((x) => ({ ...x, groups: g }))).catch(() => {});
  }, [page.kind]);
  const userName = (u) => [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
  const options = pick.type === "user" ? people.users.filter((u) => !acc.users.some((x) => x.id === u.id)).map((u) => ({ id: u.id, label: `${userName(u)} (${u.email})` }))
    : pick.type === "group" ? people.groups.filter((g) => !acc.groups.some((x) => x.id === g.id)).map((g) => ({ id: g.id, label: g.name })) : [];
  function addAccess() {
    if (pick.type === "all") { setAcc({ users: [], groups: [] }); return; }
    if (!pick.id) return;
    const id = Number(pick.id), o = options.find((x) => x.id === id);
    setAcc(pick.type === "user" ? { ...acc, users: [...acc.users, { id, name: o?.label || String(id) }] } : { ...acc, groups: [...acc.groups, { id, name: o?.label || String(id) }] });
    setPick({ ...pick, id: "" });
  }

  useEffect(() => {
    if (!canSeo || !hasPath) return;
    api("/seo/pages/").then((rows) => {
      const s = {}, ids = {};
      rows.filter((r) => r.path === page.path).forEach((r) => { s[r.lang] = { title: r.title, description: r.description, og_media: r.og_media, og_image: r.og_image, noindex: r.noindex, canonical: r.canonical }; ids[r.lang] = r.id; });
      setSeo(s); setSeoIds(ids); setSeoStart(JSON.stringify(s));
    }).catch(() => setSeoNote(tx("SEO-instellingen zijn niet beschikbaar (module uit of geen rechten).")));
  }, [canSeo, hasPath, page.path]);

  const cur = { ...emptySeo, ...(seo[seoLang] || {}) };
  const setCur = (patch) => setSeo({ ...seo, [seoLang]: { ...cur, ...patch } });
  const isEmpty = (s) => !s || (!s.title && !s.description && !s.og_media && !s.noindex && !s.canonical);

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const body = { title: form.title, background: bg.type === "none" || !bg.media ? {} : { type: bg.type, media: bg.media, overlay: bg.overlay } };
      if (canSetup) body.setup = setup;
      if (page.kind !== "system") { body.audience = form.audience; body.new_tab = form.new_tab; body.access = { users: acc.users.map((x) => x.id), groups: acc.groups.map((x) => x.id) }; }
      body.devices = mo.devices; body.cta = mo.cta; if (page.kind === "menu") body.label_link = mo.label_link;
      if (page.kind === "link") body.url = form.url;
      if (page.has_slugs) body.slugs = Object.fromEntries(langs.map((l) => [l.code, form.slugs?.[l.code] || ""])); // only the languages that are on are shown; the others get an address by themselves
      await api(`/pages/${page.id}/`, { method: "PATCH", body });
      if (canSeo && hasPath && !seoNote) {
        const start = JSON.parse(seoStart);
        for (const l of langs) {
          const now = seo[l.code], before = start[l.code];
          if (JSON.stringify(now || null) === JSON.stringify(before || null)) continue;
          if (isEmpty(now)) { if (seoIds[l.code]) await api(`/seo/pages/?id=${seoIds[l.code]}`, { method: "DELETE" }); continue; }
          await api("/seo/pages/", { method: "PUT", body: { path: page.path, lang: l.code, title: now.title, description: now.description, noindex: now.noindex, canonical: now.canonical, og_media: now.og_media } });
        }
      }
      onSaved();
    } catch (err) { setError(errorText(err)); setBusy(false); }
  }

  const tabs = [["general", "Algemeen", <IconSliders key="g" />], ...(page.has_slugs ? [["slugs", "Adres", <IconSearch key="a" />]] : []), ["menu", "Menu", <IconSliders key="m" />], ...(canSetup ? [["setup", "Pagina-opzet", <IconSliders key="o" />]] : []), ...(page.kind !== "system" ? [["security", "Beveiliging", <IconUser key="u" />]] : []), ["seo", "SEO", <IconSearch key="s" />], ["background", "Achtergrond", <IconImage key="b" />], ...(page.kind === "content" ? [["layout", "Opmaak", <IconSliders key="l" />]] : [])];
  return (
    <div className="overlay" onClick={onClose}>
      <form className="card modal pgs form" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2 style={{ margin: 0 }}>{tx("Pagina-instellingen")}: {form.title[defaultLang] || page.key}</h2>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />

        <div className="pgs-body">
          {tab === "general" && (
            <>
              <strong style={{ fontSize: ".85rem" }}>{tx("Naam")}</strong>
              {ai && (
                <>
                  <button type="button" className="btn sm" style={{ justifySelf: "start" }} disabled={busy || !form.title?.[defaultLang]?.trim()} onClick={translateAll}>{tx("Vertaal naar alle talen")}</button>
                  {trProg && (
                    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={trProg.total} aria-valuenow={trProg.done}>
                      <div className="progress-top"><span>{tx("Vertalen…")}</span><strong>{trProg.done} / {trProg.total}</strong></div>
                      <div className="progress-track"><i style={{ width: `${Math.round((trProg.done / Math.max(1, trProg.total)) * 100)}%` }} /></div>
                    </div>
                  )}
                </>
              )}
              <Tabs className="lang-tabs" value={nameLang} onChange={setNameLang} tabs={langs.map((l) => [l.code, l.native_name, null, form.title?.[l.code] ? "✓" : null])} />
              {langs.filter((l) => l.code === nameLang).map((l) => (
                <label key={l.code}>{l.native_name}
                  <input value={form.title?.[l.code] || ""} maxLength={80} required={l.code === defaultLang} onChange={(e) => setForm({ ...form, title: { ...form.title, [l.code]: e.target.value } })} />
                </label>
              ))}
              {page.kind === "link" && <label>{tx("Link")}<input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://… of /pad" required /></label>}
              {page.kind !== "system" && (
                <div className="theme-grid">
                  <label className="check sec-toggle">
                    <span className="switch"><input type="checkbox" checked={form.new_tab} onChange={(e) => setForm({ ...form, new_tab: e.target.checked })} /><span /></span>
                    <span>{tx("Opent in een nieuw tabblad")}</span>
                  </label>
                </div>
              )}
              <small className="muted">{tx("Adres")}: <code>{page.path}</code></small>
              {ai && (page.kind === "content" || page.kind === "system") && (
                <div className="card" style={{ display: "grid", gap: ".4rem" }}>
                  <strong style={{ fontSize: ".85rem" }}>{tx("Alle talen")}</strong>
                  <small className="muted">{tx("Maak alle teksten van deze pagina, de naam en de SEO-titel en -omschrijving in alle talen met Claude, of werk ze bij.")}</small>
                  <div><button type="button" className="btn primary sm" disabled={busy} onClick={translateEverything}>{tx("Teksten en SEO in alle talen maken of bijwerken")}</button></div>
                  {allProg && (
                    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={allProg.total} aria-valuenow={allProg.done}>
                      <div className="progress-top"><span>{tx("Bezig…")}</span><strong>{allProg.done} / {allProg.total}</strong></div>
                      <div className="progress-track"><i style={{ width: `${Math.round((allProg.done / Math.max(1, allProg.total)) * 100)}%` }} /></div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === "setup" && canSetup && (
            <>
              <p className="muted" style={{ margin: 0 }}>{tx("De opzet van alleen deze pagina: een eigen thema en de header en footer aan of uit. Wat je leeg laat volgt het thema van de website; die standaard stel je in bij Thema → Layout.")}</p>
              <label>{tx("Thema van deze pagina")}
                <select value={setup.theme} onChange={(e) => setSetup({ ...setup, theme: e.target.value })}>
                  <option value="">{tx("Zoals de website")}</option>
                  {themes.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
                </select>
              </label>
              <div className="theme-grid">
                <label>{tx("Header")}
                  <select value={setup.header} onChange={(e) => setSetup({ ...setup, header: e.target.value })}>
                    <option value="">{tx("Standaard van het thema")} ({defaults.page_header === "hide" ? tx("verborgen") : tx("getoond")})</option><option value="show">{tx("Tonen")}</option><option value="hide">{tx("Verbergen")}</option>
                  </select>
                </label>
                <label>{tx("Footer")}
                  <select value={setup.footer} onChange={(e) => setSetup({ ...setup, footer: e.target.value })}>
                    <option value="">{tx("Standaard van het thema")} ({defaults.page_footer === "hide" ? tx("verborgen") : tx("getoond")})</option><option value="show">{tx("Tonen")}</option><option value="hide">{tx("Verbergen")}</option>
                  </select>
                </label>
              </div>
              <small className="muted">{tx("Het thema van de pagina bepaalt de kleuren, lettertypen en vormen. De indeling van de header en de footer volgt het thema van de website.")}</small>
            </>
          )}

          {tab === "security" && page.kind !== "system" && (
            <>
              <p className="muted" style={{ margin: 0 }}>{tx("Wie de pagina mag openen. Standaard is de pagina openbaar: iedereen mag hem openen.")}</p>
              <label>{tx("Voor wie")}
                    <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>{Object.entries(AUDIENCE).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select>
                  </label>
                <div className="form" style={{ gap: ".4rem" }}>
                  <strong style={{ fontSize: ".85rem" }}>{tx("Rechten")}</strong>
                  <div className="chips" style={{ marginBottom: 0 }}>
                    {!acc.users.length && !acc.groups.length && <span className="chip" style={{ cursor: "default" }}>{tx("Iedereen")}</span>}
                    {acc.groups.map((g) => <span key={`g${g.id}`} className="chip" style={{ cursor: "default" }}><b>{tx("Groep")}</b> {g.name}<button type="button" className="icon-btn" aria-label={tx("Verwijder")} title={tx("Verwijder")} onClick={() => setAcc({ ...acc, groups: acc.groups.filter((x) => x.id !== g.id) })}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button></span>)}
                    {acc.users.map((u) => <span key={`u${u.id}`} className="chip" style={{ cursor: "default" }}><b>{tx("User")}</b> {u.name}<button type="button" className="icon-btn" aria-label={tx("Verwijder")} title={tx("Verwijder")} onClick={() => setAcc({ ...acc, users: acc.users.filter((x) => x.id !== u.id) })}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button></span>)}
                  </div>
                  <div className="grant-add" style={{ flexWrap: "nowrap" }}>
                    <select value={pick.type} onChange={(e) => setPick({ type: e.target.value, id: "" })} style={{ flex: "0 0 auto" }}>
                      <option value="all">{tx("Iedereen")}</option><option value="user">{tx("User")}</option><option value="group">{tx("User group")}</option>
                    </select>
                    <select value={pick.id} disabled={pick.type === "all"} onChange={(e) => setPick({ ...pick, id: e.target.value })}>
                      <option value="">{pick.type === "group" ? tx("Kies een groep…") : pick.type === "user" ? tx("Kies een user…") : tx("Iedereen mag de pagina openen")}</option>
                      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    <button type="button" className="btn" style={{ whiteSpace: "nowrap" }} disabled={pick.type !== "all" && !pick.id} onClick={addAccess}>{pick.type === "all" ? tx("Iedereen") : tx("Toevoegen")}</button>
                  </div>
                  <small className="muted">{tx("Zonder users of groepen mag iedereen de pagina openen (zie Voor wie). Met een lijst alleen die users en de leden van die groepen, plus beheerders van de pagina's.")}</small>
                </div>
            </>
          )}

          {tab === "menu" && (
            <>
              <p className="muted" style={{ margin: 0 }}>{tx("Hoe dit item in het menu van de header staat. De vorm van het menu zelf stel je in bij Pagina's → Menu-editor → Instellingen.")}</p>
              <strong style={{ fontSize: ".85rem" }}>{tx("Zichtbaar op")}</strong>
              <div className="theme-grid">
                {[["desktop", "Computer"], ["tablet", "Tablet"], ["mobile", "Telefoon"]].map(([k, l]) => (
                  <label key={k} className="check sec-toggle">
                    <span className="switch"><input type="checkbox" checked={mo.devices[k]} onChange={(e) => setMo({ ...mo, devices: { ...mo.devices, [k]: e.target.checked } })} /><span /></span><span>{tx(l)}</span>
                  </label>
                ))}
              </div>
              <label className="check sec-toggle">
                <span className="switch"><input type="checkbox" checked={mo.cta} onChange={(e) => setMo({ ...mo, cta: e.target.checked })} /><span /></span>
                <span>{tx("Opvallend tonen als knop")} <small className="muted">{tx("bijvoorbeeld Aanmelden of Winkel")}</small></span>
              </label>
              {page.kind === "menu" && (
                <label className="check sec-toggle">
                  <span className="switch"><input type="checkbox" checked={mo.label_link} onChange={(e) => setMo({ ...mo, label_link: e.target.checked })} /><span /></span>
                  <span>{tx("De naam opent ook de overzichtspagina van dit item")} <small className="muted">{tx("anders is het alleen tekst met een submenu")}</small></span>
                </label>
              )}
            </>
          )}

          {tab === "slugs" && (
            <>
              <p className="muted" style={{ margin: 0 }}>{tx("Het adres van deze pagina in elke taal. Een bezoeker komt met elk adres op dezelfde pagina. Talen die uit staan krijgen vanzelf ook een adres, zodat het klaarstaat als je ze aanzet.")}</p>
              <div className="theme-grid">
                {langs.map((l) => (
                  <label key={l.code}>{l.native_name}
                    <span className="row" style={{ flexWrap: "nowrap", gap: ".3rem", justifyContent: "flex-start" }}>
                      <span className="muted">/</span>
                      <input value={form.slugs?.[l.code] || ""} maxLength={60} placeholder={form.title?.[l.code] ? form.title[l.code].toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : ""} onChange={(e) => setForm({ ...form, slugs: { ...form.slugs, [l.code]: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") } })} />
                    </span>
                  </label>
                ))}
              </div>
              <small className="muted">{tx("Alleen a-z, 0-9 en -. Leeg laten = het adres wordt gemaakt uit de naam van de pagina.")}</small>
            </>
          )}

          {tab === "seo" && (
            !hasPath ? <p className="muted">{tx("Een externe link heeft geen eigen SEO-instellingen.")}</p>
            : seoNote ? <p className="muted">{seoNote}</p>
            : (
              <>
                <div className="tabs tabset" style={{ marginTop: 0 }}>
                  {langs.map((l) => <button key={l.code} type="button" className={`btn sm ${seoLang === l.code ? "primary" : ""}`} onClick={() => setSeoLang(l.code)}>{l.native_name}</button>)}
                </div>
                <label>{tx("SEO-titel")} <small className="muted">{cur.title.length}/60</small>
                  <input value={cur.title} maxLength={200} onChange={(e) => setCur({ title: e.target.value })} placeholder={form.title?.[seoLang] || ""} />
                </label>
                <label>{tx("Omschrijving voor zoekmachines")} <small className="muted">{cur.description.length}/160</small>
                  <textarea rows={3} value={cur.description} maxLength={400} onChange={(e) => setCur({ description: e.target.value })} />
                </label>
                <div>
                  <strong style={{ fontSize: ".85rem" }}>{tx("Afbeelding bij delen (social media)")}</strong>
                  <div className="row" style={{ justifyContent: "flex-start", flexWrap: "nowrap", marginTop: ".4rem" }}>
                    {cur.og_image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(cur.og_image)} alt="" style={{ height: 64, borderRadius: 8 }} />}
                    <button type="button" className="btn" onClick={() => setPicker("og")}>{tx("Media")}</button>
                    {cur.og_media && <button type="button" className="btn danger" onClick={() => setCur({ og_media: null, og_image: null })}>{tx("Verwijderen")}</button>}
                  </div>
                </div>
                <div className="theme-grid">
                  <label>{tx("Canonical-adres")}<input value={cur.canonical} onChange={(e) => setCur({ canonical: e.target.value })} placeholder="https://…" /></label>
                  <label className="check sec-toggle">
                    <span className="switch"><input type="checkbox" checked={cur.noindex} onChange={(e) => setCur({ noindex: e.target.checked })} /><span /></span>
                    <span>{tx("Niet in zoekmachines tonen (noindex)")}</span>
                  </label>
                </div>
              </>
            )
          )}

          {tab === "layout" && page.kind === "content" && (
            <div className="form">
              <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{tx("Kies de indeling van de blokken op deze pagina. Teksten en afbeeldingen blijven staan; alleen het raster verandert. Je past losse blokken daarna aan in de bewerkmodus.")}</p>
              <LayoutPresets pageKey={page.key} standard={["community", "search", "payment", "members", "products", "product", "cart", "checkout", "subscriptions", "donations", "games"].includes(page.key)} />
            </div>
          )}
          {tab === "background" && (
            <>
              <p className="muted" style={{ margin: 0 }}>{tx("Een afbeelding of video uit de mediabibliotheek als achtergrond van deze pagina. Uploaden kan in het kiesvenster.")}</p>
              <div className="tabs tabset" style={{ marginTop: 0 }}>
                {BG.map(([k, l]) => <button key={k} type="button" className={`btn ${bg.type === k ? "primary" : ""}`} onClick={() => setBg(k === "none" ? { type: "none", overlay: bg.overlay ?? 0.35 } : { ...bg, type: k, ...(bg.type !== k ? { media: null, url: null } : {}) })}>{tx(l)}</button>)}
              </div>
              {bg.type !== "none" && (
                <>
                  <div className="pgs-bgprev">
                    {bg.url
                      ? (bg.type === "video" ? <video src={mediaUrl(bg.url)} autoPlay muted loop playsInline /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(bg.url)} alt="" />)
                      : <div className="muted" style={{ display: "grid", placeItems: "center", height: "100%", color: "#fff" }}>{tx("Nog niets gekozen")}</div>}
                    <div className="page-bg-shade" style={{ opacity: bg.overlay }} />
                  </div>
                  <div className="row" style={{ justifyContent: "flex-start", flexWrap: "nowrap" }}>
                    <button type="button" className="btn primary" onClick={() => setPicker("bg")}>{tx("Media")}</button>
                    {bg.url && <button type="button" className="btn danger" onClick={() => setBg({ type: "none", overlay: bg.overlay })}>{tx("Verwijderen")}</button>}
                  </div>
                  <label>{tx("Donkerte over de achtergrond")} <small className="muted">{Math.round((bg.overlay ?? 0.35) * 100)}%</small>
                    <input type="range" min={0} max={0.9} step={0.05} value={bg.overlay ?? 0.35} onChange={(e) => setBg({ ...bg, overlay: Number(e.target.value) })} />
                  </label>
                </>
              )}
            </>
          )}
        </div>

        {error && <div className="alert">{error}</div>}
        <div className="row"><button type="button" className="btn" onClick={onClose}>{tx("Annuleren")}</button><button className="btn primary" disabled={busy}>{busy ? tx("Bezig…") : tx("Opslaan")}</button></div>
      </form>
      {picker && (
        <div onClick={(e) => e.stopPropagation()}>
          <MediaPicker kind={picker === "bg" && bg.type === "video" ? "video" : "image"} onClose={() => setPicker(null)}
            onPick={(i) => { if (picker === "bg") setBg({ ...bg, media: i.id, url: i.url, name: i.name }); else setCur({ og_media: i.id, og_image: i.url }); setPicker(null); }} />
        </div>
      )}
    </div>
  );
}

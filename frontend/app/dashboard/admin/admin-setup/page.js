// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../../../../lib/t";
import { useEffect, useState } from "react";
import { api, errorText } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { TILES } from "../../../../lib/admin-tiles";
import { loadAdminSetup, setAdminSetup, SETUP_DEFAULTS } from "../../../../lib/adminsetup";
import { useAuth } from "../../../../components/AuthContext";
import Tabs from "../../../../components/Tabs";
import { Busy } from "../../../../components/PageLoader";
import { IconGrid, IconHome, IconMenu, IconKey, IconPalette } from "../../../../components/Icons";

// easy2edit admin setup: the starting values of the admin and the dashboards for the whole website. A person can still choose for himself (tiles or list, page size, sidebar).
const SIZES = [["5", "5"], ["10", "10"], ["25", "25"], ["100", "100"], ["all", "Alles"]];
// A few ready-made styles for the dashboard: one click sets several choices of the tab Uiterlijk (and the sidebar) at once.
const STYLES = [
  ["classic", "Klassiek", "De standaard: hele scherm, normale ruimte.", { width: "full", density: "normal", tile_size: "normal", font: "normal", sidebar_width: "normal", reduce_motion: false }],
  ["business", "Zakelijk", "Genormeerde breedte, compact en veel tegels in beeld.", { width: "normal", density: "compact", tile_size: "small", font: "normal", sidebar_width: "narrow", reduce_motion: false, frame: "dark" }],
  ["site", "Zoals de website", "Even breed als de pagina's van de website, met donkere zijkanten.", { width: "site", density: "normal", tile_size: "normal", font: "normal", sidebar_width: "normal", reduce_motion: false, frame: "dark" }],
  ["comfort", "Rustig en groot", "Ruim, grote letters en tegels, zonder bewegingen.", { width: "wide", density: "roomy", tile_size: "large", font: "large", sidebar_width: "wide", reduce_motion: true, frame: "light" }],
];
const BLOCKS = [
  ["ai", "AI-gebruik", "Het blok met het AI-gebruik en de kosten (alleen voor wie AI beheert)."],
  ["presets", "Standaard installaties", "Het blok om in één keer een soort website in te stellen."],
  ["backup", "Instellingen back-up", "Het blok om de instellingen op te slaan en terug te zetten (superadmin)."],
  ["about", "Over easy2edit", "De uitleg, de handleiding en de vermelding onderaan."],
];

function Switch({ checked, onChange, label, hint, disabled }) {
  return (
    <div className="as-row" style={{ opacity: disabled ? 0.65 : 1 }}>
      <span><strong title={tx(label)}>{tx(label)}</strong>{hint && <small title={tx(hint)}>{tx(hint)}</small>}</span>
      <label className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={tx(label)} /><span /></label>
    </div>
  );
}

function Seg({ rows, value, onChange, label }) {
  return (
    <div style={{ display: "grid", gap: ".4rem" }}><span className="as-label">{tx(label)}</span>
      <span className="as-seg" role="group" aria-label={tx(label)}>
        {rows.map(([k, l]) => <button type="button" key={k} className={value === k ? "on" : ""} aria-pressed={value === k} onClick={() => onChange(k)}>{tx(l)}</button>)}
      </span>
    </div>
  );
}

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : "");

// The tab Licentie: the licence of this website with the company and the person that are linked to it. A change is saved here AND sent to the easy2edit master site.
function LicenceTab() {
  const [d, setD] = useState(null);
  const [co, setCo] = useState({});
  const [ow, setOw] = useState({});
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fill = (r) => { setD(r); setCo(r.company || {}); setOw(r.owner || {}); };
  useEffect(() => { api("/admin-setup/licence/").then(fill).catch((e) => setErr(errorText(e))); }, []);
  if (!d) return err ? <div className="alert">{err}</div> : <Busy />;
  const edit = d.can_edit, m = d.master, L = d.licence;
  const run = async (body) => {
    setBusy(true); setMsg(""); setErr("");
    try {
      const r = await api("/admin-setup/licence/", { method: "PUT", body });
      fill(r);
      setMsg(r.sync?.ok ? (r.master?.is_master ? tx("Opgeslagen.") : tx("Opgeslagen en bijgewerkt op de easy2edit master.")) : tx("Opgeslagen, maar de master is niet bereikt ({0}). Probeer het later opnieuw.", r.sync?.error || "?"));
    } catch (e) { setErr(errorText(e)); }
    setBusy(false);
  };
  const cf = (k, label, wide) => <label className={wide ? "wide" : ""}>{tx(label)}<input value={co[k] || ""} disabled={!edit} onChange={(e) => setCo({ ...co, [k]: e.target.value })} /></label>;
  const of = (k, label, wide) => <label className={wide ? "wide" : ""}>{tx(label)}<input value={ow[k] || ""} disabled={!edit} onChange={(e) => setOw({ ...ow, [k]: e.target.value })} /></label>;
  return (
    <div className="as-wrap">
      {err && <div className="alert">{err}</div>}
      {msg && <div className="alert ok" role="status">{msg}</div>}
      <div className="as-cols">
        <section className="as-block">
          <h3>{tx("Licentie")}</h3>
          {L.has ? (
            <dl className="as-facts">
              <div><dt>{tx("Licentienummer")}</dt><dd style={{ fontFamily: "monospace" }}>{L.number}</dd></div>
              <div><dt>{tx("Opdrachtgever")}</dt><dd>{L.client || "—"}</dd></div>
              <div><dt>{tx("Geldig tot")}</dt><dd>{L.valid_until ? fmtDate(L.valid_until) : tx("Geen einddatum")} {L.expired && <span className="badge off">{tx("verlopen")}</span>}</dd></div>
              {L.reseller?.name && <div><dt>{tx("Reseller")}</dt><dd>{L.reseller.name}</dd></div>}
            </dl>
          ) : <p>{tx("Er is geen licentie ingesteld.")}</p>}
        </section>
        <section className="as-block">
          <h3>{tx("easy2edit master")}</h3>
          <div className="as-status"><span className={`as-dot ${m.synced ? "ok" : "bad"}`} />{m.is_master ? tx("Deze website is de master.") : m.synced ? tx("Bedrijf en persoon zijn bekend op de master.") : m.connected ? tx("Bedrijf en persoon zijn nog niet naar de master gestuurd.") : tx("Nog niet verbonden met de master.")}</div>
          {m.last_ok_at && !m.is_master && <small className="muted">{tx("Laatste contact")}: {new Date(m.last_ok_at).toLocaleString()}</small>}
          {m.last_error && !m.synced && <small className="muted">{tx("Laatste fout")}: {m.last_error}</small>}
          <p>{tx("Een wijziging van het bedrijf of de persoon hieronder wordt ook op de master doorgevoerd: dezelfde persoon en hetzelfde bedrijf, met hetzelfde id.")}</p>
          {edit && !m.is_master && <div className="as-bar"><button type="button" className="btn sm" disabled={busy} onClick={() => run({ resend: true })}>{tx("Opnieuw naar de master sturen")}</button></div>}
        </section>
      </div>
      <div className="as-cols">
        <section className="as-block">
          <h3>{tx("Bedrijf")}</h3>
          {d.company ? <div className="as-form">
            {cf("name", "Naam", true)}{cf("legal_name", "Juridische naam", true)}{cf("email", "E-mail")}{cf("phone", "Telefoon")}{cf("website", "Website", true)}
            {cf("street", "Straat")}{cf("house_number", "Huisnummer")}{cf("postal_code", "Postcode")}{cf("city", "Plaats")}{cf("country", "Land", true)}{cf("registration_no", "KvK-nummer")}{cf("vat_no", "Btw-nummer")}
          </div> : <p>{tx("Er is nog geen bedrijf. Het ontstaat bij de licentie.")}</p>}
        </section>
        <section className="as-block">
          <h3>{tx("Persoon (eigenaar)")}</h3>
          {d.owner ? <div className="as-form">
            {of("first_name", "Voornaam")}{of("last_name", "Achternaam")}{of("email", "E-mail", true)}{of("phone", "Telefoon")}{of("mobile", "Mobiel")}
          </div> : <p>{tx("Er is nog geen eigenaar. Die ontstaat bij de licentie.")}</p>}
        </section>
      </div>
      {edit && (d.company || d.owner) && <div className="as-bar"><button type="button" className="btn primary" disabled={busy} onClick={() => run({ company: co, owner: ow })}>{busy ? tx("Bezig…") : m.is_master ? tx("Opslaan") : tx("Opslaan en naar de master sturen")}</button></div>}
      <div className="as-cols">
        <section className="as-block">
          <h3>{tx("Gekoppelde personen")} ({d.persons.length})</h3>
          {d.persons.length ? <ul className="as-list">{d.persons.map((p) => <li key={p.id}><span><strong>{p.name}</strong> <small>{p.email}</small></span>{p.owner && <span className="badge ok">{tx("eigenaar")}</span>}</li>)}</ul> : <p>{tx("Nog geen personen gekoppeld.")}</p>}
        </section>
        <section className="as-block">
          <h3>{tx("Andere bedrijven")} ({d.companies.length})</h3>
          {d.companies.length ? <ul className="as-list">{d.companies.map((c) => <li key={c.id}><span><strong>{c.name || "—"}</strong> <small>{[tx(c.kind), c.city].filter(Boolean).join(" · ")}</small></span><small>{c.users} {tx("personen")}</small></li>)}</ul> : <p>{tx("Geen andere bedrijven gekoppeld.")}</p>}
        </section>
      </div>
    </div>
  );
}

export default function AdminSetup() {
  const { user } = useAuth();
  const [tab, setTab] = useState("tiles");
  const [s, setS] = useState(SETUP_DEFAULTS);
  const [can, setCan] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { api("/admin-setup/").then((d) => { setS(d.settings); setCan(!!d.can_edit); }).catch((e) => setErr(errorText(e))); loadAdminSetup(); }, []);

  async function save(patch) {  // every change is saved at once
    const next = { ...s, ...patch };
    setS(next); setMsg(""); setErr("");
    try { const d = await api("/admin-setup/", { method: "PUT", body: patch }); setS(d.settings); setAdminSetup(d.settings); setMsg(tx("Opgeslagen.")); }
    catch (e) { setErr(errorText(e)); }
  }
  async function reset() {
    if (!(await confirmDialog(tx("Alle instellingen van de admin setup terugzetten naar de standaard van easy2edit?")))) return;
    try { const d = await api("/admin-setup/", { method: "DELETE" }); setS(d.settings); setAdminSetup(d.settings); setMsg(tx("Teruggezet naar de standaard.")); } catch (e) { setErr(errorText(e)); }
  }
  const hidden = new Set(s.hidden_tiles || []);
  const toggleTile = (href, show) => { const n = new Set(hidden); if (show) n.delete(href); else n.add(href); save({ hidden_tiles: [...n] }); };
  const tiles = TILES.filter((t) => !t.always);

  return (
    <>
      <h1>{tx("easy2edit admin setup")}</h1>
      <p className="muted">{tx("De instellingen van de admin en de dashboards voor de hele website. Dit zijn de beginwaarden: iemand die zelf kiest (tegels of lijst, aantal per pagina, zijbalk) houdt zijn eigen keuze. Elke wijziging wordt meteen opgeslagen.")}</p>
      {!can && !err && <div className="alert">{tx("Je kunt de instellingen bekijken, maar alleen een beheerder kan ze wijzigen.")}</div>}
      {err && <div className="alert">{err}</div>}
      {msg && <div className="alert ok" role="status">{msg}</div>}
      <Tabs value={tab} onChange={setTab} tabs={[["tiles", "Tegels", <IconGrid key="i" />], ["dashboards", "Dashboards", <IconHome key="i" />], ["menu", "Menu", <IconMenu key="i" />], ["look", "Uiterlijk", <IconPalette key="i" />], ["licence", "Licentie", <IconKey key="i" />]]} />

      {tab === "tiles" && (
        <div className="as-wrap">
          <section className="as-block">
            <h3>{tx("Weergave")}</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem 2.5rem" }}>
              <Seg label="Standaard weergave" value={s.view} onChange={(v) => can && save({ view: v })} rows={[["tiles", "Tegels"], ["list", "Lijst"]]} />
              <Seg label="Aantal per pagina" value={s.page_size} onChange={(v) => can && save({ page_size: v })} rows={SIZES} />
            </div>
          </section>
          <section className="as-block">
            <h3>{tx("Tegels tonen")}</h3>
            <p>{tx("Zet een tegel uit om hem voor iedereen van het overzicht te halen. De pagina zelf blijft werken en de tegel blijft vindbaar via het zoekveld van het menu. De tegel easy2edit admin setup is er altijd.")}</p>
            <div className="as-grid">
              {tiles.map((t) => <Switch key={t.href} checked={!hidden.has(t.href)} disabled={!can} onChange={(v) => toggleTile(t.href, v)} label={t.title} hint={t.big} />)}
            </div>
          </section>
        </div>
      )}

      {tab === "dashboards" && (
        <div className="as-wrap">
          <section className="as-block">
            <h3>{tx("Blokken van het Admin-dashboard")}</h3>
            <p>{tx("Welke blokken het Admin-dashboard onder de tegels toont. Een blok dat je uitzet, verdwijnt voor iedereen; wat iemand niet mag zien, staat er sowieso niet.")}</p>
            <div className="as-grid">
              {BLOCKS.map(([k, label, hint]) => <Switch key={k} checked={s.blocks?.[k] !== false} disabled={!can} onChange={(v) => save({ blocks: { ...s.blocks, [k]: v } })} label={label} hint={hint} />)}
            </div>
          </section>
        </div>
      )}

      {tab === "menu" && (
        <div className="as-wrap">
          <section className="as-block">
            <h3>{tx("Zijbalk")}</h3>
            <Seg label="Zijbalk bij de eerste keer" value={s.sidebar} onChange={(v) => can && save({ sidebar: v })} rows={[["open", "Open"], ["collapsed", "Dicht"], ["remember", "Zoals de gebruiker het laatst deed"]]} />
            <p>{tx("Wie de zijbalk zelf opent of sluit (de pijl), houdt die keuze.")}</p>
            <Seg label="Breedte van de zijbalk" value={s.sidebar_width} onChange={(v) => can && save({ sidebar_width: v })} rows={[["narrow", "Smal"], ["normal", "Normaal"], ["wide", "Breed"]]} />
            <div className="as-grid"><Switch checked={s.menu_search !== false} disabled={!can} onChange={(v) => save({ menu_search: v })} label="Zoekveld in het menu" hint="Het veld bovenaan de zijbalk om snel een beheeronderdeel te vinden." /></div>
          </section>
        </div>
      )}

      {tab === "look" && (
        <div className="as-wrap">
          <section className="as-block">
            <h3>{tx("Kies een stijl")}</h3>
            <p>{tx("Een klik zet meerdere keuzes tegelijk. Daarna kun je alles nog los aanpassen.")}</p>
            <div className="as-grid">
              {STYLES.map(([k, label, hint, vals]) => {
                const on = Object.entries(vals).every(([a, b]) => s[a] === b);
                return (
                  <button type="button" key={k} className={`as-style${on ? " on" : ""}`} disabled={!can} aria-pressed={on} onClick={() => save(vals)}>
                    <strong>{tx(label)}</strong><small>{tx(hint)}</small>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="as-block">
            <h3>{tx("Breedte en ruimte")}</h3>
            <p>{tx("De wijziging is meteen te zien. Dit geldt voor het hele dashboard van iedereen.")}</p>
            <Seg label="Breedte van de inhoud" value={s.width} onChange={(v) => can && save({ width: v })} rows={[["full", "Hele scherm"], ["wide", "Breed"], ["normal", "Normaal"], ["site", "Zoals de website"]]} />
            <p style={{ margin: 0 }}>{tx("\"Zoals de website\" gebruikt de breedte van de inhoud van de pagina's uit het thema, zodat de admin even breed is als de website.")}</p>
            <Seg label="Kleur van de zijkanten" value={s.frame} onChange={(v) => can && save({ frame: v })} rows={[["dark", "Donkerder"], ["login", "Zoals het inlogscherm"], ["light", "Licht"], ["none", "Paginakleur"]]} />
            <Seg label="Ruimte (dichtheid)" value={s.density} onChange={(v) => can && save({ density: v })} rows={[["compact", "Compact"], ["normal", "Normaal"], ["roomy", "Ruim"]]} />
            <Seg label="Grootte van de tegels" value={s.tile_size} onChange={(v) => can && save({ tile_size: v })} rows={[["small", "Klein"], ["normal", "Normaal"], ["large", "Groot"]]} />
          </section>
          <section className="as-block">
            <h3>{tx("Leesgemak")}</h3>
            <Seg label="Grootte van de letters" value={s.font} onChange={(v) => can && save({ font: v })} rows={[["normal", "Normaal"], ["large", "Groot"]]} />
            <div className="as-grid"><Switch checked={!!s.reduce_motion} disabled={!can} onChange={(v) => save({ reduce_motion: v })} label="Minder bewegingen" hint="Zet animaties en overgangen in het dashboard uit." /></div>
          </section>
        </div>
      )}

      {tab === "licence" && <LicenceTab />}

      {can && tab !== "licence" && <p style={{ marginTop: "1.5rem" }}><button type="button" className="btn sm" onClick={reset}>{tx("Standaard terugzetten")}</button></p>}
    </>
  );
}

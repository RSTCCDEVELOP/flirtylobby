"use client";

import { useEffect, useMemo, useState } from "react";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import { useAuth } from "../../../../components/AuthContext";
import { lvl } from "../../../../lib/perms";
import { useModules } from "../../../../components/Modules";
import { api, errorText } from "../../../../lib/api";

const FREQ = [
  ["always", "Bij elke paginalading"],
  ["session", "Eén keer per sessie"],
  ["days", "Opnieuw na een aantal dagen"],
  ["once", "Eénmalig (tot je 'opnieuw vragen' kiest)"],
];

const Toggle = ({ label, checked, onChange, hint }) => (
  <label className="check sec-toggle">
    <span className="switch"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span /></span>
    <span>{label}{hint && <small className="muted"> {hint}</small>}</span>
  </label>
);

const Num = ({ label, value, onChange, min, max, suffix }) => (
  <label>{label}{suffix && <em className="muted"> ({suffix})</em>}
    <input type="number" min={min} max={max} value={value} onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))} />
  </label>
);

function CountryPicker({ selected, codes, onChange }) {
  const [q, setQ] = useState("");
  const names = useMemo(() => {
    const dn = new Intl.DisplayNames(["nl"], { type: "region" });
    return Object.fromEntries(codes.map((c) => [c, dn.of(c) || c]));
  }, [codes]);
  const matches = q.trim()
    ? codes.filter((c) => !selected.includes(c) && (names[c].toLowerCase().includes(q.toLowerCase()) || c.toLowerCase() === q.toLowerCase())).slice(0, 10)
    : [];
  return (
    <div className="country-picker">
      <div className="chips">
        {selected.map((c) => (
          <button type="button" key={c} className="chip" onClick={() => onChange(selected.filter((x) => x !== c))} title="Verwijderen">
            {names[c]} <b>×</b>
          </button>
        ))}
        {!selected.length && <span className="muted">Nog geen landen gekozen.</span>}
      </div>
      <input placeholder="Zoek een land om toe te voegen…" value={q} onChange={(e) => setQ(e.target.value)} />
      {matches.length > 0 && (
        <div className="suggest">
          {matches.map((c) => (
            <button type="button" key={c} onClick={() => { onChange([...selected, c].sort()); setQ(""); }}>{names[c]} <small>{c}</small></button>
          ))}
        </div>
      )}
    </div>
  );
}

// Shared "when / how often" fields for the age gate, gambling popup and cookie banner
function GateFields({ s, set }) {
  return (
    <>
      <Toggle label="Ingeschakeld" checked={s.enabled} onChange={(v) => set("enabled", v)} />
      <div className="grid2">
        <label>Hoe vaak tonen
          <select value={s.frequency} onChange={(e) => set("frequency", e.target.value)}>
            {FREQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {s.frequency === "days" && <Num label="Opnieuw tonen na" suffix="dagen" min={1} max={3650} value={s.days} onChange={(v) => set("days", v)} />}
        <label>Waar tonen
          <select value={s.show_on} onChange={(e) => set("show_on", e.target.value)}>
            <option value="all">Op alle pagina's</option>
            <option value="home">Alleen op de homepage</option>
          </select>
        </label>
        <label>Niet tonen op deze paden (één per regel)
          <textarea rows={2} value={s.exclude_paths.join("\n")} placeholder="/privacy" onChange={(e) => set("exclude_paths", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
        </label>
      </div>
      <div className="row" style={{ justifyContent: "flex-start", alignItems: "center" }}>
        <button type="button" className="btn sm" onClick={() => set("version", s.version + 1)}>Opnieuw vragen aan iedereen</button>
        <span className="muted" style={{ fontSize: ".8rem" }}>Versie {s.version}. Bezoekers die al gekozen hebben, krijgen het weer te zien na opslaan.</span>
      </div>
    </>
  );
}

export default function Security() {
  const [data, setData] = useState(null);
  const [langs, setLangs] = useState([]);
  const [codes, setCodes] = useState([]);
  const [avail, setAvail] = useState({});
  const [lang, setLang] = useState("nl");
  const [msg, setMsg] = useState(null);
  const [test, setTest] = useState({ text: "", found: null });
  const mods = useModules();
  const { user } = useAuth();
  // saving is allowed when you can edit at least one of the security modules
  const canSave = ["security_basic", "geo", "age_gate", "gambling", "cookies", "word_filter", "twofa"].some((m) => lvl(user, m) >= 2);
  const on = (m) => mods[m] !== false;

  useEffect(() => {
    api("/security/settings/").then((d) => {
      setData(d.settings);
      setCodes(d.country_codes);
      setAvail(d.twofa_availability || {});
      const enabled = d.languages.filter((l) => l.enabled);
      setLangs(enabled);
      setLang((enabled.find((l) => l.is_default) || enabled[0] || { code: "nl" }).code);
    }).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  }, []);

  if (!data) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">Laden…</p>;

  const set = (section) => (key, value) => setData((d) => ({ ...d, [section]: { ...d[section], [key]: value } }));
  const text = (section, key) => data[section].texts?.[lang]?.[key] ?? "";
  const setText = (section) => (key, value) =>
    setData((d) => ({ ...d, [section]: { ...d[section], texts: { ...d[section].texts, [lang]: { ...d[section].texts?.[lang], [key]: value } } } }));
  const T = (section, key, label, props = {}) => {
    const Tag = props.rows ? "textarea" : "input";
    return (
      <label>{label}
        <Tag {...props} value={text(section, key)} onChange={(e) => setText(section)(key, e.target.value)} />
      </label>
    );
  };

  async function save() {
    try {
      const r = await api("/security/settings/", { method: "PUT", body: data });
      setData(r.settings);
      setMsg({ ok: true, text: "Beveiliging opgeslagen." });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
  }

  async function checkWords() {
    const r = await api("/security/words/check/", { method: "POST", body: { text: test.text } });
    setTest({ ...test, found: r.found });
  }

  const { basic, geo, age, gambling, cookies, words } = data;
  const wordList = (words.lists?.[lang] || []).join("\n");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Beveiliging</h1>
          <p className="muted" style={{ margin: 0 }}>Toegang, leeftijdscontrole, cookies en verboden woorden. Teksten stel je per taal in.</p>
        </div>
        <div className="row">
          <CollapseAll />
          <button className="btn primary" onClick={save} disabled={!canSave}>Opslaan</button>
        </div>
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <div className="card lang-bar">
        <strong>Teksten bewerken in:</strong>
        {langs.map((l) => (
          <button key={l.code} className={`btn sm ${lang === l.code ? "primary" : ""}`} onClick={() => setLang(l.code)}>{l.native_name}</button>
        ))}
        <span className="muted" style={{ fontSize: ".8rem" }}>Meer talen aanzetten kan bij Admin → Talen. Ontbreekt een tekst, dan wordt de standaardtaal getoond.</span>
      </div>

      <Collapsible id="sec-basic" title="Algemene beveiliging">
        <div className="grid2">
          <Num label="Max. foutieve inlogpogingen" min={1} max={20} value={basic.login_max_attempts} onChange={(v) => set("basic")("login_max_attempts", v)} />
          <Num label="Blokkeertijd na te veel pogingen" suffix="minuten" min={1} max={1440} value={basic.lockout_minutes} onChange={(v) => set("basic")("lockout_minutes", v)} />
          <Num label="Sessie verloopt na" suffix="uren, 0 = nooit" min={0} max={8760} value={basic.token_lifetime_hours} onChange={(v) => set("basic")("token_lifetime_hours", v)} />
          <Num label="Minimale wachtwoordlengte" min={6} max={64} value={basic.password_min_length} onChange={(v) => set("basic")("password_min_length", v)} />
        </div>
        <Toggle label="Sterk wachtwoord verplicht" hint="hoofdletter, kleine letter, cijfer en leesteken" checked={basic.password_complexity} onChange={(v) => set("basic")("password_complexity", v)} />
        <Toggle label="Beveiligingsheaders op de website" hint="X-Frame-Options, nosniff, referrer-policy" checked={basic.security_headers} onChange={(v) => set("basic")("security_headers", v)} />
        <Toggle label="HSTS (alleen via https)" checked={basic.hsts} onChange={(v) => set("basic")("hsts", v)} />
      </Collapsible>

      {on("geo") && (
      <Collapsible id="sec-geo" title="Landen en IP-controle">
        <Toggle label="Landcontrole ingeschakeld" checked={geo.enabled} onChange={(v) => set("geo")("enabled", v)} />
        <div className="grid2">
          <label>Methode
            <select value={geo.mode} onChange={(e) => set("geo")("mode", e.target.value)}>
              <option value="block">Deze landen blokkeren (rest mag erin)</option>
              <option value="allow">Alleen deze landen toestaan</option>
            </select>
          </label>
          <label>Land niet te bepalen
            <select value={geo.unknown_action} onChange={(e) => set("geo")("unknown_action", e.target.value)}>
              <option value="allow">Toestaan</option>
              <option value="block">Blokkeren</option>
            </select>
          </label>
        </div>
        <CountryPicker selected={geo.countries} codes={codes} onChange={(v) => set("geo")("countries", v)} />
        <label>Altijd toegestane IP-adressen of reeksen (één per regel)
          <textarea rows={3} placeholder={"203.0.113.5\n198.51.100.0/24"} value={geo.always_allow_ips.join("\n")}
            onChange={(e) => set("geo")("always_allow_ips", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
        </label>
        <Toggle label="Ook lokaal verkeer controleren (testen)" hint="localhost wordt dan gecontroleerd met jouw echte publieke IP. Alleen voor testen." checked={geo.test_local} onChange={(v) => set("geo")("test_local", v)} />
        <Toggle label="Beheer en inloggen altijd bereikbaar" hint="zodat je jezelf niet buitensluit" checked={geo.admin_bypass} onChange={(v) => set("geo")("admin_bypass", v)} />
        <Toggle label="Landheader van mijn CDN vertrouwen" hint="alleen aanzetten achter Cloudflare/CloudFront; anders kan een bezoeker die header vervalsen" checked={geo.trust_country_header} onChange={(v) => set("geo")("trust_country_header", v)} />
        <h3>Pagina voor geblokkeerde landen</h3>
        <div className="grid2">
          {T("geo", "title", "Titel")}
          {T("geo", "message", "Bericht", { rows: 3 })}
        </div>
        <a className="btn sm" href="/geo-blocked" target="_blank" rel="noreferrer">Bekijk pagina</a>
        <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>Het land wordt bepaald met het IP-adres van de bezoeker. Zonder CDN gebeurt dat via de gratis dienst ipwho.is; het IP-adres wordt dan naar die dienst gestuurd (vermeld dit in je privacybeleid). Lokale adressen worden nooit geblokkeerd.</p>
      </Collapsible>
      )}

      {on("age_gate") && (
      <Collapsible id="sec-age" title="Leeftijdscontrole (18+)">
        <GateFields s={age} set={set("age")} />
        <div className="grid2">
          <Num label="Minimumleeftijd" min={1} max={99} value={age.min_age} onChange={(v) => set("age")("min_age", v)} />
          <label>Bij 'Nee' doorsturen naar (optioneel)
            <input value={age.deny_url} placeholder="https://…" onChange={(e) => set("age")("deny_url", e.target.value)} />
          </label>
        </div>
        <h3>Teksten <small className="muted">gebruik {"{age}"} voor de leeftijd</small></h3>
        <div className="grid2">
          {T("age", "title", "Titel")}
          {T("age", "message", "Bericht", { rows: 2 })}
          {T("age", "yes", "Knop 'Ja'")}
          {T("age", "no", "Knop 'Nee'")}
          {T("age", "deny_message", "Bericht bij 'Nee' (zonder doorsturen)")}
        </div>
      </Collapsible>
      )}

      {on("gambling") && (
      <Collapsible id="sec-gambling" title="Gokken-popup (24+) en waarschuwingen">
        <GateFields s={gambling} set={set("gambling")} />
        <div className="grid2">
          <Num label="Minimumleeftijd" min={1} max={99} value={gambling.min_age} onChange={(v) => set("gambling")("min_age", v)} />
          <label>Bij weigeren doorsturen naar (optioneel)
            <input value={gambling.deny_url} placeholder="https://…" onChange={(e) => set("gambling")("deny_url", e.target.value)} />
          </label>
        </div>
        <Toggle label="Bezoeker moet bevestigen (vinkje)" checked={gambling.require_confirm} onChange={(v) => set("gambling")("require_confirm", v)} />
        <h3>Teksten <small className="muted">gebruik {"{age}"} voor de leeftijd</small></h3>
        <div className="grid2">
          {T("gambling", "title", "Titel")}
          {T("gambling", "message", "Bericht", { rows: 2 })}
          {T("gambling", "confirm", "Tekst bevestigingsknop")}
          {T("gambling", "deny", "Knop 'Verlaten'")}
        </div>
        <label>Waarschuwingen (één per regel)
          <textarea rows={4} value={(data.gambling.texts?.[lang]?.warnings || []).join("\n")}
            onChange={(e) => setText("gambling")("warnings", e.target.value.split("\n"))} />
        </label>
      </Collapsible>
      )}

      {on("cookies") && (
      <Collapsible id="sec-cookies" title="Cookies">
        <GateFields s={cookies} set={set("cookies")} />
        <div className="grid2">
          <label>Positie
            <select value={cookies.position} onChange={(e) => set("cookies")("position", e.target.value)}>
              <option value="bottom">Onderaan</option>
              <option value="center">Midden</option>
            </select>
          </label>
        </div>
        <Toggle label="Knop 'Alleen noodzakelijk' tonen" checked={cookies.show_reject} onChange={(v) => set("cookies")("show_reject", v)} />
        <strong>Categorieën die bezoekers aan/uit kunnen zetten</strong>
        <Toggle label="Statistieken" checked={cookies.analytics} onChange={(v) => set("cookies")("analytics", v)} />
        <Toggle label="Marketing" checked={cookies.marketing} onChange={(v) => set("cookies")("marketing", v)} />
        <Toggle label="Voorkeuren" checked={cookies.preferences} onChange={(v) => set("cookies")("preferences", v)} />
        <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>Noodzakelijke cookies staan altijd aan. De keuze van de bezoeker komt in de browser (`cookie-consent`) en als gebeurtenis `cookie-consent`, zodat scripts pas laden na toestemming.</p>
        <h3>Teksten banner</h3>
        <div className="grid2">
          {T("cookies", "title", "Titel")}
          {T("cookies", "message", "Bericht", { rows: 2 })}
          {T("cookies", "accept_all", "Knop 'Alles accepteren'")}
          {T("cookies", "reject", "Knop 'Alleen noodzakelijk'")}
          {T("cookies", "settings", "Knop 'Instellingen'")}
          {T("cookies", "save", "Knop 'Keuze opslaan'")}
          {T("cookies", "policy_link", "Linktekst cookiebeleid")}
          {T("cookies", "cat_necessary", "Noodzakelijk: naam")}
          {T("cookies", "cat_necessary_desc", "Noodzakelijk: uitleg")}
          {T("cookies", "cat_analytics", "Statistieken: naam")}
          {T("cookies", "cat_analytics_desc", "Statistieken: uitleg")}
          {T("cookies", "cat_marketing", "Marketing: naam")}
          {T("cookies", "cat_marketing_desc", "Marketing: uitleg")}
          {T("cookies", "cat_preferences", "Voorkeuren: naam")}
          {T("cookies", "cat_preferences_desc", "Voorkeuren: uitleg")}
        </div>
        <h3>Cookiepagina (/cookies)</h3>
        {T("cookies", "policy_title", "Titel")}
        {T("cookies", "policy_body", "Tekst", { rows: 8 })}
        <a className="btn sm" href="/cookies" target="_blank" rel="noreferrer">Bekijk pagina</a>
      </Collapsible>
      )}

      {on("twofa") && (
      <Collapsible id="sec-twofa" title="Twee-staps verificatie">
        <Toggle label="Twee-staps verificatie ingeschakeld" hint="inloggen met een code per e-mail of sms" checked={data.twofa.enabled} onChange={(v) => set("twofa")("enabled", v)} />
        <div className="grid2">
          <label>Verplicht voor
            <select value={data.twofa.required_for} onChange={(e) => set("twofa")("required_for", e.target.value)}>
              <option value="none">Niemand (gebruiker kiest zelf)</option>
              <option value="admins">Admins en superadmins</option>
              <option value="all">Alle gebruikers (ook bij aanmelden)</option>
            </select>
          </label>
          <Num label="Code geldig" suffix="minuten" min={1} max={60} value={data.twofa.code_minutes} onChange={(v) => set("twofa")("code_minutes", v)} />
          <Num label="Max. foutieve codes" min={1} max={10} value={data.twofa.max_attempts} onChange={(v) => set("twofa")("max_attempts", v)} />
        </div>
        <Toggle label="Code per e-mail toestaan" hint={avail.email ? `via ${avail.email}` : "niet beschikbaar: koppel e-mail bij API keys"} checked={data.twofa.allow_email} onChange={(v) => set("twofa")("allow_email", v)} />
        <Toggle label="Code per sms toestaan" hint={avail.sms ? `via ${avail.sms}` : "niet beschikbaar: koppel Bird bij API keys"} checked={data.twofa.allow_sms} onChange={(v) => set("twofa")("allow_sms", v)} />
        <h3>Teksten <small className="muted">gebruik {"{code}"} en {"{minutes}"}</small></h3>
        <div className="grid2">
          {T("twofa", "email_subject", "E-mail onderwerp")}
          {T("twofa", "email_body", "E-mail bericht", { rows: 3 })}
          {T("twofa", "sms_body", "Sms-bericht", { rows: 2 })}
        </div>
      </Collapsible>
      )}

      {on("registration") && (
      <Collapsible id="sec-registration" title="Aanmelden (nieuwe gebruikers)">
        <Toggle label="Bezoekers mogen zelf een account aanmaken" hint="pagina /registreren, met link op de inlogpagina" checked={data.registration.enabled} onChange={(v) => set("registration")("enabled", v)} />
        <Toggle label="E-mailadres eerst bevestigen met een code" checked={data.registration.verify_email} onChange={(v) => set("registration")("verify_email", v)} />
        <Toggle label="Geboortedatum verplicht" hint={data.age.enabled ? "staat altijd aan: de leeftijdscontrole is actief" : "de leeftijdsgrens uit 'Leeftijdscontrole' wordt gebruikt zodra die aan staat"} checked={data.registration.require_birth_date || data.age.enabled} onChange={(v) => set("registration")("require_birth_date", v)} />
        <Toggle label="Telefoonnummer verplicht" checked={data.registration.require_phone} onChange={(v) => set("registration")("require_phone", v)} />
        <div className="grid2"><Num label="Bevestigingscode geldig" suffix="minuten" min={1} max={60} value={data.registration.code_minutes} onChange={(v) => set("registration")("code_minutes", v)} /></div>
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
          Er wordt <strong>geen account aangemaakt</strong> voordat alle verplichte controles zijn gedaan. Is twee-staps verificatie verplicht voor alle gebruikers, dan kiest de nieuwe gebruiker e-mail of sms en wordt dit direct geactiveerd. Wachtwoordregels, leeftijdsgrens en het woordenfilter gelden ook bij aanmelden.
        </p>
        <h3>Teksten bevestigingscode <small className="muted">gebruik {"{code}"} en {"{minutes}"}</small></h3>
        <div className="grid2">
          {T("registration", "email_subject", "E-mail onderwerp")}
          {T("registration", "email_body", "E-mail bericht", { rows: 3 })}
          {T("registration", "sms_body", "Sms-bericht", { rows: 2 })}
        </div>
      </Collapsible>
      )}

      {on("word_filter") && (
      <Collapsible id="sec-words" title="Verboden woorden">
        <Toggle label="Woordfilter ingeschakeld" hint="geldt voor namen, omschrijvingen, profielen en bijschriften" checked={words.enabled} onChange={(v) => set("words")("enabled", v)} />
        <label>Verboden woorden in {langs.find((l) => l.code === lang)?.native_name || lang} (één per regel)
          <textarea rows={8} defaultValue={wordList} key={lang}
            onBlur={(e) => setData((d) => ({ ...d, words: { ...d.words, lists: { ...d.words.lists, [lang]: e.target.value.split("\n").map((w) => w.trim()).filter(Boolean) } } }))} />
        </label>
        <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>Er wordt gecontroleerd op alle talen samen, niet hoofdlettergevoelig, op hele woorden. Klik buiten het veld om de lijst over te nemen en sla daarna op.</p>
        <h3>Test een tekst</h3>
        <div className="color-row">
          <input value={test.text} placeholder="Typ een zin…" onChange={(e) => setTest({ text: e.target.value, found: null })} />
          <button type="button" className="btn" onClick={checkWords}>Test</button>
        </div>
        {test.found && <div className={test.found.length ? "alert" : "alert ok"}>{test.found.length ? `Gevonden: ${test.found.join(", ")}` : "Geen verboden woorden gevonden."}</div>}
        <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>De test gebruikt de laatst opgeslagen lijst.</p>
      </Collapsible>
      )}
    </>
  );
}

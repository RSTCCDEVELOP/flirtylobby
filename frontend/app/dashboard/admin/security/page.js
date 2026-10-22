"use client";

import { Busy } from "../../../../components/PageLoader";
import { tx } from "../../../../lib/t";
import { useEffect, useMemo, useState } from "react";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import { useAuth } from "../../../../components/AuthContext";
import { lvl } from "../../../../lib/perms";
import { useModules } from "../../../../components/Modules";
import { api, errorText } from "../../../../lib/api";
import { useAutoSave } from "../../../../lib/autosave";
import SaveStatus from "../../../../components/SaveStatus";

const FREQ = [
  ["always", "Bij elke paginalading"],
  ["session", "Eén keer per sessie"],
  ["days", "Opnieuw na een aantal dagen"],
  ["once", "Eénmalig (tot je 'opnieuw vragen' kiest)"],
];

const Toggle = ({ label, checked, onChange, hint, disabled }) => (
  <label className="check sec-toggle">
    <span className="switch"><input type="checkbox" checked={checked && !disabled} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span>
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
          <button type="button" key={c} className="chip" onClick={() => onChange(selected.filter((x) => x !== c))} title={tx("Verwijderen")}>
            {names[c]} <b>×</b>
          </button>
        ))}
        {!selected.length && <span className="muted">{tx("Nog geen landen gekozen.")}</span>}
      </div>
      <input type="search" placeholder={tx("Zoek een land om toe te voegen…")} value={q} onChange={(e) => setQ(e.target.value)} />
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
      <Toggle label={tx("Ingeschakeld")} checked={s.enabled} onChange={(v) => set("enabled", v)} />
      <div className="grid2">
        <label>{tx("Hoe vaak tonen")}
          <select value={s.frequency} onChange={(e) => set("frequency", e.target.value)}>
            {FREQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {s.frequency === "days" && <Num label={tx("Opnieuw tonen na")} suffix={tx("dagen")} min={1} max={3650} value={s.days} onChange={(v) => set("days", v)} />}
        <label>{tx("Waar tonen")}
          <select value={s.show_on} onChange={(e) => set("show_on", e.target.value)}>
            <option value="all">{tx("Op alle pagina's")}</option>
            <option value="home">{tx("Alleen op de homepage")}</option>
          </select>
        </label>
        <label>{tx("Niet tonen op deze paden (één per regel)")}
          <textarea rows={2} value={s.exclude_paths.join("\n")} placeholder="/privacy" onChange={(e) => set("exclude_paths", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
        </label>
      </div>
      <div className="row" style={{ justifyContent: "flex-start", alignItems: "center" }}>
        <button type="button" className="btn sm" onClick={() => set("version", s.version + 1)}>{tx("Opnieuw vragen aan iedereen")}</button>
        <span className="muted" style={{ fontSize: ".8rem" }}>{tx("Versie")} {s.version}{tx(". Bezoekers die al gekozen hebben, krijgen het weer te zien na opslaan.")}</span>
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

  const auto = useAutoSave(data, save, { ready: !!data && canSave }); // saves by itself, no Save button
  if (!data) return msg ? <div className="alert">{msg.text}</div> : <Busy />;

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
      setMsg(null);
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
      return false;
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
          <h1>{tx("Beveiliging")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Toegang, leeftijdscontrole, cookies en verboden woorden. Teksten stel je per taal in.")}</p>
        </div>
        <div className="row">
          <CollapseAll />
          <SaveStatus auto={auto} />
        </div>
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <div className="card lang-bar">
        <strong>{tx("Teksten bewerken in:")}</strong>
        {langs.map((l) => (
          <button key={l.code} className={`btn sm ${lang === l.code ? "primary" : ""}`} onClick={() => setLang(l.code)}>{l.native_name}</button>
        ))}
        <span className="muted" style={{ fontSize: ".8rem" }}>{tx("Meer talen aanzetten kan bij Admin → Talen. Ontbreekt een tekst, dan wordt de standaardtaal getoond.")}</span>
      </div>

      <Collapsible id="sec-basic" title={tx("Algemene beveiliging")}>
        <div className="grid2">
          <Num label={tx("Max. foutieve inlogpogingen")} min={1} max={20} value={basic.login_max_attempts} onChange={(v) => set("basic")("login_max_attempts", v)} />
          <Num label={tx("Blokkeertijd na te veel pogingen")} suffix={tx("minuten")} min={1} max={1440} value={basic.lockout_minutes} onChange={(v) => set("basic")("lockout_minutes", v)} />
          <Num label={tx("Sessie verloopt na")} suffix={tx("uren, 0 = nooit")} min={0} max={8760} value={basic.token_lifetime_hours} onChange={(v) => set("basic")("token_lifetime_hours", v)} />
          <Num label={tx("Minimale wachtwoordlengte")} min={6} max={64} value={basic.password_min_length} onChange={(v) => set("basic")("password_min_length", v)} />
        </div>
        <Toggle label={tx("Sterk wachtwoord verplicht")} hint={tx("hoofdletter, kleine letter, cijfer en leesteken")} checked={basic.password_complexity} onChange={(v) => set("basic")("password_complexity", v)} />
        <Toggle label={tx("Beveiligingsheaders op de website")} hint={tx("X-Frame-Options, nosniff, referrer-policy")} checked={basic.security_headers} onChange={(v) => set("basic")("security_headers", v)} />
        <Toggle label={tx("HSTS (alleen via https)")} checked={basic.hsts} onChange={(v) => set("basic")("hsts", v)} />
      </Collapsible>

      {on("geo") && (
      <Collapsible id="sec-geo" title={tx("Landen en IP-controle")}>
        <Toggle label={tx("Landcontrole ingeschakeld")} checked={geo.enabled} onChange={(v) => set("geo")("enabled", v)} />
        <div className="grid2">
          <label>{tx("Methode")}
            <select value={geo.mode} onChange={(e) => set("geo")("mode", e.target.value)}>
              <option value="block">{tx("Deze landen blokkeren (rest mag erin)")}</option>
              <option value="allow">{tx("Alleen deze landen toestaan")}</option>
            </select>
          </label>
          <label>{tx("Land niet te bepalen")}
            <select value={geo.unknown_action} onChange={(e) => set("geo")("unknown_action", e.target.value)}>
              <option value="allow">{tx("Toestaan")}</option>
              <option value="block">{tx("Blokkeren")}</option>
            </select>
          </label>
        </div>
        <CountryPicker selected={geo.countries} codes={codes} onChange={(v) => set("geo")("countries", v)} />
        <label>{tx("Altijd toegestane IP-adressen of reeksen (één per regel)")}
          <textarea rows={3} placeholder={"203.0.113.5\n198.51.100.0/24"} value={geo.always_allow_ips.join("\n")}
            onChange={(e) => set("geo")("always_allow_ips", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
        </label>
        <Toggle label={tx("Ook lokaal verkeer controleren (testen)")} hint={tx("localhost wordt dan gecontroleerd met jouw echte publieke IP. Alleen voor testen.")} checked={geo.test_local} onChange={(v) => set("geo")("test_local", v)} />
        <Toggle label={tx("Beheer en inloggen altijd bereikbaar")} hint={tx("zodat je jezelf niet buitensluit")} checked={geo.admin_bypass} onChange={(v) => set("geo")("admin_bypass", v)} />
        <Toggle label={tx("Landheader van mijn CDN vertrouwen")} hint={tx("alleen aanzetten achter Cloudflare/CloudFront; anders kan een bezoeker die header vervalsen")} checked={geo.trust_country_header} onChange={(v) => set("geo")("trust_country_header", v)} />
        <h3>{tx("Pagina voor geblokkeerde landen")}</h3>
        <div className="grid2">
          {T("geo", "title", tx("Titel"))}
          {T("geo", "message", tx("Bericht"), { rows: 3 })}
        </div>
        <a className="btn sm" href="/geo-blocked" target="_blank" rel="noreferrer">{tx("Bekijk pagina")}</a>
        <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>{tx("Het land wordt bepaald met het IP-adres van de bezoeker. Zonder CDN gebeurt dat via de gratis dienst ipwho.is; het IP-adres wordt dan naar die dienst gestuurd (vermeld dit in je privacybeleid). Lokale adressen worden nooit geblokkeerd.")}</p>
      </Collapsible>
      )}

      {on("age_gate") && (
      <Collapsible id="sec-age" title={tx("Leeftijdscontrole (18+)")}>
        <GateFields s={age} set={set("age")} />
        <div className="grid2">
          <Num label={tx("Minimumleeftijd")} min={1} max={99} value={age.min_age} onChange={(v) => set("age")("min_age", v)} />
          <label>{tx("Doorsturen naar bij 'Nee', 'Stoppen' of te jong (optioneel)")}
            <input value={age.deny_url} placeholder="https://…" onChange={(e) => set("age")("deny_url", e.target.value)} />
          </label>
        </div>
        <h3>{tx("Teksten")} <small className="muted">{tx("gebruik")} {tx("{age}")} {tx("voor de leeftijd")}</small></h3>
        <div className="grid2">
          {T("age", "title", tx("Titel"))}
          {T("age", "message", tx("Bericht"), { rows: 2 })}
          {T("age", "yes", tx("Knop 'Ja'"))}
          {T("age", "no", tx("Knop 'Nee'"))}
          {T("age", "deny_message", tx("Bericht bij 'Nee' (zonder doorsturen)"))}
        </div>
      </Collapsible>
      )}

      {on("gambling") && (
      <Collapsible id="sec-gambling" title={tx("Gokken-popup (24+) en waarschuwingen")}>
        <GateFields s={gambling} set={set("gambling")} />
        <div className="grid2">
          <Num label={tx("Minimumleeftijd")} min={1} max={99} value={gambling.min_age} onChange={(v) => set("gambling")("min_age", v)} />
          <label>{tx("Doorsturen naar bij weigeren, 'Stoppen' of te jong (optioneel)")}
            <input value={gambling.deny_url} placeholder="https://…" onChange={(e) => set("gambling")("deny_url", e.target.value)} />
          </label>
        </div>
        <Toggle label={tx("Bezoeker moet bevestigen (vinkje)")} checked={gambling.require_confirm} onChange={(v) => set("gambling")("require_confirm", v)} />
        <h3>{tx("Teksten")} <small className="muted">{tx("gebruik")} {tx("{age}")} {tx("voor de leeftijd")}</small></h3>
        <div className="grid2">
          {T("gambling", "title", tx("Titel"))}
          {T("gambling", "message", tx("Bericht"), { rows: 2 })}
          {T("gambling", "confirm", tx("Tekst bevestigingsknop"))}
          {T("gambling", "deny", tx("Knop 'Verlaten'"))}
        </div>
        <label>{tx("Waarschuwingen (één per regel)")}
          <textarea rows={4} value={(data.gambling.texts?.[lang]?.warnings || []).join("\n")}
            onChange={(e) => setText("gambling")("warnings", e.target.value.split("\n"))} />
        </label>
      </Collapsible>
      )}

      {on("cookies") && (
      <Collapsible id="sec-cookies" title={tx("Cookies")}>
        <GateFields s={cookies} set={set("cookies")} />
        <div className="grid2">
          <label>{tx("Positie")}
            <select value={cookies.position} onChange={(e) => set("cookies")("position", e.target.value)}>
              <option value="bottom">{tx("Onderaan")}</option>
              <option value="center">{tx("Midden")}</option>
            </select>
          </label>
        </div>
        <Toggle label={tx("Knop 'Alleen noodzakelijk' tonen")} checked={cookies.show_reject} onChange={(v) => set("cookies")("show_reject", v)} />
        <strong>{tx("Categorieën die bezoekers aan/uit kunnen zetten")}</strong>
        <Toggle label={tx("Statistieken")} checked={cookies.analytics} onChange={(v) => set("cookies")("analytics", v)} />
        <Toggle label={tx("Marketing")} checked={cookies.marketing} onChange={(v) => set("cookies")("marketing", v)} />
        <Toggle label={tx("Voorkeuren")} checked={cookies.preferences} onChange={(v) => set("cookies")("preferences", v)} />
        <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>{tx("Noodzakelijke cookies staan altijd aan. De keuze van de bezoeker komt in de browser (`cookie-consent`) en als gebeurtenis `cookie-consent`, zodat scripts pas laden na toestemming.")}</p>
        <h3>{tx("Teksten banner")}</h3>
        <div className="grid2">
          {T("cookies", "title", tx("Titel"))}
          {T("cookies", "message", tx("Bericht"), { rows: 2 })}
          {T("cookies", "accept_all", tx("Knop 'Alles accepteren'"))}
          {T("cookies", "reject", tx("Knop 'Alleen noodzakelijk'"))}
          {T("cookies", "settings", tx("Knop 'Instellingen'"))}
          {T("cookies", "save", tx("Knop 'Keuze opslaan'"))}
          {T("cookies", "policy_link", tx("Linktekst cookiebeleid"))}
          {T("cookies", "cat_necessary", tx("Noodzakelijk: naam"))}
          {T("cookies", "cat_necessary_desc", tx("Noodzakelijk: uitleg"))}
          {T("cookies", "cat_analytics", tx("Statistieken: naam"))}
          {T("cookies", "cat_analytics_desc", tx("Statistieken: uitleg"))}
          {T("cookies", "cat_marketing", tx("Marketing: naam"))}
          {T("cookies", "cat_marketing_desc", tx("Marketing: uitleg"))}
          {T("cookies", "cat_preferences", tx("Voorkeuren: naam"))}
          {T("cookies", "cat_preferences_desc", tx("Voorkeuren: uitleg"))}
        </div>
        <h3>{tx("Cookiepagina (/cookies)")}</h3>
        {T("cookies", "policy_title", tx("Titel"))}
        {T("cookies", "policy_body", tx("Tekst"), { rows: 8 })}
        <a className="btn sm" href="/cookies" target="_blank" rel="noreferrer">{tx("Bekijk pagina")}</a>
      </Collapsible>
      )}

      {on("twofa") && (
      <Collapsible id="sec-twofa" title={tx("Twee-staps verificatie")}>
        <Toggle label={tx("Twee-staps verificatie ingeschakeld")} hint={tx("inloggen met een code per e-mail of sms")} checked={data.twofa.enabled} onChange={(v) => set("twofa")("enabled", v)} />
        <div className="grid2">
          <label>{tx("Verplicht voor")}
            <select value={data.twofa.required_for} onChange={(e) => set("twofa")("required_for", e.target.value)}>
              <option value="none">{tx("Niemand (gebruiker kiest zelf)")}</option>
              <option value="admins">{tx("Admins en superadmins")}</option>
              <option value="all">{tx("Alle gebruikers (ook bij aanmelden)")}</option>
            </select>
          </label>
          <Num label={tx("Code geldig")} suffix={tx("minuten")} min={1} max={60} value={data.twofa.code_minutes} onChange={(v) => set("twofa")("code_minutes", v)} />
          <Num label={tx("Max. foutieve codes")} min={1} max={10} value={data.twofa.max_attempts} onChange={(v) => set("twofa")("max_attempts", v)} />
        </div>
        {avail.email && <Toggle label={tx("Code per e-mail toestaan")} hint={avail.email ? `via ${avail.email}` : tx("niet beschikbaar: koppel e-mail bij API keys")} checked={data.twofa.allow_email} onChange={(v) => set("twofa")("allow_email", v)} />}
        <Toggle label={tx("Authenticator-app toestaan")} hint={tx("QR-code of sleutel voor Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden…")} checked={data.twofa.allow_app} onChange={(v) => set("twofa")("allow_app", v)} />
        {data.twofa.allow_app && (
          <div className="grid2">
            <label>{tx("Naam in de authenticator-app")}
              <input value={data.twofa.app_issuer || ""} maxLength={60} placeholder="Studio2" onChange={(e) => set("twofa")("app_issuer", e.target.value)} />
            </label>
          </div>
        )}
        {avail.sms && <Toggle label={tx("Code per sms toestaan")} hint={avail.sms ? `via ${avail.sms}` : tx("niet beschikbaar: koppel Bird bij API keys")} checked={data.twofa.allow_sms} onChange={(v) => set("twofa")("allow_sms", v)} />}
        {(avail.email || avail.sms) && (
          <>
            <h3>{tx("Teksten")} <small className="muted">{tx("gebruik")} {tx("{code}")} {tx("en")} {tx("{minutes}")}</small></h3>
            <div className="grid2">
              {avail.email && T("twofa", "email_subject", tx("E-mail onderwerp"))}
              {avail.email && T("twofa", "email_body", tx("E-mail bericht"), { rows: 3 })}
              {avail.sms && T("twofa", "sms_body", tx("Sms-bericht"), { rows: 2 })}
            </div>
          </>
        )}
      </Collapsible>
      )}

      {on("security_basic") && data.passkeys && (
      <Collapsible id="sec-passkeys" title={tx("Passkeys en inloggen met Google of Apple")}>
        <Toggle label={tx("Passkeys ingeschakeld")} hint={tx("inloggen zonder wachtwoord met je vingerafdruk, gezicht of pincode")} checked={data.passkeys.enabled} onChange={(v) => set("passkeys")("enabled", v)} />
        {data.passkeys.enabled && (
          <>
            <Toggle label={tx("Inloggen met een passkey toestaan")} hint={tx("knop op de inlogpagina")} checked={data.passkeys.login} onChange={(v) => set("passkeys")("login", v)} />
            <Toggle label={tx("Gebruikers mogen zelf een passkey toevoegen")} hint={tx("in het eigen profiel")} checked={data.passkeys.add} onChange={(v) => set("passkeys")("add", v)} />
            <div className="grid2">
              <label>{tx("Controle van de persoon")}
                <select value={data.passkeys.verification} onChange={(e) => set("passkeys")("verification", e.target.value)}>
                  <option value="preferred">{tx("Aanbevolen (het apparaat bepaalt)")}</option>
                  <option value="required">{tx("Verplicht (pincode, vingerafdruk of gezicht)")}</option>
                </select>
              </label>
              <Num label={tx("Passkeys per gebruiker")} min={1} max={50} value={data.passkeys.max_per_user} onChange={(v) => set("passkeys")("max_per_user", v)} />
            </div>
            <p className="muted" style={{ margin: 0 }}>{tx("Een passkey werkt alleen op een beveiligd adres (https, of localhost) en hoort bij de domeinnaam van de website.")}</p>
          </>
        )}
        <h3 style={{ margin: ".8rem 0 0" }}>{tx("Sociaal inloggen")}</h3>
        <Toggle label={tx("Inloggen met Google tonen")} hint={tx("vul eerst het Client-ID in bij API keys → Inloggen met Google")} checked={data.social.google} onChange={(v) => set("social")("google", v)} />
        <Toggle label={tx("Inloggen met Apple tonen")} hint={tx("vul eerst de Services-ID in bij API keys → Inloggen met Apple")} checked={data.social.apple} onChange={(v) => set("social")("apple", v)} />
        <p className="muted" style={{ margin: 0 }}>{tx("Een nieuw account wordt alleen aangemaakt als aanmelden aan staat (Aanmelden). Bij een bestaand e-mailadres wordt het account gekoppeld. De 2-stapscode wordt bij deze manieren niet gevraagd: Google, Apple of de passkey doen die controle zelf.")}</p>
      </Collapsible>
      )}

      {on("security_basic") && avail.email && (
      <Collapsible id="sec-email-verify" title={tx("E-mailverificatie")}>
        <Toggle label={tx("E-mailverificatie verplicht")}
          hint={avail.email ? tx("elke gebruiker bevestigt eenmalig bij het inloggen het e-mailadres met een code, via {0}", avail.email) : tx("niet beschikbaar: koppel e-mail (Postmark) bij API keys")}
          checked={data.email_verify.enabled} onChange={(v) => set("email_verify")("enabled", v)} />
        <p className="muted" style={{ margin: 0 }}>{tx("Staat standaard uit. Gebruikers die al bevestigd hebben (of zich met e-mailbevestiging hebben aangemeld) worden niet opnieuw gevraagd.")}</p>
      </Collapsible>
      )}

      {on("registration") && (
      <Collapsible id="sec-registration" title={tx("Aanmelden (nieuwe gebruikers)")}>
        <Toggle label={tx("Bezoekers mogen zelf een account aanmaken")} hint={tx("pagina /registreren, met link op de inlogpagina")} checked={data.registration.enabled} onChange={(v) => set("registration")("enabled", v)} />
        {avail.email && <Toggle label={tx("E-mailadres eerst bevestigen met een code")} checked={data.registration.verify_email} onChange={(v) => set("registration")("verify_email", v)} />}
        <Toggle label={tx("Geboortedatum verplicht")} hint={data.age.enabled ? tx("staat altijd aan: de leeftijdscontrole is actief") : tx("de leeftijdsgrens uit 'Leeftijdscontrole' wordt gebruikt zodra die aan staat")} checked={data.registration.require_birth_date || data.age.enabled} onChange={(v) => set("registration")("require_birth_date", v)} />
        <Toggle label={tx("Telefoonnummer verplicht")} checked={data.registration.require_phone} onChange={(v) => set("registration")("require_phone", v)} />
        {(avail.email || avail.sms) && <div className="grid2"><Num label={tx("Bevestigingscode geldig")} suffix={tx("minuten")} min={1} max={60} value={data.registration.code_minutes} onChange={(v) => set("registration")("code_minutes", v)} /></div>}
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
          {tx("Er wordt")} <strong>{tx("geen account aangemaakt")}</strong> {tx("voordat alle verplichte controles zijn gedaan. Is twee-staps verificatie verplicht voor alle gebruikers, dan kiest de nieuwe gebruiker e-mail of sms en wordt dit direct geactiveerd. Wachtwoordregels, leeftijdsgrens en het woordenfilter gelden ook bij aanmelden.")}
        </p>
        {(avail.email || avail.sms) && (
          <>
            <h3>{tx("Teksten bevestigingscode")} <small className="muted">{tx("gebruik")} {tx("{code}")} {tx("en")} {tx("{minutes}")}</small></h3>
            <div className="grid2">
              {avail.email && T("registration", "email_subject", tx("E-mail onderwerp"))}
              {avail.email && T("registration", "email_body", tx("E-mail bericht"), { rows: 3 })}
              {avail.sms && T("registration", "sms_body", tx("Sms-bericht"), { rows: 2 })}
            </div>
          </>
        )}
      </Collapsible>
      )}

      {on("word_filter") && (
      <Collapsible id="sec-words" title={tx("Verboden woorden")}>
        <Toggle label={tx("Woordfilter ingeschakeld")} hint={tx("geldt voor namen, omschrijvingen, profielen en bijschriften")} checked={words.enabled} onChange={(v) => set("words")("enabled", v)} />
        <label>{tx("Verboden woorden in")} {langs.find((l) => l.code === lang)?.native_name || lang} {tx("(één per regel)")}
          <textarea rows={8} defaultValue={wordList} key={lang}
            onBlur={(e) => setData((d) => ({ ...d, words: { ...d.words, lists: { ...d.words.lists, [lang]: e.target.value.split("\n").map((w) => w.trim()).filter(Boolean) } } }))} />
        </label>
        <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>{tx("Er wordt gecontroleerd op alle talen samen, niet hoofdlettergevoelig, op hele woorden. Klik buiten het veld om de lijst over te nemen en sla daarna op.")}</p>
        <h3>{tx("Test een tekst")}</h3>
        <div className="color-row">
          <input value={test.text} placeholder={tx("Typ een zin…")} onChange={(e) => setTest({ text: e.target.value, found: null })} />
          <button type="button" className="btn" onClick={checkWords}>{tx("Test")}</button>
        </div>
        {test.found && <div className={test.found.length ? "alert" : "alert ok"}>{test.found.length ? tx("Gevonden: {0}", test.found.join(", ")) : tx("Geen verboden woorden gevonden.")}</div>}
        <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>{tx("De test gebruikt de laatst opgeslagen lijst.")}</p>
      </Collapsible>
      )}
    </>
  );
}

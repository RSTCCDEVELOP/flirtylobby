"use client";

import { tx } from "../../../../lib/t";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import { DirectDataFields } from "../../../../components/DirectDataForm";
import { IconBell, IconChat, IconEdit, IconEye, IconImage, IconPin, IconRocket, IconSearch, IconSettings, IconSliders, IconUsers } from "../../../../components/Icons";
import { useModules } from "../../../../components/Modules";
import ProfileFieldsAdmin from "../../../../components/ProfileFieldsAdmin";
import Tabs from "../../../../components/Tabs";
import { api, errorText } from "../../../../lib/api";

const Num = ({ label, hint, value, onChange, min, max, disabled }) => (
  <label>{label}{hint && <small className="muted"> {hint}</small>}
    <input type="number" min={min} max={max} value={value} disabled={disabled} onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))} />
  </label>
);
const Sw = ({ label, hint, checked, onChange, disabled }) => (
  <label className="check sec-toggle">
    <span className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span>
    <span>{label}{hint && <small className="muted"> {hint}</small>}</span>
  </label>
);

export default function CommunityAdmin() {
  const { user } = useAuth();
  const mods = useModules();
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [dtab, setDtab] = useState("settings"); // Directe verbinding: settings | data | connect | actions
  const [xtab, setXtab] = useState("join"); // Zoeken & matchen: join | search | distance | alerts
  const [ctab, setCtab] = useState("how"); // Chat: how | look | share | conn
  const [langs, setLangs] = useState([]);
  useEffect(() => { api("/languages/").then((x) => setLangs(x.languages || [])).catch(() => {}); }, []);
  const load = useCallback(() => api("/community/settings/").then(setD).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Laden…")}</p>;

  const s = d.settings, lv = d.sections;
  const set = (sec, k, v) => setD({ ...d, settings: { ...s, [sec]: { ...s[sec], [k]: v } } });
  const show = (sec) => mods[sec] !== false && lv[sec] >= 1;
  const can = (sec) => lv[sec] >= 2;
  async function save() {
    const body = Object.fromEntries(Object.keys(lv).filter((k) => can(k)).map((k) => [k, s[k]]));
    try { setD(await api("/community/settings/", { method: "PUT", body })); setMsg({ ok: true, text: tx("Community-instellingen opgeslagen.") }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Community")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Instellingen voor profielen, berichten en chat. Members gebruiken ze via hun eigen dashboard (Community).")}</p>
        </div>
        <div className="row"><CollapseAll /><button className="btn primary" onClick={save}>{tx("Opslaan")}</button></div>
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <div className="cards" style={{ marginBottom: "1rem", marginTop: 0 }}>
        <div className="card stat"><span>{tx("Actieve profielen")}</span><strong>{d.counts.profiles}</strong></div>
        <div className="card stat"><span>{tx("Berichten")}</span><strong>{d.counts.messages}</strong></div>
        <div className="card stat"><span>{tx("Chatberichten (portal)")}</span><strong>{d.counts.chat_messages}</strong></div>
        <div className="card stat"><span>{tx("Blokkades")}</span><strong>{d.counts.blocks}</strong></div>
        <div className="card stat"><span>{tx("Nu online")}</span><strong>{d.counts.online}</strong></div>
      </div>

      {show("general") && (
        <Collapsible id="comm-general" title={tx("Algemeen")}>
          <p className="muted" style={{ margin: 0 }}>{tx("Waar leden naar kunnen zoeken (Ik zoek). Zet aan wat op jouw site mag. Bij aanzetten worden de bijbehorende profielvelden en zoekfilters toegevoegd; bij uitzetten verdwijnen ze weer. Klik daarna op Opslaan.")}</p>
          <div className="grid2" style={{ gap: ".9rem" }}>
            {(d.aim_options || []).map((o) => (
              <div key={o.key} className="card" style={{ padding: ".9rem 1rem", display: "flex", flexDirection: "column", gap: ".4rem" }}>
                <Sw label={tx(o.label)} checked={!!s.general[`aim_${o.key}`]} disabled={!can("general")} onChange={(v) => set("general", `aim_${o.key}`, v)} />
                <small className="muted">{tx(o.desc)}</small>
                {o.fields.length > 0 && <small className="muted">{tx("Voegt profielvelden toe")}: {o.fields.map((x) => tx(x)).join(", ")}</small>}
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {show("chat") && (
        <Collapsible id="comm-chat" title={tx("Chat")}>
          <Tabs value={ctab} onChange={setCtab} tabs={[["how", "Werking", <IconChat key="1" />], ["look", "Weergave", <IconEye key="2" />], ["share", "Delen", <IconImage key="3" />], ["conn", "Verbinding", <IconSettings key="4" />]]} />
          {ctab === "how" && (
            <div style={{ display: "flex", flexDirection: "column", gap: ".85rem", paddingTop: ".75rem" }}>
            <strong>{tx("Hoe werkt de chat?")}</strong>
            <div className="vis-options">
              <label className={`card vis ${s.chat.method === "portal" ? "active" : ""}`}>
                <input type="radio" name="method" disabled={!can("chat")} checked={s.chat.method === "portal"} onChange={() => set("chat", "method", "portal")} />
                <span><strong>{tx("Online via de portal")}</strong><small className="muted"> {tx("Berichten en bestanden gaan via de server, worden bewaard en komen ook aan als de ander later inlogt.")}</small></span>
              </label>
              <label className={`card vis ${s.chat.method === "webrtc" ? "active" : ""}`}>
                <input type="radio" name="method" disabled={!can("chat")} checked={s.chat.method === "webrtc"} onChange={() => set("chat", "method", "webrtc")} />
                <span><strong>{tx("Rechtstreeks tussen de apparaten van members (WebRTC)")}</strong><small className="muted"> {tx("Berichten en bestanden gaan rechtstreeks van device naar device. De server regelt alleen het opzetten van de verbinding en bewaart niets. Beide mensen moeten online zijn.")}</small></span>
              </label>
            </div>
            <div className="theme-grid">
              <label>{tx("Weergave")}
                <select value={s.chat.display} disabled={!can("chat")} onChange={(e) => set("chat", "display", e.target.value)}>
                  <option value="both">{tx("Popup én eigen scherm")}</option><option value="popup">{tx("Alleen popup (rechtsonder)")}</option><option value="page">{tx("Alleen in het scherm (Community → Chat)")}</option>
                </select>
              </label>
            </div>
            </div>
          )}
          {ctab === "look" && (
            <div style={{ display: "flex", flexDirection: "column", gap: ".85rem", paddingTop: ".75rem" }}>
            <h3>{tx("Waar en hoe de chat verschijnt")}</h3>
            <div className="theme-grid">
              <label>{tx("Waar staat de chat-popup")}
                <select value={s.chat.popup_position || ""} disabled={!can("chat")} onChange={(e) => set("chat", "popup_position", e.target.value)}>
                  <option value="">{tx("Volgens Vormgeving (standaard)")}</option>
                  <option value="top-left">{tx("Linksboven")}</option>
                  <option value="top-right">{tx("Rechtsboven")}</option>
                  <option value="bottom-left">{tx("Linksonder")}</option>
                  <option value="bottom-right">{tx("Rechtsonder")}</option>
                  <option value="center">{tx("Gecentreerd")}</option>
                </select>
              </label>
              <label>{tx("Hoe opent de chat")}
                <select value={s.chat.style} disabled={!can("chat")} onChange={(e) => set("chat", "style", e.target.value)}>
                  <option value="floating">{tx("Zwevende knop (rechts- of linksonder)")}</option>
                  <option value="button">{tx("Knop in de header")}</option>
                </select>
              </label>
            </div>
            <strong style={{ fontSize: ".85rem" }}>{tx("Waar is de chat beschikbaar")}</strong>
            <div className="perm-list">
              {[["home", tx("Homepage")], ["website", tx("Overige websitepagina's")], ["dashboard", tx("Dashboard van users")], ["backend", tx("Beheer (Admin en Super admin)")]].map(([k, l]) => (
                <label className="check" key={k} style={{ fontWeight: 500 }}>
                  <input type="checkbox" disabled={!can("chat")} checked={s.chat.show_on.includes(k)} onChange={() => set("chat", "show_on", s.chat.show_on.includes(k) ? s.chat.show_on.filter((x) => x !== k) : [...s.chat.show_on, k])} /> {l}
                </label>
              ))}
            </div>
            <small className="muted">{tx("Kleur, formaat, positie en uiterlijk van de knop en popup stel je in bij")} <a href="/dashboard/admin/theme" style={{ color: "var(--blue)" }}>{tx("Vormgeving → Chat-weergave")}</a>.</small>
            </div>
          )}
          {ctab === "share" && (
            <div style={{ display: "flex", flexDirection: "column", gap: ".85rem", paddingTop: ".75rem" }}>
            <h3>{tx("Wat mag er gedeeld worden")}</h3>
            <Sw label={tx("Foto's delen")} checked={s.chat.photos} disabled={!can("chat")} onChange={(v) => set("chat", "photos", v)} />
            <Sw label={tx("Video's delen")} checked={s.chat.videos} disabled={!can("chat")} onChange={(v) => set("chat", "videos", v)} />
            <Sw label={tx("Videochat")} hint={tx("Gebruikt altijd een directe WebRTC-verbinding, ook als de berichten via de portal gaan.")} checked={s.chat.video_chat} disabled={!can("chat")} onChange={(v) => set("chat", "video_chat", v)} />
            <div className="theme-grid">
              <Num label={tx("Max. grootte foto")} hint="MB" min={1} max={50} value={s.chat.max_image_mb} disabled={!can("chat")} onChange={(v) => set("chat", "max_image_mb", v)} />
              <Num label={tx("Max. grootte video")} hint="MB" min={1} max={500} value={s.chat.max_video_mb} disabled={!can("chat")} onChange={(v) => set("chat", "max_video_mb", v)} />
            </div>
            </div>
          )}
          {ctab === "conn" && (
            <div style={{ display: "flex", flexDirection: "column", gap: ".85rem", paddingTop: ".75rem" }}>
            <h3>{tx("Verbinding (WebRTC en videochat)")}</h3>
            <label>{tx("STUN-servers")} <small className="muted">{tx("één per regel, bv. stun:stun.l.google.com:19302")}</small>
              <textarea rows={2} disabled={!can("chat")} value={s.chat.stun.join("\n")} onChange={(e) => set("chat", "stun", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
            </label>
            <div className="theme-grid">
              <label>{tx("TURN-server")} <small className="muted">{tx("optioneel, nodig achter strenge firewalls")}</small><input value={s.chat.turn_url} placeholder="turn:turn.voorbeeld.nl:3478" disabled={!can("chat")} onChange={(e) => set("chat", "turn_url", e.target.value)} /></label>
              <label>{tx("TURN-gebruikersnaam")}<input value={s.chat.turn_user} disabled={!can("chat")} onChange={(e) => set("chat", "turn_user", e.target.value)} /></label>
              <label>{tx("TURN-wachtwoord")}<input type="password" value={s.chat.turn_credential} disabled={!can("chat")} onChange={(e) => set("chat", "turn_credential", e.target.value)} autoComplete="off" /></label>
            </div>
            <small className="muted">{tx("Ingelogde users ontvangen deze serverlijst om de verbinding op te zetten. Het standaard STUN-adres is een publieke dienst van Google.")}</small>
            </div>
          )}
</Collapsible>
      )}

      {show("direct") && (
        <Collapsible id="comm-direct" title={tx("Directe verbinding")}>
          <Tabs value={dtab} onChange={setDtab} tabs={[["settings", "Instellingen", <IconSettings key="s" />], ["data", "Gegevens", <IconEdit key="a" />], ["connect", "Verbinding", <IconRocket key="p" />], ["actions", "Acties", <IconSliders key="x" />]]} />
          {dtab === "settings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", paddingTop: ".75rem" }}>
              <p className="muted" style={{ margin: 0 }}>{tx("Een rechtstreekse verbinding tussen twee mensen, ook zonder account: één nodigt uit met een code, link of QR-code, de ander verbindt. Pas daarna kiezen ze wat ze doen. De module zet je aan of uit bij Admin → Modules. Bezoekers starten op")} <a href="/directconnect" target="_blank" rel="noreferrer" style={{ color: "var(--blue)" }}>/directconnect</a>.</p>
              <div className="theme-grid">
                <Num label={tx("Uitnodiging geldig")} hint="uren" min={1} max={72} value={s.direct.hours} disabled={!can("direct")} onChange={(v) => set("direct", "hours", v)} />
                <Num label={tx("Max. grootte foto")} hint="MB" min={1} max={50} value={s.direct.max_image_mb} disabled={!can("direct")} onChange={(v) => set("direct", "max_image_mb", v)} />
                <Num label={tx("Max. grootte video")} hint="MB" min={1} max={500} value={s.direct.max_video_mb} disabled={!can("direct")} onChange={(v) => set("direct", "max_video_mb", v)} />
              </div>
              <small className="muted">{tx("De STUN/TURN-servers voor de verbinding stel je in bij Chat → Verbinding. Een 18+-vraag voor bezoekers stel je in bij Beveiliging → Leeftijdscontrole.")}</small>
            </div>
          )}
          {dtab === "data" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingTop: ".75rem" }}>
              <p className="muted" style={{ margin: 0 }}>{tx("Het eerste scherm op /directconnect (en bij een uitnodigingslink): naam en geslacht, aangevuld met wat je hier aanzet.")}</p>
              <div className="grid3">
                <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
                  <Sw label={tx("Vlaggetjes voor de talen waarin iemand wil zoeken")} hint={tx("Meerdere talen kiezen is mogelijk. Alleen als er meerdere talen aan staan. De vlaggen van de ander zie je bij de verbinding.")} checked={s.direct.ask_languages} disabled={!can("direct")} onChange={(v) => set("direct", "ask_languages", v)} />
                  <Sw label={tx("Geboortemaand en geboortejaar vragen")} hint={tx("Is iemand jonger dan de minimumleeftijd (standaard 18), dan volgt een waarschuwing: datum aanpassen of stoppen.")} checked={s.direct.ask_birth} disabled={!can("direct")} onChange={(v) => set("direct", "ask_birth", v)} />
                </div>
                <div className="card" style={{ maxWidth: 520, width: "100%", margin: 0, display: "flex", flexDirection: "column", gap: "1rem", padding: "2rem", pointerEvents: "none" }} aria-hidden="true">
                  <h1 style={{ textAlign: "center", margin: 0 }}>{tx("Chat starten")}</h1>
                  <div className="form">
                    <p className="muted" style={{ margin: 0 }}>{tx("Vul je gegevens in. Daarna kies je of je zelf iemand uitnodigt of verbindt met een ander.")}</p>
                    <DirectDataFields preview cfg={s.direct} name="" setName={() => {}} gender="m" setGender={() => {}} langs={[]} setLangs={() => {}} birth={{ month: "", year: "" }} setBirth={() => {}} languages={langs} />
                    <button type="button" tabIndex={-1} className="btn primary">{tx("Verder")}</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {dtab === "connect" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingTop: ".75rem" }}>
              <p className="muted" style={{ margin: 0 }}>{tx("Het scherm waar bezoekers kiezen of ze iemand uitnodigen (host) of verbinden met een ander.")}</p>
              <div className="card" style={{ maxWidth: 520, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem", padding: "2rem", pointerEvents: "none" }} aria-hidden="true">
                <h1 style={{ textAlign: "center", margin: 0 }}>{tx("Directe verbinding")}</h1>
                <div className="form">
                  <p className="muted" style={{ margin: 0 }}>{tx("Hoi {0}, wat wil je doen?", tx("Voorbeeld"))}</p>
                  <button type="button" tabIndex={-1} className="btn primary">{tx("Iemand uitnodigen (ik ben de host)")}</button>
                  <small className="muted" style={{ marginTop: "-.4rem" }}>{tx("Je krijgt een code, link en QR-code om te delen.")}</small>
                  <button type="button" tabIndex={-1} className="btn">{tx("Verbinden met een ander (code of link)")}</button>
                  <small className="muted" style={{ marginTop: "-.4rem" }}>{tx("Je vult de code in of scant de QR-code die je hebt gekregen.")}</small>
                  <button type="button" tabIndex={-1} className="btn">{tx("← Gegevens wijzigen")}</button>
                </div>
              </div>
            </div>
          )}
          {dtab === "actions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingTop: ".75rem" }}>
              <p className="muted" style={{ margin: 0 }}>{tx("Het scherm zodra de verbinding er is: knoppen voor de modules en acties die de twee mensen mogen uitvoeren. Zet aan wat mag.")}</p>
              <div className="grid3">
                <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
                  <Sw label={tx("Chatten")} hint={tx("Foto's, video's en videochat horen bij de chat.")} checked={s.direct.chat} disabled={!can("direct")} onChange={(v) => set("direct", "chat", v)} />
                  <div style={{ display: "flex", flexDirection: "column", gap: ".6rem", paddingLeft: "2.5rem" }}>
                    <Sw label={tx("Foto's delen")} checked={s.direct.photos} disabled={!can("direct") || !s.direct.chat} onChange={(v) => set("direct", "photos", v)} />
                    <Sw label={tx("Video's delen")} checked={s.direct.videos} disabled={!can("direct") || !s.direct.chat} onChange={(v) => set("direct", "videos", v)} />
                    <Sw label={tx("Videochat")} checked={s.direct.video_chat} disabled={!can("direct") || !s.direct.chat} onChange={(v) => set("direct", "video_chat", v)} />
                  </div>
                </div>
                <div className="card" style={{ maxWidth: 520, width: "100%", margin: 0, display: "flex", flexDirection: "column", gap: "1rem", padding: "2rem", pointerEvents: "none", textAlign: "center" }} aria-hidden="true">
                  <h2 style={{ margin: 0 }}>{tx("Verbonden met {0}", tx("Voorbeeld"))}</h2>
                  <p className="muted" style={{ margin: 0 }}>{tx("Wat wil je samen doen?")}</p>
                  {s.direct.chat && <button type="button" tabIndex={-1} className="btn primary">{tx("Chatten")}</button>}
                  {s.direct.chat && (s.direct.photos || s.direct.videos || s.direct.video_chat) && <small className="muted">{[s.direct.photos && tx("foto's"), s.direct.videos && tx("video's"), s.direct.video_chat && tx("videochat")].filter(Boolean).join(", ")} {tx("zitten in de chat")}</small>}
                  {!s.direct.chat && <small className="muted">{tx("Er is niets aangezet.")}</small>}
                  <button type="button" tabIndex={-1} className="btn danger">{tx("Verbreek verbinding")}</button>
                </div>
              </div>
            </div>
          )}
        </Collapsible>
      )}

      {show("discover") && (
        <Collapsible id="comm-discover" title={tx("Zoeken & matchen")}>
          <Tabs value={xtab} onChange={setXtab} tabs={[["join", "Deelname", <IconUsers key="1" />], ["search", "Zoeken", <IconSearch key="2" />], ["distance", "Afstand", <IconPin key="3" />], ["alerts", "Overzichten", <IconBell key="4" />]]} />
          {xtab === "join" && (
            <div style={{ display: "flex", flexDirection: "column", gap: ".85rem", paddingTop: ".75rem" }}>
            <h3>{tx("Wie doet mee")}</h3>
            <div className="theme-grid">
              <Num label={tx("Minimumleeftijd")} hint="jaar" min={13} max={99} value={s.discover.min_age} disabled={!can("discover")} onChange={(v) => set("discover", "min_age", v)} />
              <Num label={tx("Maximumleeftijd")} hint="jaar" min={18} max={120} value={s.discover.max_age} disabled={!can("discover")} onChange={(v) => set("discover", "max_age", v)} />
              <Num label={tx("Minimaal aantal foto's om mee te doen")} hint={tx("0 = geen eis")} min={0} max={5} value={s.discover.require_photo} disabled={!can("discover")} onChange={(v) => set("discover", "require_photo", v)} />
            </div>
            <Sw label={tx("Zoeken alleen voor leden die zelf meedoen")} hint={tx("Uit = ieder lid met een actief profiel mag zoeken.")} checked={s.discover.require_to_search} disabled={!can("discover")} onChange={(v) => set("discover", "require_to_search", v)} />
            <Sw label={tx("Leuk vinden alleen voor leden die zelf meedoen")} checked={s.discover.require_to_like} disabled={!can("discover")} onChange={(v) => set("discover", "require_to_like", v)} />
            <Sw label={tx("Ook leden die niet meedoen zijn te vinden")} hint={tx("Uit = alleen deelnemers komen in de resultaten.")} checked={s.discover.show_non_participants} disabled={!can("discover")} onChange={(v) => set("discover", "show_non_participants", v)} />
            </div>
          )}
          {xtab === "search" && (
            <div style={{ display: "flex", flexDirection: "column", gap: ".85rem", paddingTop: ".75rem" }}>
            <h3>{tx("Zoeken")}</h3>
            <div className="theme-grid">
              <Num label={tx("Max. aantal zoekresultaten")} min={10} max={200} value={s.discover.max_results} disabled={!can("discover")} onChange={(v) => set("discover", "max_results", v)} />
              <label>{tx("Standaard sortering")}
                <select value={s.discover.default_sort} disabled={!can("discover")} onChange={(e) => set("discover", "default_sort", e.target.value)}>
                  <option value="active">{tx("Laatst actief")}</option><option value="newest">{tx("Nieuwste eerst")}</option><option value="distance">{tx("Dichtstbij")}</option>
                </select>
              </label>
            </div>
            <Sw label={tx("Tab 'Voor jou' (aanbevelingen)")} hint={tx("Op basis van wie je zoekt, leeftijdsvoorkeuren en gedeelde interesses.")} checked={s.discover.suggestions} disabled={!can("discover")} onChange={(v) => set("discover", "suggestions", v)} />
            </div>
          )}
          {xtab === "distance" && (
            <div style={{ display: "flex", flexDirection: "column", gap: ".85rem", paddingTop: ".75rem" }}>
            <h3>{tx("Afstand")}</h3>
            <Sw label={tx("Zoeken op afstand")} hint={tx("De plaats van een lid wordt omgezet naar een plek op de kaart (afgerond op ongeveer 1 km).")} checked={s.discover.distance_enabled} disabled={!can("discover")} onChange={(v) => set("discover", "distance_enabled", v)} />
            {s.discover.distance_enabled && (
              <div className="theme-grid">
                <label>{tx("Afstandskeuzes")} <small className="muted">{tx("km, gescheiden door komma's")}</small>
                  <input defaultValue={s.discover.radii.join(", ")} disabled={!can("discover")} onBlur={(e) => set("discover", "radii", e.target.value.split(",").map((x) => Number(x.trim())).filter((x) => x > 0))} />
                </label>
                <Num label={tx("Maximale afstand")} hint="km" min={5} max={2000} value={s.discover.max_distance_km} disabled={!can("discover")} onChange={(v) => set("discover", "max_distance_km", v)} />
                <label>{tx("Contactadres voor de plaatsdienst")} <small className="muted">{tx("verplicht volgens de gebruiksregels van OpenStreetMap")}</small>
                  <input value={s.discover.geocoder_contact} placeholder={tx("info@jouwdomein.nl")} disabled={!can("discover")} onChange={(e) => set("discover", "geocoder_contact", e.target.value)} />
                </label>
              </div>
            )}
            <small className="muted">{tx("Plaatsen worden opgezocht bij OpenStreetMap Nominatim (de plaatsnaam gaat naar die dienst; noem dat in je privacybeleid). Staat de sandbox aan, dan wordt de plaats gesimuleerd.")}</small>
            </div>
          )}
          {xtab === "alerts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: ".85rem", paddingTop: ".75rem" }}>
            <h3>{tx("Overzichten en meldingen")}</h3>
            <Sw label={tx("Bezoekers van je profiel tonen")} checked={s.discover.show_visitors} disabled={!can("discover")} onChange={(v) => set("discover", "show_visitors", v)} />
            {s.discover.show_visitors && <Num label={tx("Bezoekers bewaren")} hint="dagen" min={1} max={365} value={s.discover.visitors_days} disabled={!can("discover")} onChange={(v) => set("discover", "visitors_days", v)} />}
            <Sw label={tx("Overzicht 'Vonden mij leuk'")} hint={tx("Uit = leden zien alleen wederzijdse matches.")} checked={s.discover.show_likes_received} disabled={!can("discover")} onChange={(v) => set("discover", "show_likes_received", v)} />
            <Sw label={tx("E-mail bij een nieuwe match")} checked={s.discover.match_email} disabled={!can("discover")} onChange={(v) => set("discover", "match_email", v)} />
            <Sw label={tx("E-mail als iemand je leuk vindt")} hint={tx("Naast de melding in het belletje bovenaan.")} checked={s.discover.like_email} disabled={!can("discover")} onChange={(v) => set("discover", "like_email", v)} />
            <div className="theme-grid">
              <label>{tx("Swipen (kaartjes stapel)")}
                <select value={s.discover.swipe} disabled={!can("discover")} onChange={(e) => set("discover", "swipe", e.target.value)}>
                  <option value="auto">{tx("Automatisch (aan bij het thema Dating)")}</option><option value="on">{tx("Altijd aan")}</option><option value="off">{tx("Uit")}</option>
                </select>
              </label>
              <Num label={tx("Weggeswipete profielen verbergen")} hint="dagen" min={1} max={365} value={s.discover.pass_days} disabled={!can("discover")} onChange={(v) => set("discover", "pass_days", v)} />
            </div>
            <small className="muted">{tx("Leden doen zelf mee via hun profiel (geboortedatum nodig). Een zoeker ziet alleen profielen die hij mag zien volgens zichtbaarheid, taal en blokkades.")}</small>
            </div>
          )}
</Collapsible>
      )}

      {show("messages") && (
        <Collapsible id="comm-messages" title={tx("Berichten")}>
          <div className="theme-grid">
            <Num label={tx("Maximale lengte van een bericht")} hint="tekens" min={100} max={20000} value={s.messages.max_length} disabled={!can("messages")} onChange={(v) => set("messages", "max_length", v)} />
            <Num label={tx("Max. berichten per minuut per user")} min={1} max={120} value={s.messages.rate_per_minute} disabled={!can("messages")} onChange={(v) => set("messages", "rate_per_minute", v)} />
          </div>
          <small className="muted">{tx("Berichten gaan door het woordfilter van Beveiliging. De ontvanger krijgt een e-mailmelding via je Communicatie-instellingen (sandbox-postvak als de sandbox aan staat).")}</small>
        </Collapsible>
      )}

      {show("profiles") && (
        <Collapsible id="comm-fields" title={tx("Profielthema en velden")}>
          <ProfileFieldsAdmin prof={s.profiles} can={can("profiles")} themes={d.themes} builtinLabels={d.builtin_labels}
            setProf={(patch) => setD({ ...d, settings: { ...s, profiles: { ...s.profiles, ...patch } } })}
            onThemeApplied={(r) => { setD({ ...d, settings: r.settings, themes: r.themes }); setMsg({ ok: true, text: tx("Thema toegepast.") }); }} />
        </Collapsible>
      )}

      {show("profiles") && (
        <Collapsible id="comm-profiles" title={tx("Profielen en blokkeren")}>
          <div className="theme-grid">
            <Num label={tx("Max. aantal foto's per profiel")} min={1} max={30} value={s.profiles.max_photos} disabled={!can("profiles")} onChange={(v) => set("profiles", "max_photos", v)} />
            <label>{tx("Standaard zichtbaarheid van een nieuw profiel")}
              <select value={s.profiles.default_visibility} disabled={!can("profiles")} onChange={(e) => set("profiles", "default_visibility", e.target.value)}>
                <option value="members">{tx("Alleen leden")}</option><option value="friends">{tx("Alleen vrienden")}</option><option value="selected">{tx("Alleen geselecteerde leden")}</option><option value="public">{tx("Iedereen")}</option>
              </select>
            </label>
          </div>
          <div className="theme-grid">
            <Num label={tx("Max. afgeschermde (wazige) foto's per profiel")} min={0} max={30} value={s.profiles.max_private_photos} disabled={!can("profiles")} onChange={(v) => set("profiles", "max_private_photos", v)} />
            <Num label={tx("Geweigerd verzoek opnieuw mogelijk na")} hint={tx("dagen, 0 = direct")} min={0} max={365} value={s.profiles.decline_days} disabled={!can("profiles")} onChange={(v) => set("profiles", "decline_days", v)} />
          </div>
          <Sw label={tx("Users mogen foto's afschermen (wazig voor anderen)")} hint={tx("Zichtbaar na akkoord van de eigenaar of als jullie vrienden zijn")} checked={s.profiles.private_photos} disabled={!can("profiles")} onChange={(v) => set("profiles", "private_photos", v)} />
          <Sw label={tx("Verzoeken toestaan")} hint={tx("vriend worden, foto's of profiel bekijken; de eigenaar accepteert of weigert")} checked={s.profiles.requests_enabled} disabled={!can("profiles")} onChange={(v) => set("profiles", "requests_enabled", v)} />
          <small className="muted">{tx("Users blokkeren elkaar zelf (Community → Geblokkeerd). Een geblokkeerde user kan de ander niet zien, vinden, berichten of chatten. Superadmins zien altijd alles.")}</small>
        </Collapsible>
      )}
    </>
  );
}

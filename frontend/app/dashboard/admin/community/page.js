"use client";

import { tx } from "../../../../lib/t";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import { useModules } from "../../../../components/Modules";
import ProfileFieldsAdmin from "../../../../components/ProfileFieldsAdmin";
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

      {show("chat") && (
        <Collapsible id="comm-chat" title={tx("Chat")}>
          <strong>{tx("Hoe werkt de chat?")}</strong>
          <div className="vis-options">
            <label className={`card vis ${s.chat.method === "portal" ? "active" : ""}`}>
              <input type="radio" name="method" disabled={!can("chat")} checked={s.chat.method === "portal"} onChange={() => set("chat", "method", "portal")} />
              <span><strong>{tx("Online via de portal")}</strong><small className="muted"> {tx("Berichten en bestanden gaan via de server, worden bewaard en komen ook aan als de ander later inlogt.")}</small></span>
            </label>
            <label className={`card vis ${s.chat.method === "webrtc" ? "active" : ""}`}>
              <input type="radio" name="method" disabled={!can("chat")} checked={s.chat.method === "webrtc"} onChange={() => set("chat", "method", "webrtc")} />
              <span><strong>{tx("Directe verbinding tussen apparaten (WebRTC)")}</strong><small className="muted"> {tx("Berichten en bestanden gaan rechtstreeks van device naar device. De server regelt alleen het opzetten van de verbinding en bewaart niets. Beide mensen moeten online zijn.")}</small></span>
            </label>
          </div>
          <div className="theme-grid">
            <label>{tx("Weergave")}
              <select value={s.chat.display} disabled={!can("chat")} onChange={(e) => set("chat", "display", e.target.value)}>
                <option value="both">{tx("Popup én eigen scherm")}</option><option value="popup">{tx("Alleen popup (rechtsonder)")}</option><option value="page">{tx("Alleen in het scherm (Community → Chat)")}</option>
              </select>
            </label>
          </div>
          <h3>{tx("Waar en hoe de chat verschijnt")}</h3>
          <div className="theme-grid">
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
          <h3>{tx("Wat mag er gedeeld worden")}</h3>
          <Sw label={tx("Foto's delen")} checked={s.chat.photos} disabled={!can("chat")} onChange={(v) => set("chat", "photos", v)} />
          <Sw label={tx("Video's delen")} checked={s.chat.videos} disabled={!can("chat")} onChange={(v) => set("chat", "videos", v)} />
          <Sw label={tx("Videochat")} hint={tx("Gebruikt altijd een directe WebRTC-verbinding, ook als de berichten via de portal gaan.")} checked={s.chat.video_chat} disabled={!can("chat")} onChange={(v) => set("chat", "video_chat", v)} />
          <div className="theme-grid">
            <Num label={tx("Max. grootte foto")} hint="MB" min={1} max={50} value={s.chat.max_image_mb} disabled={!can("chat")} onChange={(v) => set("chat", "max_image_mb", v)} />
            <Num label={tx("Uitnodiging (directe verbinding) geldig")} hint="uren" min={1} max={72} value={s.chat.direct_hours} disabled={!can("chat")} onChange={(v) => set("chat", "direct_hours", v)} />
            <Num label={tx("Max. grootte video")} hint="MB" min={1} max={500} value={s.chat.max_video_mb} disabled={!can("chat")} onChange={(v) => set("chat", "max_video_mb", v)} />
          </div>
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
        </Collapsible>
      )}

      {show("discover") && (
        <Collapsible id="comm-discover" title={tx("Zoeken & matchen")}>
          <h3>{tx("Wie doet mee")}</h3>
          <div className="theme-grid">
            <Num label={tx("Minimumleeftijd")} hint="jaar" min={13} max={99} value={s.discover.min_age} disabled={!can("discover")} onChange={(v) => set("discover", "min_age", v)} />
            <Num label={tx("Maximumleeftijd")} hint="jaar" min={18} max={120} value={s.discover.max_age} disabled={!can("discover")} onChange={(v) => set("discover", "max_age", v)} />
            <Num label={tx("Minimaal aantal foto's om mee te doen")} hint={tx("0 = geen eis")} min={0} max={5} value={s.discover.require_photo} disabled={!can("discover")} onChange={(v) => set("discover", "require_photo", v)} />
          </div>
          <Sw label={tx("Zoeken alleen voor leden die zelf meedoen")} hint={tx("Uit = ieder lid met een actief profiel mag zoeken.")} checked={s.discover.require_to_search} disabled={!can("discover")} onChange={(v) => set("discover", "require_to_search", v)} />
          <Sw label={tx("Leuk vinden alleen voor leden die zelf meedoen")} checked={s.discover.require_to_like} disabled={!can("discover")} onChange={(v) => set("discover", "require_to_like", v)} />
          <Sw label={tx("Ook leden die niet meedoen zijn te vinden")} hint={tx("Uit = alleen deelnemers komen in de resultaten.")} checked={s.discover.show_non_participants} disabled={!can("discover")} onChange={(v) => set("discover", "show_non_participants", v)} />

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

          <h3>{tx("Overzichten en meldingen")}</h3>
          <Sw label={tx("Bezoekers van je profiel tonen")} checked={s.discover.show_visitors} disabled={!can("discover")} onChange={(v) => set("discover", "show_visitors", v)} />
          {s.discover.show_visitors && <Num label={tx("Bezoekers bewaren")} hint="dagen" min={1} max={365} value={s.discover.visitors_days} disabled={!can("discover")} onChange={(v) => set("discover", "visitors_days", v)} />}
          <Sw label={tx("Overzicht 'Vonden mij leuk'")} hint={tx("Uit = leden zien alleen wederzijdse matches.")} checked={s.discover.show_likes_received} disabled={!can("discover")} onChange={(v) => set("discover", "show_likes_received", v)} />
          <Sw label={tx("E-mail bij een nieuwe match")} checked={s.discover.match_email} disabled={!can("discover")} onChange={(v) => set("discover", "match_email", v)} />
          <small className="muted">{tx("Leden doen zelf mee via hun profiel (geboortedatum nodig). Een zoeker ziet alleen profielen die hij mag zien volgens zichtbaarheid, taal en blokkades.")}</small>
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
                <option value="members">{tx("Alleen leden")}</option><option value="selected">{tx("Alleen geselecteerde leden")}</option><option value="public">{tx("Iedereen")}</option>
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import { useModules } from "../../../../components/Modules";
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
  if (!d) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">Laden…</p>;

  const s = d.settings, lv = d.sections;
  const set = (sec, k, v) => setD({ ...d, settings: { ...s, [sec]: { ...s[sec], [k]: v } } });
  const show = (sec) => mods[sec] !== false && lv[sec] >= 1;
  const can = (sec) => lv[sec] >= 2;
  async function save() {
    const body = Object.fromEntries(Object.keys(lv).filter((k) => can(k)).map((k) => [k, s[k]]));
    try { setD(await api("/community/settings/", { method: "PUT", body })); setMsg({ ok: true, text: "Community-instellingen opgeslagen." }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Community</h1>
          <p className="muted" style={{ margin: 0 }}>Instellingen voor profielen, berichten en chat. Members gebruiken ze via hun eigen dashboard (Community).</p>
        </div>
        <div className="row"><CollapseAll /><button className="btn primary" onClick={save}>Opslaan</button></div>
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <div className="cards" style={{ marginBottom: "1rem", marginTop: 0 }}>
        <div className="card stat"><span>Actieve profielen</span><strong>{d.counts.profiles}</strong></div>
        <div className="card stat"><span>Berichten</span><strong>{d.counts.messages}</strong></div>
        <div className="card stat"><span>Chatberichten (portal)</span><strong>{d.counts.chat_messages}</strong></div>
        <div className="card stat"><span>Blokkades</span><strong>{d.counts.blocks}</strong></div>
        <div className="card stat"><span>Nu online</span><strong>{d.counts.online}</strong></div>
      </div>

      {show("chat") && (
        <Collapsible id="comm-chat" title="Chat">
          <strong>Hoe werkt de chat?</strong>
          <div className="vis-options">
            <label className={`card vis ${s.chat.method === "portal" ? "active" : ""}`}>
              <input type="radio" name="method" disabled={!can("chat")} checked={s.chat.method === "portal"} onChange={() => set("chat", "method", "portal")} />
              <span><strong>Online via de portal</strong><small className="muted"> Berichten en bestanden gaan via de server, worden bewaard en komen ook aan als de ander later inlogt.</small></span>
            </label>
            <label className={`card vis ${s.chat.method === "webrtc" ? "active" : ""}`}>
              <input type="radio" name="method" disabled={!can("chat")} checked={s.chat.method === "webrtc"} onChange={() => set("chat", "method", "webrtc")} />
              <span><strong>Directe verbinding tussen apparaten (WebRTC)</strong><small className="muted"> Berichten en bestanden gaan rechtstreeks van device naar device. De server regelt alleen het opzetten van de verbinding en bewaart niets. Beide mensen moeten online zijn.</small></span>
            </label>
          </div>
          <div className="theme-grid">
            <label>Weergave
              <select value={s.chat.display} disabled={!can("chat")} onChange={(e) => set("chat", "display", e.target.value)}>
                <option value="both">Popup én eigen scherm</option><option value="popup">Alleen popup (rechtsonder)</option><option value="page">Alleen in het scherm (Community → Chat)</option>
              </select>
            </label>
          </div>
          <h3>Waar en hoe de chat verschijnt</h3>
          <div className="theme-grid">
            <label>Hoe opent de chat
              <select value={s.chat.style} disabled={!can("chat")} onChange={(e) => set("chat", "style", e.target.value)}>
                <option value="floating">Zwevende knop (rechts- of linksonder)</option>
                <option value="button">Knop in de header</option>
              </select>
            </label>
          </div>
          <strong style={{ fontSize: ".85rem" }}>Waar is de chat beschikbaar</strong>
          <div className="perm-list">
            {[["home", "Homepage"], ["website", "Overige websitepagina's"], ["dashboard", "Dashboard van users"], ["backend", "Beheer (Admin en Super admin)"]].map(([k, l]) => (
              <label className="check" key={k} style={{ fontWeight: 500 }}>
                <input type="checkbox" disabled={!can("chat")} checked={s.chat.show_on.includes(k)} onChange={() => set("chat", "show_on", s.chat.show_on.includes(k) ? s.chat.show_on.filter((x) => x !== k) : [...s.chat.show_on, k])} /> {l}
              </label>
            ))}
          </div>
          <small className="muted">Kleur, formaat, positie en uiterlijk van de knop en popup stel je in bij <a href="/dashboard/admin/theme" style={{ color: "var(--blue)" }}>Vormgeving → Chat-weergave</a>.</small>
          <h3>Wat mag er gedeeld worden</h3>
          <Sw label="Foto's delen" checked={s.chat.photos} disabled={!can("chat")} onChange={(v) => set("chat", "photos", v)} />
          <Sw label="Video's delen" checked={s.chat.videos} disabled={!can("chat")} onChange={(v) => set("chat", "videos", v)} />
          <Sw label="Videochat" hint="Gebruikt altijd een directe WebRTC-verbinding, ook als de berichten via de portal gaan." checked={s.chat.video_chat} disabled={!can("chat")} onChange={(v) => set("chat", "video_chat", v)} />
          <div className="theme-grid">
            <Num label="Max. grootte foto" hint="MB" min={1} max={50} value={s.chat.max_image_mb} disabled={!can("chat")} onChange={(v) => set("chat", "max_image_mb", v)} />
            <Num label="Uitnodiging (directe verbinding) geldig" hint="uren" min={1} max={72} value={s.chat.direct_hours} disabled={!can("chat")} onChange={(v) => set("chat", "direct_hours", v)} />
            <Num label="Max. grootte video" hint="MB" min={1} max={500} value={s.chat.max_video_mb} disabled={!can("chat")} onChange={(v) => set("chat", "max_video_mb", v)} />
          </div>
          <h3>Verbinding (WebRTC en videochat)</h3>
          <label>STUN-servers <small className="muted">één per regel, bv. stun:stun.l.google.com:19302</small>
            <textarea rows={2} disabled={!can("chat")} value={s.chat.stun.join("\n")} onChange={(e) => set("chat", "stun", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
          </label>
          <div className="theme-grid">
            <label>TURN-server <small className="muted">optioneel, nodig achter strenge firewalls</small><input value={s.chat.turn_url} placeholder="turn:turn.voorbeeld.nl:3478" disabled={!can("chat")} onChange={(e) => set("chat", "turn_url", e.target.value)} /></label>
            <label>TURN-gebruikersnaam<input value={s.chat.turn_user} disabled={!can("chat")} onChange={(e) => set("chat", "turn_user", e.target.value)} /></label>
            <label>TURN-wachtwoord<input type="password" value={s.chat.turn_credential} disabled={!can("chat")} onChange={(e) => set("chat", "turn_credential", e.target.value)} autoComplete="off" /></label>
          </div>
          <small className="muted">Ingelogde users ontvangen deze serverlijst om de verbinding op te zetten. Het standaard STUN-adres is een publieke dienst van Google.</small>
        </Collapsible>
      )}

      {show("discover") && (
        <Collapsible id="comm-discover" title="Zoeken & matchen">
          <h3>Wie doet mee</h3>
          <div className="theme-grid">
            <Num label="Minimumleeftijd" hint="jaar" min={13} max={99} value={s.discover.min_age} disabled={!can("discover")} onChange={(v) => set("discover", "min_age", v)} />
            <Num label="Maximumleeftijd" hint="jaar" min={18} max={120} value={s.discover.max_age} disabled={!can("discover")} onChange={(v) => set("discover", "max_age", v)} />
            <Num label="Minimaal aantal foto's om mee te doen" hint="0 = geen eis" min={0} max={5} value={s.discover.require_photo} disabled={!can("discover")} onChange={(v) => set("discover", "require_photo", v)} />
          </div>
          <Sw label="Zoeken alleen voor leden die zelf meedoen" hint="Uit = ieder lid met een actief profiel mag zoeken." checked={s.discover.require_to_search} disabled={!can("discover")} onChange={(v) => set("discover", "require_to_search", v)} />
          <Sw label="Leuk vinden alleen voor leden die zelf meedoen" checked={s.discover.require_to_like} disabled={!can("discover")} onChange={(v) => set("discover", "require_to_like", v)} />
          <Sw label="Ook leden die niet meedoen zijn te vinden" hint="Uit = alleen deelnemers komen in de resultaten." checked={s.discover.show_non_participants} disabled={!can("discover")} onChange={(v) => set("discover", "show_non_participants", v)} />

          <h3>Zoeken</h3>
          <div className="theme-grid">
            <Num label="Max. aantal zoekresultaten" min={10} max={200} value={s.discover.max_results} disabled={!can("discover")} onChange={(v) => set("discover", "max_results", v)} />
            <label>Standaard sortering
              <select value={s.discover.default_sort} disabled={!can("discover")} onChange={(e) => set("discover", "default_sort", e.target.value)}>
                <option value="active">Laatst actief</option><option value="newest">Nieuwste eerst</option><option value="distance">Dichtstbij</option>
              </select>
            </label>
          </div>
          <Sw label="Tab 'Voor jou' (aanbevelingen)" hint="Op basis van wie je zoekt, leeftijdsvoorkeuren en gedeelde interesses." checked={s.discover.suggestions} disabled={!can("discover")} onChange={(v) => set("discover", "suggestions", v)} />

          <h3>Afstand</h3>
          <Sw label="Zoeken op afstand" hint="De plaats van een lid wordt omgezet naar een plek op de kaart (afgerond op ongeveer 1 km)." checked={s.discover.distance_enabled} disabled={!can("discover")} onChange={(v) => set("discover", "distance_enabled", v)} />
          {s.discover.distance_enabled && (
            <div className="theme-grid">
              <label>Afstandskeuzes <small className="muted">km, gescheiden door komma's</small>
                <input defaultValue={s.discover.radii.join(", ")} disabled={!can("discover")} onBlur={(e) => set("discover", "radii", e.target.value.split(",").map((x) => Number(x.trim())).filter((x) => x > 0))} />
              </label>
              <Num label="Maximale afstand" hint="km" min={5} max={2000} value={s.discover.max_distance_km} disabled={!can("discover")} onChange={(v) => set("discover", "max_distance_km", v)} />
              <label>Contactadres voor de plaatsdienst <small className="muted">verplicht volgens de gebruiksregels van OpenStreetMap</small>
                <input value={s.discover.geocoder_contact} placeholder="info@jouwdomein.nl" disabled={!can("discover")} onChange={(e) => set("discover", "geocoder_contact", e.target.value)} />
              </label>
            </div>
          )}
          <small className="muted">Plaatsen worden opgezocht bij OpenStreetMap Nominatim (de plaatsnaam gaat naar die dienst; noem dat in je privacybeleid). Staat de sandbox aan, dan wordt de plaats gesimuleerd.</small>

          <h3>Overzichten en meldingen</h3>
          <Sw label="Bezoekers van je profiel tonen" checked={s.discover.show_visitors} disabled={!can("discover")} onChange={(v) => set("discover", "show_visitors", v)} />
          {s.discover.show_visitors && <Num label="Bezoekers bewaren" hint="dagen" min={1} max={365} value={s.discover.visitors_days} disabled={!can("discover")} onChange={(v) => set("discover", "visitors_days", v)} />}
          <Sw label="Overzicht 'Vonden mij leuk'" hint="Uit = leden zien alleen wederzijdse matches." checked={s.discover.show_likes_received} disabled={!can("discover")} onChange={(v) => set("discover", "show_likes_received", v)} />
          <Sw label="E-mail bij een nieuwe match" checked={s.discover.match_email} disabled={!can("discover")} onChange={(v) => set("discover", "match_email", v)} />
          <small className="muted">Leden doen zelf mee via hun profiel (geboortedatum nodig). Een zoeker ziet alleen profielen die hij mag zien volgens zichtbaarheid, taal en blokkades.</small>
        </Collapsible>
      )}

      {show("messages") && (
        <Collapsible id="comm-messages" title="Berichten">
          <div className="theme-grid">
            <Num label="Maximale lengte van een bericht" hint="tekens" min={100} max={20000} value={s.messages.max_length} disabled={!can("messages")} onChange={(v) => set("messages", "max_length", v)} />
            <Num label="Max. berichten per minuut per user" min={1} max={120} value={s.messages.rate_per_minute} disabled={!can("messages")} onChange={(v) => set("messages", "rate_per_minute", v)} />
          </div>
          <small className="muted">Berichten gaan door het woordfilter van Beveiliging. De ontvanger krijgt een e-mailmelding via je Communicatie-instellingen (sandbox-postvak als de sandbox aan staat).</small>
        </Collapsible>
      )}

      {show("profiles") && (
        <Collapsible id="comm-profiles" title="Profielen en blokkeren">
          <div className="theme-grid">
            <Num label="Max. aantal foto's per profiel" min={1} max={30} value={s.profiles.max_photos} disabled={!can("profiles")} onChange={(v) => set("profiles", "max_photos", v)} />
            <label>Standaard zichtbaarheid van een nieuw profiel
              <select value={s.profiles.default_visibility} disabled={!can("profiles")} onChange={(e) => set("profiles", "default_visibility", e.target.value)}>
                <option value="members">Alleen leden</option><option value="selected">Alleen geselecteerde leden</option><option value="public">Iedereen</option>
              </select>
            </label>
          </div>
          <div className="theme-grid">
            <Num label="Max. afgeschermde (wazige) foto's per profiel" min={0} max={30} value={s.profiles.max_private_photos} disabled={!can("profiles")} onChange={(v) => set("profiles", "max_private_photos", v)} />
            <Num label="Geweigerd verzoek opnieuw mogelijk na" hint="dagen, 0 = direct" min={0} max={365} value={s.profiles.decline_days} disabled={!can("profiles")} onChange={(v) => set("profiles", "decline_days", v)} />
          </div>
          <Sw label="Users mogen foto's afschermen (wazig voor anderen)" hint="Zichtbaar na akkoord van de eigenaar of als jullie vrienden zijn" checked={s.profiles.private_photos} disabled={!can("profiles")} onChange={(v) => set("profiles", "private_photos", v)} />
          <Sw label="Verzoeken toestaan" hint="vriend worden, foto's of profiel bekijken; de eigenaar accepteert of weigert" checked={s.profiles.requests_enabled} disabled={!can("profiles")} onChange={(v) => set("profiles", "requests_enabled", v)} />
          <small className="muted">Users blokkeren elkaar zelf (Community → Geblokkeerd). Een geblokkeerde user kan de ander niet zien, vinden, berichten of chatten. Superadmins zien altijd alles.</small>
        </Collapsible>
      )}
    </>
  );
}

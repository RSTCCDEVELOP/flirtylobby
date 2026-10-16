"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useChat } from "../../../../components/Chat";
import { useModules } from "../../../../components/Modules";
import { api, errorText, mediaUrl } from "../../../../lib/api";

const TABS = [
  ["suggested", "Voor jou"], ["search", "Zoeken"], ["matches", "Matches"], ["liked", "Ik vond leuk"],
  ["likedme", "Vonden mij leuk"], ["favorites", "Favorieten"], ["visitors", "Bezoekers"],
];
const AIMS = { dating: "Daten", relationship: "Relatie", friends: "Vriendschap", chat: "Chatten" };
const GENDER = { m: "Man", f: "Vrouw", x: "Anders" };
const EMPTY = { gender: "", age_min: "", age_max: "", city: "", country: "", interest: "", aim: "", online: false, photo: false, q: "", distance_km: "", sort: "" };

function Card({ m, onChange }) {
  const chat = useChat();
  const [busy, setBusy] = useState(false);
  const act = async (fn) => { setBusy(true); try { await fn(); await onChange(); } catch (e) { alert(errorText(e)); } setBusy(false); };
  return (
    <div className="card member-card">
      <Link href={`/leden/${m.slug}`} className="pimg" style={{ display: "block", position: "relative" }}>
        {m.photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(m.photo)} alt={m.name} /> : <span className="muted" style={{ display: "grid", placeItems: "center", height: "100%" }}>Geen foto</span>}
        {m.online && <span className="badge ok" style={{ position: "absolute", top: 8, left: 8 }}>Online</span>}
        {m.match && <span className="badge ok" style={{ position: "absolute", top: 8, right: 8, background: "var(--blue)", color: "#fff" }}>Match ♥</span>}
      </Link>
      <div className="pbody">
        <Link href={`/leden/${m.slug}`}><strong>{m.name}{m.age ? `, ${m.age}` : ""}</strong></Link>
        <span className="muted" style={{ fontSize: ".85rem" }}>{[GENDER[m.gender], m.city, m.distance_km ? `${m.distance_km} km` : null, AIMS[m.aim]].filter(Boolean).join(" · ")}</span>
        {m.headline && <span style={{ fontSize: ".875rem" }}>{m.headline}</span>}
        {m.interests.length > 0 && <span className="chips" style={{ margin: ".25rem 0" }}>{m.interests.map((t) => <span key={t} className="chip" style={{ cursor: "default", fontSize: ".75rem" }}>{t}</span>)}</span>}
        <div className="row" style={{ justifyContent: "flex-start", gap: ".35rem" }}>
          <button className={`btn sm ${m.liked ? "primary" : ""}`} disabled={busy} title="Leuk vinden" onClick={() => act(() => (m.liked ? api(`/discover/like/${m.id}/`, { method: "DELETE" }) : api("/discover/like/", { method: "POST", body: { user: m.id } })))}>{m.liked ? "♥ Leuk" : "♡ Leuk"}</button>
          <button className="btn sm" disabled={busy} title="Favoriet" onClick={() => act(() => api(`/discover/favorite/${m.id}/`, { method: m.favorite ? "DELETE" : "POST" }))}>{m.favorite ? "★" : "☆"}</button>
          {m.accept_messages && <Link className="btn sm" href="/dashboard/community/messages" title="Bericht">✉</Link>}
          {m.accept_chat && chat?.cfg && <button className="btn sm" title="Chat" onClick={() => { chat.openPartner({ id: m.id, name: m.name }); chat.setWidgetOpen(true); }}>💬</button>}
        </div>
      </div>
    </div>
  );
}

export default function Discover() {
  const mods = useModules();
  const [tab, setTab] = useState("suggested");
  const [f, setF] = useState(EMPTY);
  const [data, setData] = useState(null);
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [cfg, setCfg] = useState(null);
  useEffect(() => { api("/community/config/").then((d) => { setCfg(d.discover); if (d.discover && !d.discover.suggestions) setTab("search"); }).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setErr("");
    try {
      if (tab === "suggested" || tab === "search") {
        let lang = "";
        try { lang = localStorage.getItem("lang") || ""; } catch {}
        const p = new URLSearchParams(Object.entries({ ...(tab === "search" ? f : {}), mode: tab === "suggested" ? "suggested" : "", lang }).map(([k, v]) => [k, v === true ? "1" : v === false ? "" : v]).filter(([, v]) => v));
        const d = await api(`/discover/search/?${p}`);
        setData(d); setList(d.results);
      } else setList(await api(`/discover/lists/?kind=${tab}`));
    } catch (e) { setErr(errorText(e)); setList([]); }
  }, [tab, f]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  if (mods.discover === false) return <p className="muted">Zoeken & matchen staat uit.</p>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  return (
    <>
      <h1>Zoeken & matchen</h1>
      <p className="muted">Vind andere leden, geef een hartje, en bij wederzijds hartje is het een match.</p>
      {data?.locked && <div className="alert" style={{ marginBottom: "1rem" }}>Zoeken is alleen voor leden die zelf meedoen. <Link href="/dashboard/community/profile" style={{ textDecoration: "underline" }}>Doe mee via je profiel</Link>.</div>}
      {data && !data.locked && !data.participating && (
        <div className="alert" style={{ marginBottom: "1rem" }}>Je doet zelf nog niet mee. <Link href="/dashboard/community/profile" style={{ textDecoration: "underline" }}>Zet je profiel aan en kies "Zoeken & matchen"</Link> om gevonden te worden en leuk te kunnen vinden.</div>
      )}
      <div className="tabs">
        {TABS.filter(([k]) => !cfg || (k !== "suggested" || cfg.suggestions) && (k !== "visitors" || cfg.show_visitors) && (k !== "likedme" || cfg.show_likes_received)).map(([k, label]) => <button key={k} className={`btn sm ${tab === k ? "primary" : ""}`} onClick={() => { setTab(k); setList(null); }}>{label}</button>)}
      </div>
      {tab === "search" && (
        <div className="card" style={{ margin: "1rem 0" }}>
          <div className="theme-grid">
            <label>Naam of tekst<input value={f.q} onChange={set("q")} /></label>
            <label>Geslacht<select value={f.gender} onChange={set("gender")}><option value="">Maakt niet uit</option>{Object.entries(GENDER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Leeftijd van<input type="number" min={18} max={99} value={f.age_min} onChange={set("age_min")} /></label>
            <label>Leeftijd tot<input type="number" min={18} max={99} value={f.age_max} onChange={set("age_max")} /></label>
            <label>Plaats<input value={f.city} onChange={set("city")} /></label>
            <label>Land (code)<input value={f.country} maxLength={2} onChange={set("country")} placeholder="NL" /></label>
            <label>Interesse<input value={f.interest} onChange={set("interest")} placeholder="bv. wandelen" /></label>
            {cfg?.distance_enabled && <label>Binnen<select value={f.distance_km} onChange={set("distance_km")}><option value="">Overal</option>{cfg.radii.map((r) => <option key={r} value={r}>{r} km</option>)}</select></label>}
            <label>Sorteren<select value={f.sort} onChange={set("sort")}><option value="">Standaard</option><option value="active">Laatst actief</option><option value="newest">Nieuwste</option>{cfg?.distance_enabled && <option value="distance">Dichtstbij</option>}</select></label>
            <label>Zoekt<select value={f.aim} onChange={set("aim")}><option value="">Alles</option>{Object.entries(AIMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <div className="row" style={{ justifyContent: "flex-start", marginTop: ".75rem" }}>
            <label className="check"><input type="checkbox" checked={f.online} onChange={set("online")} /> Nu online</label>
            <label className="check"><input type="checkbox" checked={f.photo} onChange={set("photo")} /> Met foto</label>
            <button className="btn sm" onClick={() => setF(EMPTY)}>Wissen</button>
          </div>
        </div>
      )}
      {err && <div className="alert" style={{ margin: "1rem 0" }}>{err}</div>}
      <div className="product-grid" style={{ marginTop: "1rem" }}>
        {(list || []).map((m) => <Card key={m.id} m={m} onChange={load} />)}
      </div>
      {list && !list.length && !err && <p className="muted" style={{ marginTop: "1rem" }}>
        {tab === "suggested" ? "Nog geen aanbevelingen. Vul je geboortedatum, geslacht en voorkeuren in op je profiel." : "Niets gevonden."}
      </p>}
    </>
  );
}

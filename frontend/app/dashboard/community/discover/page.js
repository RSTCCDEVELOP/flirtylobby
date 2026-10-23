// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../../../../lib/t";
import { IconChat, IconHeart, IconMail, IconStar } from "../../../../components/Icons";
import { alertDialog } from "../../../../lib/dialog";
import { cardFieldsText } from "../../../../components/ProfileFields";
import Swiper from "../../../../components/Swiper";
import { AvailChips, AvailPicker, useAvailability } from "../../../../components/Availability";
import VerifyBadge from "../../../../components/VerifyBadge";
import Tabs from "../../../../components/Tabs";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useChat } from "../../../../components/Chat";
import { useModules } from "../../../../components/Modules";
import ModuleOff from "../../../../components/ModuleOff";
import { api, errorText, mediaUrl } from "../../../../lib/api";
import { GENDER_LABELS, useGenders } from "../../../../lib/genders";

const TABS = [
  ["swipe", "Swipen"], ["suggested", "Voor jou"], ["search", "Zoeken"], ["matches", "Matches"], ["liked", "Ik vond leuk"],
  ["likedme", "Vonden mij leuk"], ["favorites", "Favorieten"], ["visitors", "Bezoekers"],
];
const AIMS = { dating: "Daten", relationship: "Relatie", friends: "Vriendschap", chat: "Chatten", appointments: "Afspraakjes", erotic: "Erotiek", activities: "Samen op pad", travel: "Reisgenoot" }; // labels of every kind; the filter only offers the switched-on ones
const GENDER = GENDER_LABELS;
const EMPTY = { available: "", gender: "", age_min: "", age_max: "", city: "", country: "", interest: "", aim: "", online: false, photo: false, q: "", distance_km: "", sort: "" };

function Card({ m, onChange }) {
  const chat = useChat();
  const [busy, setBusy] = useState(false);
  const act = async (fn) => { setBusy(true); try { await fn(); await onChange(); } catch (e) { (await alertDialog(errorText(e))); } setBusy(false); };
  return (
    <div className="card member-card" data-g={m.gender || undefined}>
      <Link href={`/leden/${m.slug}`} className="pimg" style={{ display: "block", position: "relative" }}>
        {m.photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(m.photo)} alt={m.name} /> : <span className="muted" style={{ display: "grid", placeItems: "center", height: "100%" }}>{tx("Geen foto")}</span>}
        {m.online && <span className="badge ok" style={{ position: "absolute", top: 8, left: 8 }}>{tx("Online")}</span>}
        {m.match && <span className="badge ok" style={{ position: "absolute", top: 8, right: 8, background: "var(--blue)", color: "#fff" }}>{tx("Match")} <IconHeart fill="currentColor" width={13} height={13} /></span>}
      </Link>
      <div className="pbody">
        <Link href={`/leden/${m.slug}`}><strong>{m.name}{m.age ? `, ${m.age}` : ""} <VerifyBadge status={m.verification} size={16} /></strong></Link>
        <span className="muted" style={{ fontSize: ".85rem" }}>{[GENDER[m.gender], m.city, m.distance_km ? `${m.distance_km} km` : null, AIMS[m.aim]].filter(Boolean).join(" · ")}</span>
        {m.headline && <span style={{ fontSize: ".875rem" }}>{m.headline}</span>}
        {m.card_fields?.length > 0 && <span style={{ fontSize: ".8rem" }}>{cardFieldsText(m.card_fields)}</span>}
        <AvailChips items={m.available} />
        {m.interests.length > 0 && <span className="chips" style={{ margin: ".25rem 0" }}>{m.interests.map((t) => <span key={t} className="chip" style={{ cursor: "default", fontSize: ".75rem" }}>{t}</span>)}</span>}
        <div className="row" style={{ justifyContent: "flex-start", gap: ".35rem" }}>
          <button className={`btn sm ${m.liked ? "primary" : ""}`} disabled={busy} title={tx("Leuk vinden")} onClick={() => act(() => (m.liked ? api(`/discover/like/${m.id}/`, { method: "DELETE" }) : api("/discover/like/", { method: "POST", body: { user: m.id } })))}><IconHeart fill={m.liked ? "currentColor" : "none"} /> {tx("Leuk")}</button>
          <button className="btn sm" disabled={busy} title={tx("Favoriet")} onClick={() => act(() => api(`/discover/favorite/${m.id}/`, { method: m.favorite ? "DELETE" : "POST" }))}><IconStar fill={m.favorite ? "currentColor" : "none"} /></button>
          {m.accept_messages && <Link className="btn sm" href="/dashboard/community/messages" title={tx("Bericht")} aria-label={tx("Bericht")}><IconMail /></Link>}
          {m.accept_chat && chat?.cfg && <button className="btn sm" title={tx("Chat")} onClick={() => { chat.openPartner({ id: m.id, name: m.name }); chat.setWidgetOpen(true); }} aria-label={tx("Chat")}><IconChat /></button>}
        </div>
      </div>
    </div>
  );
}

export default function Discover() {
  const genders = useGenders();
  const mods = useModules();
  const [tab, setTab] = useState("suggested");
  const [pageTitle, setPageTitle] = useState("");
  const [f, setF] = useState(EMPTY);
  const [ftab, setFtab] = useState("general"); // the search filters in tabs
  const [data, setData] = useState(null);
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [cfg, setCfg] = useState(null);
  const availGroups = useAvailability();
  const [pcfg, setPcfg] = useState(null); // profile theme: built-in fields on/off + configurable fields
  const [search, setSearch] = useState(null); // per profile type: title + which filters show, swipe deck on/off
  useEffect(() => {
    api("/community/config/").then((d) => {
      setCfg(d.discover); setPcfg(d.profile); setSearch(d.search); setPageTitle(d.search?.title || "");
      const want = new URLSearchParams(window.location.search).get("tab");
      if (want) setTab(want);
      else if (d.discover?.swipe) setTab("swipe");
      else if (d.discover && !d.discover.suggestions) setTab("search");
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setErr("");
    try {
      if (tab === "swipe") return;
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

  if (mods.discover === false) return <ModuleOff plugin="community" label={tx("Zoeken & matchen")}>{tx("Zoeken & matchen staat uit.")}</ModuleOff>;
  const on = (b) => pcfg?.builtin?.[b] !== false;
  const show = (id) => !search?.filters || search.filters.includes(id); // filters that belong to this profile type
  const cnt = (keys) => { const n = keys.filter((k) => f[k] && f[k] !== "0").length; return n || null; }; // how many filters of a tab are filled in
  const hasLoc = (on("city") && (show("city") || show("country"))) || (cfg?.distance_enabled && show("distance"));
  const hasProfile = (on("interests") && show("interest")) || (on("aim") && show("aim")) || (pcfg?.fields || []).some((x) => x.filter);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  return (
    <>
      <h1>{tx(pageTitle || "Zoeken & matchen")}</h1>
      <p className="muted">{tx("Vind andere leden, geef een hartje, en bij wederzijds hartje is het een match.")}</p>
      {data?.locked && <div className="alert" style={{ marginBottom: "1rem" }}>{tx("Zoeken is alleen voor leden die zelf meedoen.")} <Link href="/dashboard/community/profile" style={{ textDecoration: "underline" }}>{tx("Doe mee via je profiel")}</Link>.</div>}
      {data && !data.locked && !data.participating && (
        <div className="alert" style={{ marginBottom: "1rem" }}>{tx("Je doet zelf nog niet mee.")} <Link href="/dashboard/community/profile" style={{ textDecoration: "underline" }}>{tx("Zet je profiel aan en kies \"Zoeken & matchen\"")}</Link> {tx("om gevonden te worden en leuk te kunnen vinden.")}</div>
      )}
      <div className="tabs tabset">
        {TABS.filter(([k]) => !cfg || (k !== "swipe" || cfg.swipe) && (k !== "suggested" || cfg.suggestions) && (k !== "visitors" || cfg.show_visitors) && (k !== "likedme" || cfg.show_likes_received)).map(([k, label]) => <button key={k} className={`btn sm ${tab === k ? "primary" : ""}`} onClick={() => { setTab(k); setList(null); }}>{label}</button>)}
      </div>
      {tab === "search" && (
        <div className="card" style={{ margin: "1rem 0" }}>
          <Tabs value={ftab} onChange={setFtab} tabs={[
            ["general", "Algemeen", null, cnt(["q", "gender", "age_min", "age_max", "sort", "online", "photo"])],
            ...(hasLoc ? [["location", "Locatie", null, cnt(["city", "country", "distance_km"])]] : []),
            ...(hasProfile ? [["profile", "Interesses & profiel", null, cnt(["interest", "aim", ...Object.keys(f).filter((k) => k.startsWith("f_"))])]] : []),
            ...(availGroups?.length > 0 ? [["avail", "Beschikbaar voor", null, cnt(["available"])]] : []),
          ]} />
          <div className="theme-grid" style={{ marginTop: ".9rem" }} hidden={ftab !== "general"}>
            <label>{tx("Naam of tekst")}<input value={f.q} onChange={set("q")} /></label>
            {on("gender") && show("gender") && <label>{tx("Geslacht")}<select value={f.gender} onChange={set("gender")}><option value="">{tx("Maakt niet uit")}</option>{Object.entries(GENDER).filter(([k]) => genders.includes(k)).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select></label>}
            {on("birth_date") && show("age") && <label>{tx("Leeftijd van")}<input type="number" min={18} max={99} value={f.age_min} onChange={set("age_min")} /></label>}
            {on("birth_date") && show("age") && <label>{tx("Leeftijd tot")}<input type="number" min={18} max={99} value={f.age_max} onChange={set("age_max")} /></label>}
            {show("sort") && <label>{tx("Sorteren")}<select value={f.sort} onChange={set("sort")}><option value="">{tx("Standaard")}</option><option value="active">{tx("Laatst actief")}</option><option value="newest">{tx("Nieuwste")}</option>{cfg?.distance_enabled && <option value="distance">{tx("Dichtstbij")}</option>}</select></label>}
          </div>
          <div className="theme-grid" style={{ marginTop: ".9rem" }} hidden={ftab !== "location"}>
            {on("city") && show("city") && <label>{tx("Plaats")}<input value={f.city} onChange={set("city")} /></label>}
            {on("city") && show("country") && <label>{tx("Land (code)")}<input value={f.country} maxLength={2} onChange={set("country")} placeholder="NL" /></label>}
            {cfg?.distance_enabled && show("distance") && <label>{tx("Binnen")}<select value={f.distance_km} onChange={set("distance_km")}><option value="">{tx("Overal")}</option>{cfg.radii.map((r) => <option key={r} value={r}>{r} {tx("km")}</option>)}</select></label>}
          </div>
          <div className="theme-grid" style={{ marginTop: ".9rem" }} hidden={ftab !== "profile"}>
            {on("interests") && show("interest") && <label>{tx("Interesse")}<input value={f.interest} onChange={set("interest")} placeholder={tx("bv. wandelen")} /></label>}
            {on("aim") && show("aim") && <label>{tx("Zoekt")}<select value={f.aim} onChange={set("aim")}><option value="">{tx("Alles")}</option>{(pcfg?.aims || Object.entries(AIMS)).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select></label>}
            {(pcfg?.fields || []).filter((x) => x.filter).map((x) => (
              x.type === "checkbox" ? <label key={x.key} className="check" style={{ alignSelf: "end" }}><input type="checkbox" checked={f[`f_${x.key}`] === "1"} onChange={(e) => setF({ ...f, [`f_${x.key}`]: e.target.checked ? "1" : "" })} /> {x.label}</label>
              : x.type === "number" ? <label key={x.key}>{x.label}{x.unit && <small className="muted"> ({x.unit})</small>}<span className="row" style={{ flexWrap: "nowrap" }}><input type="number" placeholder="van" value={f[`f_${x.key}_min`] || ""} onChange={(e) => setF({ ...f, [`f_${x.key}_min`]: e.target.value })} /><input type="number" placeholder="tot" value={f[`f_${x.key}_max`] || ""} onChange={(e) => setF({ ...f, [`f_${x.key}_max`]: e.target.value })} /></span></label>
              : x.type === "select" || x.type === "multiselect" ? <label key={x.key}>{x.label}<select value={f[`f_${x.key}`] || ""} onChange={(e) => setF({ ...f, [`f_${x.key}`]: e.target.value })}><option value="">{tx("Maakt niet uit")}</option>{x.options.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
              : <label key={x.key}>{x.label}<input value={f[`f_${x.key}`] || ""} onChange={(e) => setF({ ...f, [`f_${x.key}`]: e.target.value })} /></label>
            ))}
          </div>
          <div style={{ marginTop: ".9rem" }} hidden={ftab !== "avail"}>
          {availGroups?.length > 0 && (
            <div>
              <strong style={{ fontSize: ".85rem" }}>{tx("Beschikbaar voor")}</strong>
              <AvailPicker compact groups={availGroups} value={f.available ? f.available.split(",") : []} onChange={(v) => setF({ ...f, available: v.join(",") })} />
            </div>
          )}
          </div>
          <div className="row" style={{ justifyContent: "flex-start", marginTop: ".9rem" }}>
            {show("online") && <label className="check"><input type="checkbox" checked={f.online} onChange={set("online")} /> {tx("Nu online")}</label>}
            {show("photo") && <label className="check"><input type="checkbox" checked={f.photo} onChange={set("photo")} /> {tx("Met foto")}</label>}
            <button className="btn sm" onClick={() => setF(EMPTY)}>{tx("Wissen")}</button>
          </div>
        </div>
      )}
      {tab === "swipe" && <Swiper />}
      {err && tab !== "swipe" && <div className="alert" style={{ margin: "1rem 0" }}>{err}</div>}
      {tab !== "swipe" && <div className="product-grid" style={{ marginTop: "1rem" }}>
        {(list || []).map((m) => <Card key={m.id} m={m} onChange={load} />)}
      </div>}
      {tab !== "swipe" && list && !list.length && !err && <p className="muted" style={{ marginTop: "1rem" }}>
        {tab === "suggested" ? tx("Nog geen aanbevelingen. Vul je geboortedatum, geslacht en voorkeuren in op je profiel.") : tx("Niets gevonden.")}
      </p>}
    </>
  );
}

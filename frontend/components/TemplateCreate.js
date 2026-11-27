// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { useAuth } from "./AuthContext";
import { tx } from "../lib/t";
import { captureFrame } from "../lib/screenshot";
import { IconBolt } from "./Icons";
import SmallEditor from "./SmallEditor";
import Tabs from "./Tabs";

import Loading from "./Loading";
// Superadmin: make a template of the website as it is now. The server builds the zip (settings of the system, pages, menu, pictures; never the data of users) and puts it in resource/templates;
// here the example pictures are made: a screenshot of every chosen page (and the home page on a phone), which the choice screen and the demo show.
const slug = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

async function shoot(path, width, height) {  // a page in a hidden frame, as a picture (a file); null when the page does not exist (404)
  try { const r = await fetch(path, { credentials: "include" }); if (!r.ok) return null; } catch { return null; }
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;border:0;visibility:hidden`;
  document.body.appendChild(frame);
  try {
    await new Promise((ok, no) => { const t = setTimeout(() => no(new Error("timeout")), 20000); frame.onload = () => { clearTimeout(t); ok(); }; frame.src = path; });
    await new Promise((r) => setTimeout(r, 2200));  // the page draws itself
    try { await frame.contentDocument?.fonts?.ready; } catch { /* no fonts api */ }
    const url = await captureFrame(frame, width, { styles: true });
    const blob = await (await fetch(url)).blob();
    if (blob.size <= 2_500_000) return blob;
    const bmp = await createImageBitmap(blob);  // too big for an example picture (max 3 MB): as a jpeg
    const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; c.getContext("2d").drawImage(bmp, 0, 0);
    return await new Promise((ok) => c.toBlob((b) => ok(b || blob), "image/jpeg", 0.8));
  } finally { frame.remove(); }
}

export default function TemplateCreate({ onClose, onMade }) {
  const [tab, setTab] = useState("data");
  const [v, setV] = useState({ name: "", key: "", description: "", author: "", version: "1.0.0" });
  const [keyTouched, setKeyTouched] = useState(false);
  const { user } = useAuth() || {};
  // the maker is the person who is logged in, unless somebody types another name
  useEffect(() => { const n = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.display_name || user?.email || ""; if (n) setV((o) => (o.author ? o : { ...o, author: n.slice(0, 80) })); }, [user?.id]);  // eslint-disable-line react-hooks/exhaustive-deps
  const [pages, setPages] = useState(null);   // the own pages of this website
  const [on, setOn] = useState({});           // the pages that get an example picture
  const [mobile, setMobile] = useState(true);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [note, setNote] = useState("");
  const [langs, setLangs] = useState([]);        // the languages of the website: with more than one the AI asks in which one to write
  const [aiLang, setAiLang] = useState("");
  const [askLang, setAskLang] = useState(false);
  useEffect(() => { api("/languages/").then((d) => { const l = (d.languages || []).filter((x) => x.enabled !== false); setLangs(l); setAiLang(d.default || l[0]?.code || "nl"); }).catch(() => {}); }, []);
  const done = useRef(false);
  useEffect(() => { api("/templates/?pages=1").then((d) => { const list = (d.pages || []).map((p) => ({ ...p, title: typeof p.title === "string" ? p.title : String(p.title?.nl || p.title?.en || p.key) })); setPages(list); setOn(Object.fromEntries(list.filter((p) => p.default).map((p) => [p.key, true]))); }).catch((e) => setErr(errorText(e))); }, []);
  const set = (k, x) => setV((o) => ({ ...o, [k]: x, ...(k === "name" && !keyTouched ? { key: slug(x) } : {}) }));
  const ok = v.name.trim().length >= 2 && /^[a-z0-9][a-z0-9_-]{1,59}$/.test(v.key) && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(v.version);
  const fillAi = async () => {  // the AI looks at this website (pages, texts, theme, modules, plugins, languages) and fills in name, description and version
    setAiBusy(true); setErr("");
    try {
      const d = await api("/templates/", { method: "POST", body: { action: "suggest", lang: aiLang } });
      setKeyTouched(false);
      setNote(d.source === "ai" ? tx("Bedacht door de AI op basis van je website.") : tx("Overgenomen uit je website (naam, slogan en pagina's). De AI gaf geen bruikbaar antwoord of is niet gekoppeld."));
      setV((o) => ({ ...o, name: d.name, key: d.key, description: d.description, version: d.version }));
    } catch (e) { setErr(errorText(e)); }
    setAiBusy(false);
  };
  const make = async () => {
    if (done.current) return;
    setErr("");
    try {
      const fd = new FormData();
      fd.append("action", "create"); fd.append("key", v.key); fd.append("name", v.name.trim()); fd.append("description", v.description); fd.append("author", v.author.trim()); fd.append("version", v.version);
      const chosen = (pages || []).filter((p) => on[p.key]);
      chosen.forEach((p) => fd.append("pages", p.key));
      let n = 0;
      for (const p of chosen.slice(0, 6)) {
        setBusy(`${tx("Voorbeeld maken van")} ${p.title} (${++n}/${chosen.length + (mobile && chosen.length ? 1 : 0)})`);
        try { const b = await shoot(p.path, 1280, 800); if (b) fd.append("previews", b, `${p.key}.${b.type.includes("jpeg") ? "jpg" : "png"}`); } catch { /* a page that cannot be drawn: the template still gets made (without this picture) */ }
      }
      if (mobile && chosen.length) {
        setBusy(`${tx("Voorbeeld maken van")} ${tx("de startpagina op een telefoon")}`);
        try { const b = await shoot(chosen[0].path, 390, 800); if (b) fd.append("previews", b, `mobile.${b.type.includes("jpeg") ? "jpg" : "png"}`); } catch { /* idem */ }
      }
      setBusy(tx("De template wordt gemaakt…"));
      done.current = true;
      const r = await api("/templates/", { method: "POST", body: fd });
      onMade?.(r);
      onClose();
    } catch (e) { done.current = false; setErr(errorText(e)); setBusy(""); }
  };
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tx("Template maken")} onClick={() => !busy && onClose()}>
      <div className="card modal form" style={{ width: "min(640px, 94vw)", maxHeight: "92vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()} data-easy2edit-tag="ui-template-create">
        <div className="row between"><h2 style={{ margin: 0 }}>{tx("Template maken van dit ontwerp")}</h2><button type="button" className="btn sm" disabled={!!busy} onClick={onClose} aria-label={tx("Sluiten")}>×</button></div>
        <Tabs value={tab} onChange={setTab} tabs={[["data", tx("Gegevens")], ["shots", tx("Voorbeelden")], ["what", tx("Wat zit erin")]]} />
        {err && <div className="alert">{err}</div>}
        {tab === "data" && (
          <div className="stack-sm" style={{ gap: ".7rem" }}>
            <div style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" className="btn sm" disabled={aiBusy || !!busy} onClick={() => (langs.length > 1 ? setAskLang((x) => !x) : fillAi())}><IconBolt /> {aiBusy ? tx("De AI kijkt naar je website…") : tx("Gegevens bedenken en invullen met AI")}</button>
              <small className="muted">{tx("De AI bekijkt de pagina's, het thema, de modules en de talen en bedenkt naam, omschrijving en versie. Je kunt alles aanpassen.")}</small>
            </div>
            {note && <small className="muted" role="status">{note}</small>}
            {askLang && langs.length > 1 && (
              <div className="card" style={{ padding: ".7rem .9rem", display: "grid", gap: ".5rem" }}>
                <strong>{tx("In welke taal moet de AI de gegevens schrijven?")}</strong>
                <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>{langs.map((l) => <button type="button" key={l.code} aria-pressed={aiLang === l.code} onClick={() => setAiLang(l.code)} style={{ padding: ".25rem .8rem", borderRadius: 999, border: `1px solid ${aiLang === l.code ? "var(--blue)" : "var(--line)"}`, background: aiLang === l.code ? "color-mix(in srgb, var(--blue) 16%, var(--card))" : "var(--card)", color: "inherit", cursor: "pointer", font: "inherit", fontSize: ".85rem" }}>{l.native_name || l.name || l.code}</button>)}</div>
                <div><button type="button" className="btn sm primary" disabled={aiBusy} onClick={() => { setAskLang(false); fillAi(); }}><IconBolt /> {tx("Bedenken")}</button></div>
              </div>
            )}
            <label className="field"><strong>{tx("Naam")}</strong><input value={v.name} maxLength={80} onChange={(e) => set("name", e.target.value)} placeholder={tx("bv. Accountantskantoor")} autoFocus /></label>
            <label className="field"><strong>{tx("Bestandsnaam")}</strong><input value={v.key} maxLength={60} onChange={(e) => { setKeyTouched(true); setV((o) => ({ ...o, key: slug(e.target.value) })); }} /><small className="muted">{v.key ? `resource/templates/${v.key}-${v.version}.zip` : ""}</small></label>
            <div className="field"><strong>{tx("Omschrijving")}</strong><SmallEditor value={v.description} onChange={(x) => set("description", x)} maxLength={1500} placeholder={tx("Voor wie is deze template en wat zit erin?")} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 8rem", gap: ".6rem" }}>
              <label className="field"><strong>{tx("Maker")}</strong><input value={v.author} maxLength={80} onChange={(e) => set("author", e.target.value)} /></label>
              <label className="field"><strong>{tx("Versie")}</strong><input value={v.version} maxLength={14} onChange={(e) => set("version", e.target.value)} /></label>
            </div>
          </div>
        )}
        {tab === "shots" && (
          <div className="stack-sm" style={{ gap: ".6rem" }}>
            <p className="muted" style={{ margin: 0 }}>{tx("Kies de pagina's die in de template komen: alleen die van dit ontwerp staan aan. Pagina's van een eerdere website of demo, of waarvan de module uitstaat, staan uit. Van de gekozen pagina's (maximaal 6) wordt een schermafdruk gemaakt voor het keuzescherm en voor een demo.")}</p>
            {pages === null && <p className="muted"><Loading /></p>}
            {pages && !pages.length && <p className="muted">{tx("Er zijn geen eigen pagina's. Er wordt een voorbeeldplaatje getekend in de kleuren van het thema.")}</p>}
            {(pages || []).map((p) => <label key={p.key} className="check sec-toggle" style={{ opacity: p.default || on[p.key] ? 1 : .75 }}><span className="switch"><input type="checkbox" checked={!!on[p.key]} onChange={(e) => setOn((o) => ({ ...o, [p.key]: e.target.checked }))} /><span /></span><span>{p.title} <small className="muted">{p.path}</small>{p.reason && <small className="muted" style={{ display: "block" }}>{tx(p.reason)}</small>}</span></label>)}
            {pages?.length > 0 && <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={mobile} onChange={(e) => setMobile(e.target.checked)} /><span /></span><span>{tx("Ook de eerste gekozen pagina op een telefoon")}</span></label>}
          </div>
        )}
        {tab === "what" && (
          <div className="stack-sm" style={{ gap: ".5rem" }}>
            <strong>{tx("Wat zit in de template")}</strong>
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              <li>{tx("De instellingen van het systeem: thema, modules (aan of uit), talen, plugins met hun instellingen, het standaard dashboard en de logo's.")}</li>
              <li>{tx("De pagina's, het menu, de indelingen, de teksten en de afbeeldingen en video's die ze gebruiken.")}</li>
              <li>{tx("Wat het systeem nodig heeft: de versie, de plugins, de componentenset en de talen. Na het inlezen controleert het systeem of alles klopt.")}</li>
              <li>{tx("De schermafdrukken als voorbeeld.")}</li>
            </ul>
            <strong>{tx("Wat zit er niet in")}</strong>
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              <li>{tx("Gebruikers, groepen en wat zij hebben gemaakt (berichten, bestellingen, leden, tegoed) en de gegevens van plugins.")}</li>
              <li>{tx("Wachtwoorden, API-sleutels en andere geheimen, e-mailgegevens, de licentie en de beveiliging.")}</li>
            </ul>
            <small className="muted">{tx("Bij het gebruiken van de template als hele systeem wordt eerst een backup van alles gemaakt, zodat je terug kunt.")}</small>
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: ".5rem", alignItems: "center" }}>
          {busy && <small className="muted" role="status" style={{ marginRight: "auto" }}>{busy}</small>}
          <button type="button" className="btn" disabled={!!busy} onClick={onClose}>{tx("Annuleren")}</button>
          <button type="button" className="btn primary" disabled={!!busy || !ok} onClick={make}>{busy ? tx("Bezig…") : tx("Template maken")}</button>
        </div>
      </div>
    </div>, document.body);
}

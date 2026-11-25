// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import Tabs from "./Tabs";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import PopupStyleGallery from "./PopupStyleGallery";
import { useUi } from "./Ui";
import { api, errorText } from "../lib/api";
import { HamburgerCard } from "./MenuSettingsAdmin";
import { DEFAULT_MENU } from "./SiteMenu";
import { lvl } from "../lib/perms";
import MediaPicker from "./MediaPicker";
import WidgetLibrary from "./WidgetLibrary";
import RichEditor from "./RichEditor";
import { alertDialog, confirmDialog, promptDialog } from "../lib/dialog";
import { tx } from "../lib/t";

// Examples of page layouts and popups on a phone, an iPad and a computer, drawn with the colours and shapes of the theme that is in use.
// Under every popup a button shows the real popup.
const DEV = [["mobile", "Mobiel", "Telefoon"], ["tablet", "iPad", "Tablet"], ["desktop", "Website", "Computer"]];
const test = (t) => () => window.dispatchEvent(new CustomEvent("test-popup", { detail: t }));
const popups = (open) => [
  { key: "age", name: "Leeftijdscontrole", kind: "modal", title: "Ben je 18 jaar of ouder?", text: "Deze website is alleen voor volwassenen.", buttons: [["Ja, ik ben 18+", true], ["Nee", false]], show: test("age") },
  { key: "gambling", name: "Gokken-popup", kind: "modal", title: "Speel verantwoord", text: "Gokken kan verslavend zijn. Je moet 24 jaar of ouder zijn.", buttons: [["Ik ben 24+", true], ["Verlaten", false]], show: test("gambling") },
  { key: "cookies", name: "Cookiebanner", kind: "banner", title: "Wij gebruiken cookies", text: "Voor een betere ervaring en statistieken.", buttons: [["Accepteren", true], ["Alleen noodzakelijk", false]], show: test("cookies") },
  { key: "policy", name: "Cookiebeleid", kind: "modal", title: "Cookiebeleid", text: "Hier lees je welke cookies we gebruiken en waarom.", buttons: [["Sluiten", true]], show: test("policy") },
  { key: "example", name: "Voorbeeld met afbeelding", kind: "modal", image: true, title: "Welkom terug", text: "Een popup met een afbeelding bovenaan.", buttons: [["Verder", true]], show: test("example") },
  { key: "chat", name: "Venster: Chat", kind: "window", title: "Chat", text: "Hoi! Hoe gaat het?", buttons: [["Verstuur", true]], show: test("window:chat") },
  { key: "video", name: "Venster: Videochat", kind: "window", title: "Videochat", text: "Je gesprek begint zo.", buttons: [["Ophangen", false]], show: test("window:video") },
  { key: "files", name: "Venster: Bestanden", kind: "window", title: "Bestanden", text: "foto.jpg · document.pdf", buttons: [["Uploaden", true]], show: test("window:files") },
  { key: "confirm", name: "Systeempopup: bevestigen", kind: "modal", title: "Bevestigen", text: "Weet je zeker dat je dit wilt doen?", buttons: [["Ja", true], ["Annuleren", false]], show: () => confirmDialog(tx("Weet je zeker dat je dit wilt doen?"), { title: tx("Systeempopup: bevestigen") }) },
  { key: "delete", name: "Systeempopup: verwijderen", kind: "modal", title: "Verwijderen", text: "Dit item definitief verwijderen?", buttons: [["Verwijderen", "danger"], ["Annuleren", false]], show: () => confirmDialog(tx("Dit item definitief verwijderen?"), { title: tx("Systeempopup: verwijderen"), danger: true }) },
  { key: "alert", name: "Systeempopup: melding", kind: "modal", title: "Melding", text: "Je wijzigingen zijn opgeslagen.", buttons: [["OK", true]], show: () => alertDialog(tx("Je wijzigingen zijn opgeslagen."), { title: tx("Systeempopup: melding") }) },
  { key: "prompt", name: "Systeempopup: invullen", kind: "modal", title: "Nieuwe naam", text: "Geef een nieuwe naam", input: true, buttons: [["Opslaan", true], ["Annuleren", false]], show: () => promptDialog(tx("Geef een nieuwe naam"), tx("Voorbeeld"), { title: tx("Systeempopup: invullen") }) },
  { key: "form", name: "Formulier-venster (bewerken)", kind: "modal", fields: 4, title: "Product wijzigen", text: "", buttons: [["Annuleren", false], ["Opslaan", true]], show: () => open("form") },
  { key: "table", name: "Groot venster met lijst", kind: "modal", rows: 4, title: "Bestellingen", text: "", buttons: [["Sluiten", false]], show: () => open("table") },
  { key: "media", name: "Mediabibliotheek kiezen", kind: "modal", grid: true, title: "Kies een afbeelding", text: "", buttons: [["Uploaden", false], ["Kiezen", true]], show: () => open("media") },
  { key: "editor", name: "Tekstbewerker", kind: "modal", editor: true, title: "Tekst bewerken", text: "", buttons: [["Annuleren", false], ["Opslaan", true]], show: () => open("editor") },
];

const SIZE = { age: "s", gambling: "s", cookies: "s", example: "s", confirm: "s", delete: "s", alert: "s", prompt: "s", policy: "m", chat: "m", video: "m", files: "m", form: "l", media: "l", editor: "l", table: "l" };
const SIZES = [["s", "Klein", "Meldingen, vragen en banners"], ["m", "Middel", "Vensters met een eigen inhoud"], ["l", "Groot", "Formulieren, mediabibliotheek en tekstbewerker"]];

function Btn({ b }) {
  const [label, kind] = b;
  return <span className={`lay-btn ${kind === true ? "primary" : kind === "danger" ? "danger" : ""}`}>{tx(label)}</span>;
}

function PopupMock({ p }) {
  const size = SIZE[p.key] || "s";
  const body = (
    <div className={`lay-pop ${p.kind} size-${size}`}>
      {p.image && <span className="lay-img" />}
      <strong>{tx(p.title)}</strong>
      {p.text && <span className="lay-text">{tx(p.text)}</span>}
      {p.input && <span className="lay-input" />}
      {p.fields && <span className="lay-fields">{Array.from({ length: p.fields }, (_, i) => <i key={i} className="lay-input" />)}</span>}
      {p.rows && <span className="lay-rows">{Array.from({ length: p.rows }, (_, i) => <i key={i} />)}</span>}
      {p.grid && <span className="lay-thumbs">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</span>}
      {p.editor && <><span className="lay-tools"><b /><b /><b /><b /></span><span className="lay-area" /></>}
      <span className="lay-btns">{p.buttons.map((b) => <Btn key={b[0]} b={b} />)}</span>
    </div>
  );
  return <div className={`lay-screen ${p.kind}`}><span className="lay-bar" /><span className="lay-lines" />{body}</div>;
}


// Menu in Theme > Layout: a live example of the menu (your items, style, letters, font size and the hamburger menu, on computer / iPad / phone) and the hamburger settings under it.
const PREVIEW_W = { desktop: 1280, tablet: 900, mobile: 420 };
function MenuPanel({ v = {}, canEdit }) {
  const [cfg, setCfg] = useState(null);
  const [names, setNames] = useState([]);
  const [items, setItems] = useState([]);
  const [dev, setDev] = useState("desktop");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    api("/pages/menu-settings/").then((d) => setCfg({ ...DEFAULT_MENU, ...d })).catch(() => {});
    api("/pages/menu/").then((d) => { const list = d.items || []; setItems(list); setNames(list.map((x) => x.titles || {}).map((t) => t.nl || t.en || Object.values(t)[0] || "").filter(Boolean).slice(0, 8)); }).catch(() => {});
  }, []);
  const set = (patch) => { const next = { ...cfg, ...patch }; setCfg(next); api("/pages/menu-settings/", { method: "PUT", body: next }).then(() => window.dispatchEvent(new Event("pages-changed"))).catch(() => {}); };
  if (!cfg) return null;
  const words = names.length ? names : ["Home", "Over ons", "Diensten", "Contact"];
  const w = PREVIEW_W[dev], when = cfg.hb_when || "fit";
  const formOfDev = cfg.forms?.[dev] || "bar";
  const roughFit = words.reduce((n, x) => n + x.length * 8.5 + 26, 0) + 260 <= w;  // about: does the bar fit next to the logo and the icons
  const hb = formOfDev !== "bar" ? formOfDev : (when === "always" || (when === "width" && w < (cfg.hb_width || 900)) || (when === "items" && words.length > (cfg.hamburger_items || 6)) || (when === "fit" && !roughFit)) ? (cfg.hb_form || "hamburger") : "";
  const why = formOfDev !== "bar" ? tx("Zo staat het menu voor dit apparaat ingesteld") : hb ? ({ always: tx("Altijd een hamburger-menu"), width: tx("Het scherm is smaller dan {0} px", cfg.hb_width || 900), items: tx("Meer dan {0} items", cfg.hamburger_items || 6), fit: tx("De items passen niet in de header") }[when] || "") : "";
  const nav = (cls = "") => words.map((x, i) => <a key={x + i} className={`${i === 0 ? "on" : ""} ${cls}`}>{x}</a>);
  return (
    <>
      <div className="menu-live" data-mmenu={v.menu_style || "text"} data-mcase={v.menu_case || "normal"} style={cfg.font_size > 0 ? { "--ml-fs": `${cfg.font_size}rem` } : undefined}>
        <div className="ml-head"><small className="muted">{tx("Zo ziet je menu eruit")}</small>
          <span className="pb-seg">{[["desktop", "Computer"], ["tablet", "iPad"], ["mobile", "Telefoon"]].map(([k, l]) => <button type="button" key={k} className={dev === k ? "on" : ""} onClick={() => { setDev(k); setOpen(false); }}>{tx(l)}</button>)}</span></div>
        <div className="ml-stage" style={{ maxWidth: w, marginBottom: hb && open ? (hb === "hamburger" ? 24 + words.length * 38 : 170) : 0 }}>
          <div className="ml-bar">
            <i className="ml-logo" />
            {hb ? <button type="button" className="ml-toggle" onClick={() => setOpen(!open)} aria-expanded={open}><svg width={cfg.hb_icon || 20} height={cfg.hb_icon || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>{cfg.hb_label && <b>{tx("Menu")}</b>}</button> : <nav>{nav()}</nav>}
            <span className="ml-actions"><i /><i /></span>
          </div>
          {hb && open && (hb === "hamburger" ? <div className="ml-drop">{nav()}</div> : hb === "fullscreen" ? <div className="ml-full" onClick={() => setOpen(false)}>{nav()}</div> : <div className={`ml-drawer ${hb === "drawer-right" ? "right" : ""}`}>{nav()}</div>)}
        </div>
        <small className="muted">{hb ? `${tx("Hamburger-menu")}: ${why}. ${tx("Klik op het icoon om het menu te openen.")}` : tx("De menubalk past: alle items staan naast elkaar.")}</small>
      </div>
      <HamburgerCard cfg={cfg} set={set} canEdit={canEdit} items={items} plain />
    </>
  );
}

function PageMock({ type, logo, v = {}, scroll = false, words = false }) { // scroll: the page is shown scrolled down (does the header stay at the top?)
  const Logo = () => (logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img loading="lazy" decoding="async" src={logo} alt="" className="lay-logo-img" /> : <i className="lay-logo" />);
  const attrs = { "data-mhl": v.header_layout || "classic", "data-mhs": v.header_style || "solid", "data-mmenu": v.menu_style || "text", "data-mcase": v.menu_case || "normal", "data-mfl": v.footer_layout || "brand", "data-mft": v.footer_tone || "card", "data-mfbrand": v.footer_brand || "logo", "data-mfsocial": v.footer_social || "show", "data-mfmeta": v.footer_meta || "show", "data-mfsize": v.footer_size || "normal", "data-mblocks": v.block_style || "card" };
  if (type === "site") {
    const noHead = v.page_header === "hide", noFoot = v.page_footer === "hide";
    const top = <div className="lay-top"><Logo /><span className={`lay-menu${words ? " words" : ""}`}>{words ? ["Home", "Over ons", "Contact"].map((w, i) => <b key={w} className={i === 0 ? "on" : ""}>{w}</b>) : <><b /><b /><b /></>}</span><span className="lay-burger"><b /><b /><b /></span><span className="lay-actions"><i /><i /></span></div>;
    if (scroll) { // "Header blijft bovenaan staan": scrolled down, with or without the header at the top
      const stays = (v.header_sticky || "yes") !== "no";
      return (
        <div className="lay-page site scrolled" {...attrs}>
          {stays && top}
          <div className="lay-cards"><i /><i /><i /></div>
          <div className="lay-cards"><i /><i /><i /></div>
          <span className="lay-scrollhint">{stays ? "↓ header blijft" : "↓ header scrolt weg"}</span>
        </div>
      );
    }
    return (
      <div className="lay-page site" {...attrs}>
        {!noHead && top}
        <div className="lay-hero"><strong>{tx("Welkom")}</strong><span className="lay-btn primary">{tx("Meedoen")}</span></div>
        <div className="lay-cards"><i /><i /><i /></div>
        {!noFoot && <div className="lay-foot"><span className="lay-fbrand"><i /><b /></span><span className="lay-flinks"><b /><b /></span><span className="lay-fsocial"><b /><b /></span><span className="lay-fmeta"><b /><b /><b /></span><span className="lay-fbar"><b /><b /></span></div>}
      </div>
    );
  }
  if (type === "foot") { // the footer in the picture: a small header and a strip of content, then the footer itself (it takes the room of the page)
    return (
      <div className="lay-page site footdemo" {...attrs}>
        <div className="lay-strip"><b /><b /></div>
        <div className="lay-foot"><span className="lay-fbrand"><i /><b /></span><span className="lay-flinks"><b /><b /><b /></span><span className="lay-fsocial"><b /><b /><b /></span><span className="lay-fmeta"><b /><b /><b /></span><span className="lay-fbar"><b /><b /></span></div>
      </div>
    );
  }
  if (type === "dash") {
    return (
      <div className="lay-page dash" {...attrs}>
        <div className="lay-top"><Logo /><span className="lay-menu"><b /></span></div>
        <div className="lay-body"><div className="lay-side"><b /><b /><b /><b /></div><div className="lay-main"><div className="lay-cards"><i /><i /></div><div className="lay-card wide" /></div></div>
      </div>
    );
  }
  return (
    <div className="lay-page form" {...attrs}>
      <div className="lay-top"><Logo /></div>
      <div className="lay-form"><strong>{tx("Inloggen")}</strong><span className="lay-input" /><span className="lay-input" /><span className="lay-btn primary">{tx("Inloggen")}</span></div>
    </div>
  );
}

// A switch: on this page-wide default (a page can set its own at Pagina-instellingen -> Pagina-opzet)
function DefaultSwitch({ on, onChange, disabled, label, hint }) {
  return (
    <label className="default-switch" style={{ opacity: disabled ? .6 : 1 }}>
      <span className="switch"><input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span>
      <span className="packlay-text"><strong>{label}</strong><small className="muted">{hint}</small></span>
      <span className="packlay-state muted">{on ? tx("Aan") : tx("Uit")}</span>
    </label>
  );
}

export default function ThemeLayout({ draft = null }) { // draft: {logo}: only the examples, with the colours of a theme that is not saved yet
  const [dev, setDev] = useState("mobile");
  const [section, setSection] = useState("templates");
  const sec = draft ? (draft.show || "pages") : section; // templates | style | pages | popups
  const { user } = useAuth();
  const router = useRouter();
  const { previewUi } = useUi();
  const L = lvl(user, "theme");
  const [look, setLook] = useState(null); // {values, tabs: [{value,label}], fields}
  const [err, setErr] = useState("");
  useEffect(() => {
    if (draft) return undefined;
    api("/theme/").then((d) => setLook({ values: d.values, tabs: d.schema.flatMap((g) => g.fields).find((f) => f.key === "tab_style")?.choices || [], fields: d.schema.find((g) => g.key === "page_layout")?.fields || [] })).catch((e) => setErr(errorText(e)));
    return () => previewUi(null);
  }, [previewUi, draft]);
  // the tab style and the look of pop-ups and windows are part of the theme: they change at once and are saved
  async function pick(key, v) {
    const values = { ...look.values, [key]: v };
    setLook({ ...look, values }); setErr("");
    previewUi({ remember_collapse: values.remember_collapse, sidebar_auto: values.sidebar_auto, chat_label: values.chat_label, version_notice: values.version_notice, tab_style: values.tab_style, system_popup: values.system_popup });
    try { await api("/theme/", { method: "PUT", body: { values } }); router.refresh(); } catch (e) { setErr(errorText(e)); }
  }
  const [open, setOpen] = useState(null); // the large demo windows that are built here
  const POPUPS = popups(setOpen);
  const vals = draft?.values || look?.values || {};
  const close = () => setOpen(null);
  return (
    <div className="stack-sm">
      <p className="muted" style={{ margin: 0 }}>{tx("Zo zien pagina's en popups eruit met het thema dat nu in gebruik is, op een telefoon, een iPad en een computer. De afronding, kleuren, breedte en schaduw van popups pas je aan bij Vormgeving.")}</p>
      {!draft && <Tabs value={section} onChange={setSection} tabs={[["templates", "Pagina-indeling"], ["header", "Header"], ["footer", "Footer"], ["style", "Tabbladen en vensters"], ["widgets", "Widgets"], ["pages", "Voorbeeld: pagina's"], ["popups", "Voorbeeld: popups"]]} />}
      {(sec === "pages" || sec === "popups") && <div className="row" style={{ justifyContent: "flex-start" }}>
        {DEV.map(([k, l, h]) => <button key={k} type="button" className={`btn ${dev === k ? "primary" : ""}`} title={tx(h)} onClick={() => setDev(k)}>{tx(l)}</button>)}
      </div>}

      {err && <div className="alert">{err}</div>}
      {!draft && look && sec === "style" && (
        <>
          <h2 style={{ margin: ".5rem 0 0" }}>{tx("Tabbladen")}</h2>
          <p className="muted" style={{ margin: 0 }}>{tx("De vorm van alle tabbladen van de website. Het werkt direct: kijk naar de tabbladen bovenaan deze pagina.")}</p>
          <div className="preset-grid">
            {look.tabs.map((c) => (
              <button key={c.value} type="button" disabled={L < 2} className={`preset ${look.values.tab_style === c.value ? "active" : ""}`} onClick={() => pick("tab_style", c.value)}><strong>{tx(c.label)}</strong></button>
            ))}
          </div>
          <h2 style={{ margin: "1rem 0 0" }}>{tx("Vensters en popups: indeling")}</h2>
          <p className="muted" style={{ margin: 0 }}>{tx("Het uiterlijk van alle popups, vensters en de tabbladen daarin. Dit uiterlijk wordt overal gebruikt (beheer, bewerken, meldingen).")}</p>
          <PopupStyleGallery value={look.values.system_popup || "clean"} onChange={(v) => L >= 2 && pick("system_popup", v)} />
        </>
      )}

      {!draft && look && sec === "templates" && (
        <>
          <h2 style={{ margin: "1rem 0 0" }}>{tx("Pagina-indeling van de website")}</h2>
          <p className="muted" style={{ margin: 0 }}>{tx("Kies de indeling van header, menu, footer en blokken. De voorbeelden hieronder passen direct mee en de website volgt na het kiezen.")}</p>
          {[["Header", ["header_layout", "header_style", "header_sticky"]], ["Menu", ["menu_style", "menu_case"]], ["Header en footer op pagina's", ["page_header", "page_footer"]], ["Blokken en kaarten", ["block_style"]]].map(([title, keys]) => (
            <div key={title} className="stack-sm">
              <strong>{tx(title)}</strong>
              {title === "Menu" && <MenuPanel v={look.values} canEdit={L >= 2} />}
              {look.fields.filter((f) => keys.includes(f.key)).map((f) => (
                <div key={f.key} className="stack-sm" style={{ gap: ".4rem" }}>
                  <small className="muted">{tx(f.label)}</small>
                  <div className="preset-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                    {f.choices.map((c) => (
                      <button key={c.value} type="button" disabled={L < 2} className={`preset opt ${look.values[f.key] === c.value ? "active" : ""}`} onClick={() => pick(f.key, c.value)}>
                        <span className="lay-frame opt" aria-hidden="true"><PageMock type="site" words={f.key === "menu_style" || f.key === "menu_case"} scroll={f.key === "header_sticky"} v={{ ...look.values, [f.key]: c.value }} /></span>
                        <strong style={{ fontSize: ".85rem" }}>{tx(c.label)}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div className="grid2">
            {look.fields.filter((f) => f.type === "number").map((f) => (
              <label key={f.key}>{tx(f.label)}: {look.values[f.key]}{f.unit}
                <input type="range" min={f.min} max={f.max} step={f.step} value={look.values[f.key]} disabled={L < 2} onChange={(e) => setLook({ ...look, values: { ...look.values, [f.key]: Number(e.target.value) } })} onMouseUp={(e) => pick(f.key, Number(e.target.value))} onTouchEnd={(e) => pick(f.key, Number(e.target.value))} onKeyUp={(e) => pick(f.key, Number(e.target.value))} />
              </label>
            ))}
          </div>

        </>
      )}

      {!draft && look && sec === "header" && (
        <>
          <h2 style={{ margin: "1rem 0 0" }}>{tx("Header van de website")}</h2>
          <div className="default-switches">
          <DefaultSwitch on={(look.values.page_header || "show") !== "hide"} disabled={L < 2} onChange={(v) => pick("page_header", v ? "show" : "hide")} label={tx("Header standaard tonen")} hint={tx("Voor alle pagina's van dit thema. Per pagina zet je hem aan of uit bij Pagina-instellingen → Pagina-opzet.")} />
          <DefaultSwitch on={(look.values.mode_switch || "show") !== "hide"} disabled={L < 2} onChange={(v) => pick("mode_switch", v ? "show" : "hide")} label={tx("Schakelaar licht/donker tonen")} hint={tx("Bezoekers kiezen zelf licht of donker. Uit: de website start altijd in de standaard hieronder.")} />
          </div>
          {(look.values.mode_switch || "show") === "hide" && (
            <div className="stack-sm" style={{ gap: ".4rem" }}>
              <strong>{tx("Standaard weergave")}</strong>
              <small className="muted">{tx("De schakelaar staat uit: de website, het dashboard en de inlog starten altijd in deze weergave.")}</small>
              <div className="preset-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                {[["light", "Licht"], ["dark", "Donker"], ["system", "Volgt het apparaat van de bezoeker"]].map(([v, l]) => <button key={v} type="button" disabled={L < 2} className={`preset opt ${(look.values.default_mode || "system") === v ? "active" : ""}`} onClick={() => pick("default_mode", v)}><strong style={{ fontSize: ".85rem" }}>{tx(l)}</strong></button>)}
              </div>
            </div>
          )}
          {[["Indeling", ["header_layout"]], ["Uiterlijk", ["header_style"]], ["Gedrag bij scrollen", ["header_sticky"]], ["Menu", ["menu_style", "menu_case"]]].map(([title, keys]) => (
            <div key={title} className="stack-sm">
              <strong>{tx(title)}</strong>
              {title === "Menu" && <MenuPanel v={look.values} canEdit={L >= 2} />}
              {look.fields.filter((f) => keys.includes(f.key)).map((f) => (
                <div key={f.key} className="stack-sm" style={{ gap: ".4rem" }}>
                  <small className="muted">{tx(f.label)}</small>
                  <div className="preset-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                    {f.choices.map((c) => (
                      <button key={c.value} type="button" disabled={L < 2} className={`preset opt ${look.values[f.key] === c.value ? "active" : ""}`} onClick={() => pick(f.key, c.value)}>
                        <span className="lay-frame opt" aria-hidden="true"><PageMock type="site" words={f.key === "menu_style" || f.key === "menu_case"} scroll={f.key === "header_sticky"} v={{ ...look.values, [f.key]: c.value }} /></span>
                        <strong style={{ fontSize: ".85rem" }}>{tx(c.label)}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {!draft && look && sec === "footer" && (
        <>
          <h2 style={{ margin: "1rem 0 0" }}>{tx("Footer van de website")}</h2>
          <DefaultSwitch on={(look.values.page_footer || "show") !== "hide"} disabled={L < 2} onChange={(v) => pick("page_footer", v ? "show" : "hide")} label={tx("Footer standaard tonen")} hint={tx("Voor alle pagina's van dit thema. Per pagina zet je hem aan of uit bij Pagina-instellingen → Pagina-opzet.")} />
          <p className="muted" style={{ margin: 0 }}>{tx("Kies de indeling van de footer: acht varianten, met of zonder logo en naam, sociale media en bedrijfsgegevens. De voorbeelden passen direct mee en de website volgt na het kiezen. De teksten en gegevens zelf stel je in bij Admin → Systeem → Basisgegevens → Voettekst en sociale media.")}</p>
          {[["Indeling", ["footer_layout"]], ["Kleur", ["footer_tone"]], ["Logo en naam", ["footer_brand"]], ["Onderdelen", ["footer_social", "footer_meta"]], ["Ruimte", ["footer_size"]]].map(([title, keys]) => (
            <div key={title} className="stack-sm">
              <strong>{tx(title)}</strong>
              {look.fields.filter((f) => keys.includes(f.key)).map((f) => (
                <div key={f.key} className="stack-sm" style={{ gap: ".4rem" }}>
                  {keys.length > 1 && <small className="muted">{tx(f.label)}</small>}
                  <div className="preset-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                    {f.choices.map((c) => (
                      <button key={c.value} type="button" disabled={L < 2} className={`preset opt ${look.values[f.key] === c.value ? "active" : ""}`} onClick={() => pick(f.key, c.value)}>
                        <span className="lay-frame opt" aria-hidden="true"><PageMock type="foot" v={{ ...look.values, [f.key]: c.value }} /></span>
                        <strong style={{ fontSize: ".85rem" }}>{tx(c.label)}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {sec === "widgets" && <WidgetLibrary />}
      {sec === "pages" && <>
      <h2 style={{ margin: "1rem 0 0" }}>{tx("Pagina-indelingen")}</h2>
      <div className="lay-grid">
        {[["site", "Website-pagina"], ["dash", "Dashboard"], ["form", "Formulier (inloggen)"]].map(([t, l]) => (
          <div key={t} className="lay-item">
            <div className={`lay-frame ${dev}`}><PageMock type={t} logo={draft?.logo} v={vals} /></div>
            <strong>{tx(l)}</strong>
          </div>
        ))}
      </div>

      </>}

      {sec === "popups" && <>
      <h2 style={{ margin: "1rem 0 0" }}>{tx("Popups en vensters")}</h2>
      {SIZES.map(([sz, label, hint]) => (
        <div key={sz} className="stack-sm">
          <h3 style={{ margin: ".5rem 0 0" }}>{tx(label)} <small className="muted" style={{ fontWeight: 400 }}>{tx(hint)}</small></h3>
          <div className="lay-grid">
            {POPUPS.filter((p) => (SIZE[p.key] || "s") === sz).map((p) => (
              <div key={p.key} className="lay-item">
                <div className={`lay-frame ${dev}`}><PopupMock p={p} /></div>
                <strong>{tx(p.name)}</strong>
                {!draft && <div><button type="button" className="btn" onClick={p.show}>{tx("Toon popup")}</button></div>}
              </div>
            ))}
          </div>
        </div>
      ))}
      </>}

      {!draft && open === "form" && (
        <div className="overlay" onClick={close}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); close(); }}>
            <h2>{tx("Product wijzigen")}</h2>
            <div className="grid2">
              <label>{tx("Naam")}<input defaultValue={tx("Voorbeeld")} /></label>
              <label>{tx("Artikelnummer")}<input defaultValue="A-100" /></label>
              <label>{tx("Prijs")}<input defaultValue="19,95" /></label>
              <label>{tx("Voorraad")}<input type="number" defaultValue={12} /></label>
            </div>
            <label>{tx("Omschrijving")}<textarea rows={3} defaultValue={tx("Een korte omschrijving van het product.")} /></label>
            <div className="row"><button type="button" className="btn" onClick={close}>{tx("Annuleren")}</button><button className="btn primary">{tx("Opslaan")}</button></div>
          </form>
        </div>
      )}
      {open === "table" && (
        <div className="overlay" onClick={close}>
          <div className="card modal" style={{ maxWidth: 900 }} onClick={(e) => e.stopPropagation()}>
            <h2>{tx("Bestellingen")}</h2>
            <table><thead><tr><th>{tx("Nummer")}</th><th>{tx("Naam")}</th><th>{tx("Totaal")}</th><th>{tx("Status")}</th></tr></thead>
              <tbody>{[["2026-00001", "Anna", "€ 39,90", "Betaald"], ["2026-00002", "Bram", "€ 12,50", "Nieuw"], ["2026-00003", "Chris", "€ 89,00", "Verzonden"]].map((r) => <tr key={r[0]}>{r.map((c) => <td key={c}>{c}</td>)}</tr>)}</tbody></table>
            <div className="row"><button type="button" className="btn" onClick={close}>{tx("Sluiten")}</button></div>
          </div>
        </div>
      )}
      {open === "media" && <MediaPicker onClose={close} onPick={close} />}
      {open === "editor" && <RichEditor title={tx("Tekst bewerken")} initialHtml={`<p>${tx("Zo ziet de tekstbewerker eruit.")}</p>`} onSave={async () => close()} onPlain={async () => close()} onClose={close} />}
    </div>
  );
}

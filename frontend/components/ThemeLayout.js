"use client";

import { useEffect, useState } from "react";
import Tabs from "./Tabs";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import PopupStyleGallery from "./PopupStyleGallery";
import { useUi } from "./Ui";
import { api, errorText } from "../lib/api";
import { lvl } from "../lib/perms";
import MediaPicker from "./MediaPicker";
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

function PageMock({ type, logo, v = {} }) {
  const Logo = () => (logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logo} alt="" className="lay-logo-img" /> : <i className="lay-logo" />);
  const attrs = { "data-mhl": v.header_layout || "classic", "data-mhs": v.header_style || "solid", "data-mmenu": v.menu_style || "text", "data-mfl": v.footer_layout || "simple", "data-mft": v.footer_tone || "page", "data-mblocks": v.block_style || "card" };
  if (type === "site") {
    return (
      <div className="lay-page site" {...attrs}>
        <div className="lay-top"><Logo /><span className="lay-menu"><b /><b /><b /></span><span className="lay-burger"><b /><b /><b /></span><span className="lay-actions"><i /><i /></span></div>
        <div className="lay-hero"><strong>{tx("Welkom")}</strong><span className="lay-btn primary">{tx("Meedoen")}</span></div>
        <div className="lay-cards"><i /><i /><i /></div>
        <div className="lay-foot"><span><b /><b /></span><span><b /><b /></span><span><b /><b /><b /></span></div>
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
      {!draft && <Tabs value={section} onChange={setSection} tabs={[["templates", "Pagina-indeling"], ["style", "Tabbladen en vensters"], ["pages", "Voorbeeld: pagina's"], ["popups", "Voorbeeld: popups"]]} />}
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
          {[["Header", ["header_layout", "header_style", "header_sticky"]], ["Menu", ["menu_style"]], ["Footer", ["footer_layout", "footer_tone"]], ["Blokken en kaarten", ["block_style"]]].map(([title, keys]) => (
            <div key={title} className="stack-sm">
              <strong>{tx(title)}</strong>
              {look.fields.filter((f) => keys.includes(f.key)).map((f) => (
                <div key={f.key} className="stack-sm" style={{ gap: ".4rem" }}>
                  <small className="muted">{tx(f.label)}</small>
                  <div className="preset-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                    {f.choices.map((c) => (
                      <button key={c.value} type="button" disabled={L < 2} className={`preset opt ${look.values[f.key] === c.value ? "active" : ""}`} onClick={() => pick(f.key, c.value)}>
                        {f.key !== "header_sticky" && <span className="lay-frame opt" aria-hidden="true"><PageMock type="site" v={{ ...look.values, [f.key]: c.value }} /></span>}
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

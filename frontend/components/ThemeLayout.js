"use client";

import { useState } from "react";
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

function PageMock({ type }) {
  if (type === "site") {
    return (
      <div className="lay-page site">
        <div className="lay-top"><i className="lay-logo" /><span className="lay-menu"><b /><b /><b /></span></div>
        <div className="lay-hero"><strong>{tx("Welkom")}</strong><span className="lay-btn primary">{tx("Meedoen")}</span></div>
        <div className="lay-cards"><i /><i /><i /></div>
      </div>
    );
  }
  if (type === "dash") {
    return (
      <div className="lay-page dash">
        <div className="lay-top"><i className="lay-logo" /><span className="lay-menu"><b /></span></div>
        <div className="lay-body"><div className="lay-side"><b /><b /><b /><b /></div><div className="lay-main"><div className="lay-cards"><i /><i /></div><div className="lay-card wide" /></div></div>
      </div>
    );
  }
  return (
    <div className="lay-page form">
      <div className="lay-top"><i className="lay-logo" /></div>
      <div className="lay-form"><strong>{tx("Inloggen")}</strong><span className="lay-input" /><span className="lay-input" /><span className="lay-btn primary">{tx("Inloggen")}</span></div>
    </div>
  );
}

export default function ThemeLayout() {
  const [dev, setDev] = useState("mobile");
  const [open, setOpen] = useState(null); // the large demo windows that are built here
  const POPUPS = popups(setOpen);
  const close = () => setOpen(null);
  return (
    <div className="stack-sm">
      <p className="muted" style={{ margin: 0 }}>{tx("Zo zien pagina's en popups eruit met het thema dat nu in gebruik is, op een telefoon, een iPad en een computer. De afronding, kleuren, breedte en schaduw van popups pas je aan bij Vormgeving.")}</p>
      <div className="row" style={{ justifyContent: "flex-start" }}>
        {DEV.map(([k, l, h]) => <button key={k} type="button" className={`btn ${dev === k ? "primary" : ""}`} title={tx(h)} onClick={() => setDev(k)}>{tx(l)}</button>)}
      </div>

      <h2 style={{ margin: ".5rem 0 0" }}>{tx("Pagina-indelingen")}</h2>
      <div className="lay-grid">
        {[["site", "Website-pagina"], ["dash", "Dashboard"], ["form", "Formulier (inloggen)"]].map(([t, l]) => (
          <div key={t} className="lay-item">
            <div className={`lay-frame ${dev}`}><PageMock type={t} /></div>
            <strong>{tx(l)}</strong>
          </div>
        ))}
      </div>

      <h2 style={{ margin: "1rem 0 0" }}>{tx("Popups en vensters")}</h2>
      {SIZES.map(([sz, label, hint]) => (
        <div key={sz} className="stack-sm">
          <h3 style={{ margin: ".5rem 0 0" }}>{tx(label)} <small className="muted" style={{ fontWeight: 400 }}>{tx(hint)}</small></h3>
          <div className="lay-grid">
            {POPUPS.filter((p) => (SIZE[p.key] || "s") === sz).map((p) => (
              <div key={p.key} className="lay-item">
                <div className={`lay-frame ${dev}`}><PopupMock p={p} /></div>
                <strong>{tx(p.name)}</strong>
                <div><button type="button" className="btn" onClick={p.show}>{tx("Toon popup")}</button></div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {open === "form" && (
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

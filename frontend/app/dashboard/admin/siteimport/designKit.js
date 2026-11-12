// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { IconBolt, IconCheck, IconEdit, IconEye, IconFolder, IconGrid, IconImage, IconPalette, IconSliders } from "../../../../components/Icons";
import Tabs from "../../../../components/Tabs";
import { mediaUrl } from "../../../../lib/api";
import { tx } from "../../../../lib/t";
import { buildPrompt } from "./aiPrompt";

// The steps of the design flow: key, name, one line under the name, icon.
export const STEPS = [
  ["start", "Start", "Naam, soort en taal", IconEdit], ["style", "Stijl", "Thema en sfeer", IconPalette], ["colors", "Kleuren", "Palet en weergave", IconSliders], ["pages", "Pagina's", "Menu en volgorde", IconFolder],
  ["modules", "Modules", "Plugins en objecten", IconGrid], ["photos", "Foto's", "Eigen beeld", IconImage], ["preview", "Voorbeeld", "Controleren en maken", IconEye],
];
export const LAST = STEPS.length - 1;

export const DEVICES = [["web", "Web", "100%"], ["tablet", "iPad", "820px"], ["mobile", "Mobiel", "390px"]];

export const COLOR_ROLES = [["primary", "Hoofdkleur"], ["secondary", "Tweede kleur"], ["bg", "Achtergrond"], ["card", "Kaarten"], ["text", "Tekst"], ["dark", "Donkere vlakken"]];
export const THEME_MAP = { primary: "primary", secondary: "secondary", bg: "light_bg", card: "light_card", text: "light_text", dark: "dark_bg" }; // the colour of the design -> the colour of the theme
export const DARK_ROLES = [["dbg", "Achtergrond (donker)"], ["dcard", "Kaarten (donker)"], ["dtext", "Tekst (donker)"]];
export const THEME_DARK = { dbg: "dark_bg", dcard: "dark_card", dtext: "dark_text" };
export const DEFAULT_DARK = { dbg: "#0f172a", dcard: "#1e293b", dtext: "#e2e8f0" };
export const MODES = [["light", "Licht", "Alleen de lichte weergave."], ["dark", "Donker", "Alleen de donkere weergave."], ["both", "Licht en donker", "Beide, met de lichtdonker-schakelaar van het systeem."]];
export const DEFAULT_COLORS = { primary: "#2563eb", secondary: "#f59e0b", bg: "#f8fafc", card: "#ffffff", text: "#0f172a", dark: "#0f172a" };
export const FONTS = { sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', serif: 'Georgia, "Times New Roman", serif', round: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif' };
export const FONT_NAMES = [["sans", "Modern (sans-serif)"], ["serif", "Klassiek (serif)"], ["round", "Vriendelijk (afgerond)"]];
export const STYLE_TAGS = [["modern", "Modern"], ["warm", "Warm"], ["zakelijk", "Zakelijk"], ["speels", "Speels"], ["minimalistisch", "Minimalistisch"], ["luxe", "Luxe"], ["natuurlijk", "Natuurlijk"], ["technisch", "Technisch"], ["creatief", "Creatief"], ["klassiek", "Klassiek"]];
export const PAGE_SUGGEST = {
  company: ["Home", "Over ons", "Diensten", "FAQ", "Contact"], shop: ["Home", "Producten", "Over ons", "FAQ", "Contact"], community: ["Home", "Hoe het werkt", "Veiligheid", "FAQ", "Contact"],
  agenda: ["Home", "Agenda", "Over ons", "Contact"], blog: ["Home", "Artikelen", "Over mij", "Contact"], portfolio: ["Home", "Projecten", "Over mij", "Contact"], club: ["Home", "Activiteiten", "Lid worden", "Nieuws", "Contact"],
};
export const PAGE_EXTRA = ["Prijzen", "Team", "Referenties", "Blog", "Locatie", "Veelgestelde vragen", "Nieuws"];

export const lum = (h) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export const esc = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const pagesOf = (b) => String(b.pages || "").split(",").map((p) => p.trim()).filter(Boolean);

// The page as one html text for the preview: the stylesheet, the svg pictures and the uploaded photos are put into it (the frame has no access to the other files).
export function previewHtml(files, name, photos = [], theme = "") {
  let h = files[name] || "";
  if (theme) h = /<html\b[^>]*data-theme=/i.test(h) ? h.replace(/(<html\b[^>]*data-theme=)["'][^"']*["']/i, `$1"${theme}"`) : h.replace(/<html\b/i, `<html data-theme="${theme}"`); // the design in its light or its dark mode
  const css = files["style.css"] || "";
  h = h.replace(/<link\b[^>]*stylesheet[^>]*>/gi, () => `<style>${css}</style>`);
  const find = (p) => {
    const base = p.split("?")[0].split("/").pop().toLowerCase();
    const photo = photos.find((x) => x.file === base);
    if (photo) return mediaUrl(photo.url);
    const f = files["img/" + base] || files[base];
    return f && base.endsWith(".svg") ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(f)}` : null;
  };
  h = h.replace(/(src=["'])([^"']+\.(?:svg|jpe?g|png|webp|gif))(["'])/gi, (m, a, p, b) => (find(p) ? a + find(p) + b : m));
  h = h.replace(/url\((["']?)([^)"']+\.(?:svg|jpe?g|png|webp|gif))\1\)/gi, (m, q, p) => (find(p) ? `url(${q}${find(p)}${q})` : m));
  return h;
}

// An example website in the chosen colours, font, corners and photos: what the design will look like, before any content is made (the texts are examples).
export function styleTile(b, mode = b.color_mode === "dark" ? "dark" : "light") {
  let c = { ...DEFAULT_COLORS, ...DEFAULT_DARK, ...(b.colors || {}) };
  if (mode === "dark") c = { ...c, bg: c.dbg, card: c.dcard, text: c.dtext };
  const sw = (b.langs || []).length > 0 && b.lang_switch !== false, ms = b.color_mode === "both";
  const r = b.radius ?? 14, rb = Math.max(0, r - 4), f = FONTS[b.font || "sans"], ph = (b.photos || []).slice(0, 4), pg = pagesOf(b);
  const name = esc(b.name || "Mijn website"), nav = pg.slice(0, 5), feat = (pg.slice(1, 4).length ? pg.slice(1, 4) : ["Onderdeel één", "Onderdeel twee", "Onderdeel drie"]);
  const ink = (bg) => (contrast(bg, "#ffffff") >= contrast(bg, "#111111") ? "#ffffff" : "#111111");
  const onDark = ink(c.dark), onPrimary = ink(c.primary), onSecondary = ink(c.secondary);
  const img = (i, h, tone) => (ph[i] ? `<img src="${esc(mediaUrl(ph[i].url))}" alt="" style="height:${h}px">` : `<div class="ph" style="height:${h}px;background:linear-gradient(135deg,${tone},${tone}aa)"></div>`);
  const cards = feat.map((t, i) => `<div class="card">${img(i + 1, 120, i % 2 ? c.secondary : c.primary)}<h3>${esc(t)}</h3><p>Een korte, duidelijke tekst over dit onderdeel van de website.</p><a class="lnk">Lees meer →</a></div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;font-family:${f};background:${c.bg};color:${c.text};line-height:1.6}.c{max-width:1040px;margin:0 auto;padding:0 1.4rem}a{text-decoration:none}
header{background:${c.card};border-bottom:1px solid ${c.text}1a}header .c{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.4rem;flex-wrap:wrap}.brand{font-size:1.2rem;font-weight:800;color:${c.primary}}nav{display:flex;gap:1.3rem;align-items:center}nav a{color:${c.text};font-size:.92rem}
.sw{border:1px solid ${c.text}44;border-radius:999px;padding:.15rem .6rem;font-size:.8rem}.ms{width:18px;height:18px;border-radius:50%;border:2px solid ${c.text};background:linear-gradient(90deg,${c.text} 50%,transparent 50%);display:inline-block}
.btn{display:inline-block;padding:.75rem 1.4rem;border-radius:${rb}px;font-weight:700;font-size:.95rem;margin-right:.6rem}.p{background:${c.primary};color:${onPrimary}}.o{border:2px solid currentColor;color:inherit}.s{background:${c.secondary};color:${onSecondary}}
.hero{background:${c.dark};color:${onDark};padding:3.4rem 0}.hero .c{display:grid;grid-template-columns:1.1fr 1fr;gap:2.4rem;align-items:center}.tag{display:inline-block;font-size:.78rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:.25rem .8rem;border-radius:999px;background:${c.primary};color:${onPrimary}}
.hero h1{font-size:2.5rem;line-height:1.12;margin:.8rem 0}.hero p{opacity:.85;margin:0 0 1.4rem;font-size:1.05rem}.hero .vis img,.hero .vis .ph{width:100%;object-fit:cover;border-radius:${r}px;display:block;box-shadow:0 18px 40px #0006}
section{padding:3rem 0}h2{font-size:1.7rem;margin:0 0 .4rem;line-height:1.2}.sub{margin:0 0 1.6rem;opacity:.7}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:1.1rem}
.card{background:${c.card};border:1px solid ${c.text}1a;border-radius:${r}px;padding:1.1rem;box-shadow:0 8px 22px ${c.text}12}.card img,.card .ph{width:100%;object-fit:cover;border-radius:${rb}px;display:block}.card h3{margin:.9rem 0 .35rem;font-size:1.1rem}.card p{margin:0 0 .7rem;font-size:.92rem;opacity:.8}.lnk{color:${c.primary};font-weight:700;font-size:.9rem}
.cta{background:${c.primary};color:${onPrimary};text-align:center;padding:2.6rem 0}.cta h2{margin-bottom:.6rem}.cta .btn{background:${onPrimary};color:${c.primary};margin:0}
footer{background:${c.dark};color:${onDark};padding:1.6rem 0;font-size:.88rem}footer .c{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap}footer a{color:${onDark};opacity:.8;margin-left:1rem}
@media(max-width:700px){.hero .c,.g{grid-template-columns:1fr}nav{display:none}.hero h1{font-size:1.9rem}}</style></head><body>
<header><div class="c"><span class="brand">${name}</span><nav>${nav.map((p) => `<a>${esc(p)}</a>`).join("")}${sw ? `<a class="sw">${esc(((b.lang || "").match(/\(([a-z-]+)\)/) || [0, "NL"])[1].toUpperCase())} ▾</a>` : ""}${ms ? `<a class="ms" title="${mode === "dark" ? "Donker" : "Licht"}"></a>` : ""}<a class="btn p" style="margin:0;padding:.5rem 1rem">Contact</a></nav></div></header>
<div class="hero"><div class="c"><div><span class="tag">Voorbeeld</span><h1>Een sterke kop die direct duidelijk maakt waar het om gaat</h1><p>Zo ziet gewone tekst eruit op een donker vlak, in jouw kleuren en lettertype.</p><a class="btn p">Hoofdknop</a><a class="btn o">Tweede knop</a></div><div class="vis">${img(0, 280, c.secondary)}</div></div></div>
<section><div class="c"><h2>Zo zien onderdelen eruit</h2><p class="sub">Kaarten met een afbeelding, een kop en een korte tekst.</p><div class="g">${cards}</div></div></section>
<div class="cta"><div class="c"><h2>Een duidelijke oproep om actie te ondernemen</h2><p style="margin:0 0 1.2rem;opacity:.9">Zo ziet een vlak in de hoofdkleur eruit.</p><a class="btn">Neem contact op</a></div></div>
<footer><div class="c"><span>© ${name}</span><span>${nav.map((p) => `<a>${esc(p)}</a>`).join("")}</span></div></footer></body></html>`;
}


export function Swatches({ colors, size = 22 }) {
  return <span style={{ display: "inline-flex" }}>{colors.filter(Boolean).map((c, i) => <i key={i} title={c} style={{ width: size, height: size, borderRadius: 6, background: c, border: "1px solid var(--line)", marginRight: -4, boxShadow: "0 0 0 2px var(--card)" }} />)}</span>;
}

export function Field({ label, hint, children }) { return <label className="dw-f">{tx(label)}{hint && <> <small className="muted">{tx(hint)}</small></>}{children}</label>; }

export const EN_TAGS = { modern: "modern", warm: "warm", zakelijk: "business-like", speels: "playful", minimalistisch: "minimalist", luxe: "luxurious", natuurlijk: "natural", technisch: "technical", creatief: "creative", klassiek: "classic" };

// The prompt for an external AI (Claude, ChatGPT, Gemini...) made from everything that was chosen in the step plan: the AI makes the website as HTML pages in a ZIP that can be read back in here.
export function DesignPromptPopup({ b, catalog, onClose }) {
  const [tab, setTab] = useState("prompt");
  const [copied, setCopied] = useState(false);
  const photos = (b.photos || []).filter((p) => p.file);
  const text = buildPrompt({
    name: b.name, kind: b.kind, lang: b.lang, pages: b.pages, extra: b.extra,
    style: [...(b.style_tags || []).map((t) => EN_TAGS[t] || t), b.style].filter(Boolean).join(", "),
    modules: (catalog?.modules || []).filter((m) => !(b.modules_off || []).includes(m.key)), objects: (catalog?.objects || []).filter((o) => (b.objects || []).includes(o.slug)),
    palette: Object.keys(b.colors || {}).length ? { ...DEFAULT_COLORS, ...DEFAULT_DARK, ...b.colors } : null, colorMode: b.color_mode || "light",
    languages: { main: b.lang || "", extra: (b.langs || []).map((c) => (catalog?.languages || []).find((l) => l.code === c)).filter(Boolean), switcher: b.lang_switch !== false }, font: FONTS[b.font || "sans"], radius: b.radius ?? null, theme: b.theme_name || "", photos,
  });
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { document.getElementById("si-dprompt")?.select(); document.execCommand("copy"); }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); a.download = `${(b.name || "website").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-prompt.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const chips = [[tx("Pagina's"), pagesOf(b).length], [tx("Modules"), (catalog?.modules || []).filter((m) => !(b.modules_off || []).includes(m.key)).length], [tx("Systeemobjecten"), (b.objects || []).length], [tx("Foto's"), photos.length]];
  return createPortal(
    <div className="pb-objback" style={{ zIndex: 1300 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pb-objpop" role="dialog" aria-label={tx("AI-prompt voor een externe AI")} style={{ width: "min(900px, 94vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="pb-objhead"><strong>{tx("AI-prompt voor een externe AI")}</strong><span style={{ flex: 1 }} /><button type="button" className="pb-panelx" onClick={onClose} aria-label={tx("Sluiten")}>×</button></div>
        <div style={{ padding: "1rem 1.2rem 1.2rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: ".8rem" }}>
          <Tabs value={tab} onChange={setTab} tabs={[["prompt", "Prompt"], ["how", "Zo gebruik je het"]]} />
          {tab === "prompt" && (
            <div className="form">
              <p className="muted" style={{ margin: 0 }}>{tx("Deze prompt is gemaakt van je keuzes: stijl, kleuren, pagina's, modules, systeemobjecten en foto's. Een externe AI maakt er een ZIP-bestand mee met HTML-pagina's die je hier weer inleest.")}</p>
              <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>{chips.map(([l, n]) => <span key={l} className="badge">{l}: {n}</span>)}{b.theme_name && <span className="badge">{tx("Thema")}: {b.theme_name}</span>}</div>
              <textarea id="si-dprompt" readOnly rows={16} value={text} onFocus={(e) => e.target.select()} style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: ".82rem" }} />
              <div className="row" style={{ justifyContent: "flex-start", alignItems: "center" }}>
                <button type="button" className="btn primary" onClick={copy}><IconBolt /> {copied ? tx("Gekopieerd") : tx("Prompt kopiëren")}</button>
                <button type="button" className="btn" onClick={download}>{tx("Downloaden als tekstbestand")}</button>
                <small className="muted">{text.length.toLocaleString()} {tx("tekens")}</small>
              </div>
            </div>
          )}
          {tab === "how" && (
            <ol className="muted" style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: ".5rem" }}>
              <li>{tx("Kopieer de prompt en plak hem in een AI die bestanden kan maken (Claude, ChatGPT, Gemini).")}</li>
              <li>{tx("De AI levert één ZIP-bestand op met de HTML-pagina's, style.css en de illustraties. Je foto's staan er niet in: die zijn al bewaard in dit ontwerp en worden bij het importeren toegevoegd.")}</li>
              <li>{tx("Kom terug naar dit ontwerp, ga naar stap 1 en klik op ZIP-bestand inlezen. Claude verbetert het ontwerp daarna met je kleuren, foto's en modules, of je gaat meteen naar de stappen en importeert het.")}</li>
              <li>{tx("Kies bij het importeren de weergave Bewerkbaar: dan worden de pagina's opgebouwd met de blokken van de pagina-editor en komen de systeemobjecten als levende blokken op hun plek.")}</li>
            </ol>
          )}
        </div>
      </div>
    </div>, document.body);
}


// The overview of ALL modules and plugins of the system that a website can use (also new ones that are added later: they are on by default) and its system objects (live blocks).
export function ModulePicker({ catalog, off, objects, onChange }) {
  const [q, setQ] = useState("");
  if (!catalog) return <div className="dw-panel"><span className="muted">{tx("Laden…")}</span></div>;
  const toggle = (list, k) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  const keys = catalog.modules.map((m) => m.key), shown = catalog.modules.filter((m) => !q.trim() || `${m.label} ${m.desc}`.toLowerCase().includes(q.trim().toLowerCase()));
  const onCount = keys.filter((k) => !off.includes(k)).length, kinds = [...new Set(catalog.objects.map((o) => o.kind_label))];
  return (
    <>
      <style>{DW_CSS}</style>
      <div className="dw-panel">
        <div className="dw-ph"><h3>{tx("Modules en plugins")} <span className="dw-count">{onCount} / {keys.length} {tx("aan")}</span></h3>
          <span className="dw-tools"><input className="dw-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoeken…")} aria-label={tx("Zoeken…")} /><button type="button" className="btn sm" onClick={() => onChange({ off: [], objects })}>{tx("Alles aan")}</button><button type="button" className="btn sm" onClick={() => onChange({ off: keys, objects })}>{tx("Alles uit")}</button></span></div>
        <p className="dw-hint">{tx("Alles wat je systeem kan staat standaard aan. De AI richt de pagina's er op in (de juiste knoppen, links en onderdelen) en bij het importeren worden ze aangezet. Zet uit wat je niet wilt; nieuwe modules en plugins komen hier vanzelf bij.")}</p>
        <div className="dw-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}>
          {shown.map((m) => { const on = !off.includes(m.key); return (
            <label key={m.key} className={`dw-mod ${on ? "on" : ""}`}>
              <span className="switch"><input type="checkbox" checked={on} onChange={() => onChange({ off: toggle(off, m.key), objects })} /><span /></span>
              <span className="dw-mod-t"><b>{tx(m.label)}</b>
                <small>{tx(m.desc) || "—"}</small>
                <span className="dw-tags"><i className={m.enabled ? "ok" : ""}>{m.enabled ? tx("aan in het systeem") : tx("uit in het systeem")}</i>{m.kind === "plugin" && <i>{tx("plugin")}</i>}{m.auto && <i>{tx("automatisch")}</i>}</span></span>
            </label>); })}
          {!shown.length && <span className="muted">{tx("Niets gevonden.")}</span>}
        </div>
      </div>
      <div className="dw-panel">
        <div className="dw-ph"><h3>{tx("Systeemobjecten")} <span className="dw-count">{objects.length} {tx("gekozen")}</span></h3>
          <span className="dw-tools"><button type="button" className="btn sm" onClick={() => onChange({ off, objects: catalog.objects.map((o) => o.slug) })}>{tx("Alles aan")}</button><button type="button" className="btn sm" onClick={() => onChange({ off, objects: [] })}>{tx("Alles uit")}</button></span></div>
        <p className="dw-hint">{tx("Systeemobjecten zijn kant-en-klare, levende blokken (zoals het productenoverzicht, de agenda, een abonnement of een donatieknop). De AI zet ze op de plek waar ze passen; je kunt ze daarna in de pagina-editor verplaatsen. Ze werken bij de weergave Bewerkbaar.")}</p>
        {!catalog.objects.length && <span className="muted">{tx("Er zijn nog geen systeemobjecten beschikbaar.")}</span>}
        {kinds.map((kd) => (
          <div key={kd}>
            <small className="muted">{kd}</small>
            <div className="dw-chips">
              {catalog.objects.filter((o) => o.kind_label === kd).map((o) => { const on = objects.includes(o.slug); return <button type="button" key={o.slug} className={`dw-chip ${on ? "on" : ""}`} aria-pressed={on} title={o.slug} onClick={() => onChange({ off, objects: toggle(objects, o.slug) })}>{on && <IconCheck />} {o.name}</button>; })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// The look of the design flow (stepper, panels, tiles). Uses the colours of the system, so it follows the light and dark mode.
export const DW_CSS = `
.dw{display:grid;grid-template-columns:276px minmax(0,1fr);flex:1;min-height:0;background:var(--bg)}
.dw-side{border-right:1px solid var(--line);background:var(--card);padding:1.3rem 1rem 1rem;display:flex;flex-direction:column;gap:1.1rem;overflow-y:auto}
.dw-brand strong{display:block;font-size:1.05rem;line-height:1.25;overflow-wrap:anywhere}.dw-brand small{color:var(--muted);font-size:.78rem}
.dw-bar{height:5px;border-radius:99px;background:var(--line);overflow:hidden;margin-top:.6rem}.dw-bar i{display:block;height:100%;background:var(--blue);border-radius:99px;transition:width .35s}
.dw-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;flex:1}
.dw-steps li:not(:last-child)::after{content:"";display:block;width:2px;height:9px;background:var(--line);margin:0 0 0 .95rem}
.dw-step{display:flex;gap:.8rem;align-items:center;width:100%;text-align:left;background:none;border:0;padding:.5rem .55rem;border-radius:12px;color:var(--text);cursor:pointer;font:inherit}
.dw-step:hover{background:var(--hover)}.dw-step.on{background:color-mix(in srgb,var(--blue) 12%,transparent)}
.dw-dot{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--line);color:var(--muted);flex:none;background:var(--card);transition:all .2s}
.dw-dot svg{width:17px;height:17px}.dw-step.done .dw-dot{border-color:var(--blue);color:var(--blue)}.dw-step.on .dw-dot{background:var(--blue);border-color:var(--blue);color:#fff;box-shadow:0 4px 12px color-mix(in srgb,var(--blue) 40%,transparent)}
.dw-txt{display:flex;flex-direction:column;min-width:0}.dw-txt b{font-size:.92rem;font-weight:650}.dw-txt small{color:var(--muted);font-size:.76rem}
.dw-side-foot{display:flex;flex-direction:column;gap:.6rem;font-size:.8rem;color:var(--muted)}
.dw-main{display:flex;flex-direction:column;min-width:0;min-height:0}
.dw-head{padding:1.5rem 2.2rem .5rem}.dw-kicker{font-size:.72rem;letter-spacing:.09em;text-transform:uppercase;color:var(--blue);font-weight:700}
.dw-head h2{margin:.15rem 0 .35rem;font-size:1.6rem;line-height:1.2}.dw-head p{margin:0;color:var(--muted);max-width:62rem}
.dw-body{flex:1;overflow-y:auto;padding:1rem 2.2rem 1.8rem;display:flex;flex-direction:column;gap:1.1rem}
.dw-panel{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:1.2rem 1.35rem;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:.95rem}
.dw-panel h3{margin:0;font-size:1rem}.dw-ph{display:flex;justify-content:space-between;align-items:center;gap:.8rem;flex-wrap:wrap}.dw-tools{display:flex;gap:.45rem;align-items:center;flex-wrap:wrap}
.dw-hint{margin:-.45rem 0 0;color:var(--muted);font-size:.85rem;max-width:60rem}.dw-count{font-size:.75rem;font-weight:600;color:var(--muted);margin-left:.4rem;background:var(--hover);border:1px solid var(--line);border-radius:99px;padding:.1rem .55rem}
.dw-search{max-width:190px}
.dw-foot{border-top:1px solid var(--line);padding:.85rem 2.2rem;display:flex;align-items:center;gap:1rem;justify-content:space-between;background:var(--card)}
.dw-foot .dw-note{color:var(--muted);font-size:.8rem;flex:1;text-align:center}
.dw-grid{display:grid;gap:.9rem}.dw-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}
.dw-f{display:flex;flex-direction:column;gap:.35rem;font-weight:600;font-size:.84rem}.dw-f small{font-weight:400;color:var(--muted)}
.dw-opt{border:1.5px solid var(--line);border-radius:14px;background:var(--card);padding:.9rem;text-align:left;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s;color:var(--text);font:inherit;display:flex;flex-direction:column;gap:.3rem}
.dw-opt:hover{border-color:var(--muted);transform:translateY(-1px)}.dw-opt.on{border-color:var(--blue);box-shadow:0 0 0 3px color-mix(in srgb,var(--blue) 22%,transparent)}
.dw-opt b{font-size:.95rem}.dw-opt small{color:var(--muted);font-size:.8rem}
.dw-pal{display:flex;height:60px;border-radius:12px;overflow:hidden;border:1px solid var(--line)}.dw-pal div{flex:1}
.dw-band{display:flex;height:46px;border-radius:9px;overflow:hidden;margin:-.1rem 0 .2rem;border:1px solid var(--line)}.dw-band i{flex:1}
.dw-chips{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.35rem}
.dw-chip{display:inline-flex;align-items:center;gap:.35rem;border:1.5px solid var(--line);background:var(--card);color:var(--text);border-radius:99px;padding:.38rem .9rem;font:inherit;font-size:.84rem;cursor:pointer;transition:all .15s}
.dw-chip svg{width:14px;height:14px}.dw-chip:hover{border-color:var(--muted)}.dw-chip.on{background:var(--blue);border-color:var(--blue);color:#fff}
.dw-mod{display:flex;gap:.8rem;align-items:flex-start;border:1.5px solid var(--line);border-radius:14px;padding:.8rem .9rem;cursor:pointer;background:var(--card);transition:all .15s}
.dw-mod.on{border-color:color-mix(in srgb,var(--blue) 55%,var(--line));background:color-mix(in srgb,var(--blue) 5%,var(--card))}.dw-mod-t{display:flex;flex-direction:column;gap:.15rem;min-width:0}
.dw-mod-t small{color:var(--muted);font-size:.8rem;line-height:1.35}.dw-tags{display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.25rem}
.dw-tags i{font-style:normal;font-size:.68rem;padding:.08rem .5rem;border-radius:99px;border:1px solid var(--line);color:var(--muted)}.dw-tags i.ok{color:var(--ok-fg);background:var(--ok-bg);border-color:transparent}
.dw-mode svg{width:34px;height:34px;margin-bottom:.2rem}
.dw-color{display:flex;align-items:center;gap:.7rem;border:1px solid var(--line);border-radius:12px;padding:.5rem .65rem}.dw-color input[type=color]{width:44px;height:38px;padding:0;border:0;background:none;cursor:pointer}.dw-color span{flex:1;min-width:0}.dw-color b{display:block;font-size:.82rem}.dw-color input[type=text]{max-width:104px;font-family:ui-monospace,Menlo,monospace}
.dw-drop{border:2px dashed var(--line);border-radius:14px;padding:1.6rem;text-align:center;color:var(--muted);cursor:pointer;transition:all .15s}.dw-drop:hover{border-color:var(--blue);color:var(--text)}
.dw-photo{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--card);display:flex;flex-direction:column}.dw-photo img{width:100%;height:140px;object-fit:cover;display:block}.dw-photo div{padding:.6rem;display:flex;flex-direction:column;gap:.4rem}
.dw-page{display:flex;gap:.6rem;align-items:center;border:1px solid var(--line);border-radius:12px;padding:.45rem .6rem;background:var(--card)}.dw-page>b{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--hover);font-size:.75rem;color:var(--muted);flex:none}
.dw-zip{display:flex;gap:1rem;align-items:center;flex-wrap:wrap;border:1.5px dashed var(--line);border-radius:14px;padding:1rem 1.1rem}.dw-zip>span{flex:1;min-width:220px}
.dw-doc{border:1px solid var(--line);border-radius:14px;padding:.8rem .95rem;display:flex;flex-direction:column;gap:.7rem;background:var(--card)}.dw-doc-h{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap}.dw-doc-h>svg{width:22px;height:22px;color:var(--muted);flex:none}
.dw-doc-b{display:flex;flex-direction:column;gap:.7rem}.dw-doc-b ul{margin:.25rem 0 0;padding-left:1.15rem;display:flex;flex-direction:column;gap:.15rem;font-size:.9rem}
.dw-prog{height:9px;border-radius:99px;background:var(--line);overflow:hidden}.dw-prog i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--blue),color-mix(in srgb,var(--blue) 55%,#fff));transition:width .5s;background-size:200% 100%;animation:dwflow 1.6s linear infinite}@keyframes dwflow{from{background-position:200% 0}to{background-position:0 0}}
.dw-tag{display:inline-flex;align-items:center;gap:.3rem;font-size:.78rem;padding:.2rem .65rem;border-radius:99px;background:var(--ok-bg);color:var(--ok-fg)}.dw-tag svg{width:13px;height:13px}
.dw-stat{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.8rem}.dw-stat>div{border:1px solid var(--line);border-radius:14px;padding:.8rem .9rem;background:var(--card);display:flex;flex-direction:column;gap:.15rem}.dw-stat small{color:var(--muted)}
@media (max-width:900px){.dw{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.dw-side{flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid var(--line);padding:.55rem}.dw-steps{flex-direction:row}.dw-steps li::after{display:none}.dw-txt small,.dw-brand,.dw-side-foot{display:none}.dw-head,.dw-body,.dw-foot{padding-left:1rem;padding-right:1rem}.dw-2{grid-template-columns:1fr}.dw-foot .dw-note{display:none}}
`;

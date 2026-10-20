"use client";

import { Busy } from "./PageLoader";
import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { useAutoSave } from "../lib/autosave";
import { tx } from "../lib/t";
import SaveStatus from "./SaveStatus";
import Tabs from "./Tabs";
import MenuPreview from "./MenuPreview";
import { DEFAULT_MENU } from "./SiteMenu";

// Settings of the header menu: the form per device (computer, tablet, phone), the behaviour of the sub menus and the style of the items. Saved by itself.
const DEVICES = [["desktop", "Computer", "Breed scherm"], ["tablet", "Tablet", "iPad en kleine laptops"], ["mobile", "Telefoon", "Smalle schermen"]];
const FORMS = [
  ["bar", "Menubalk", "Alle items naast elkaar in de header"],
  ["hamburger", "Hamburger-menu", "Een knop die een lijstje onder de header opent"],
  ["drawer-left", "Zijpaneel links", "Het menu schuift van links in beeld"],
  ["drawer-right", "Zijpaneel rechts", "Het menu schuift van rechts in beeld"],
  ["fullscreen", "Volledig scherm", "Het menu beslaat het hele scherm, groot en gecentreerd"],
  ["bottom", "Balk onderaan", "Vaste menubalk onderin, zoals een app"],
];
const SUBS = [["dropdown", "Dropdown", "Een lijstje onder het item"], ["mega", "Megamenu", "Een breed paneel met kolommen"], ["accordion", "Uitklappen", "De items klappen onder hun ouder open"]];
const OPEN = [["hover", "Bij aanwijzen"], ["click", "Bij klikken"]];
const ALIGN = [["left", "Links"], ["center", "Midden"], ["right", "Rechts"]];
const bars = (f) => f === "bar" || f === "bottom";
const STYLES = [["theme", "Zoals het thema"], ["text", "Alleen tekst"], ["underline", "Onderstreept"], ["pill", "Afgeronde knoppen"], ["button", "Knoppen"], ["outline", "Met kader"]];
const FLOATS = [["none", "Niets", "Het menu blijft zoals het is"], ["shadow", "Schaduw", "Er komt een schaduw onder de header"], ["float", "Zwevend", "De header wordt een zwevende afgeronde balk"], ["hide", "Verdwijnt", "Weg bij naar beneden scrollen, terug bij omhoog"]];
const SIZES = [["sm", "Klein"], ["md", "Normaal"], ["lg", "Groot"]];

// small drawings of the menu forms: the example tiles to choose from
const L = { stroke: "var(--muted)", strokeWidth: 2, strokeLinecap: "round" };
const A = { stroke: "var(--blue)", strokeWidth: 2.4, strokeLinecap: "round" };
function Mini({ kind }) {
  const frame = <rect x="1" y="1" width="78" height="54" rx="6" fill="var(--bg)" stroke="var(--line)" />;
  const head = <rect x="1" y="1" width="78" height="12" rx="6" fill="var(--card)" stroke="var(--line)" />;
  const draw = {
    bar: <>{head}<path d="M8 7h10M24 7h10M40 7h10M56 7h10" {...L} /><path d="M24 7h10" {...A} /></>,
    hamburger: <>{head}<path d="M66 5h8M66 7.5h8M66 10h8" {...L} /><rect x="42" y="16" width="34" height="26" rx="4" fill="var(--card)" stroke="var(--line)" /><path d="M47 23h24M47 29h24M47 35h24" {...L} /></>,
    "drawer-left": <>{head}<rect x="1" y="13" width="36" height="42" fill="var(--card)" stroke="var(--line)" /><path d="M7 22h22M7 29h22M7 36h22" {...L} /><rect x="37" y="13" width="42" height="42" fill="#000" opacity=".25" /></>,
    "drawer-right": <>{head}<rect x="43" y="13" width="36" height="42" fill="var(--card)" stroke="var(--line)" /><path d="M49 22h22M49 29h22M49 36h22" {...L} /><rect x="1" y="13" width="42" height="42" fill="#000" opacity=".25" /></>,
    fullscreen: <><rect x="1" y="1" width="78" height="54" rx="6" fill="var(--card)" stroke="var(--line)" /><path d="M66 8l6 6M72 8l-6 6" {...L} /><path d="M28 18h24M24 27h32M28 36h24" {...L} /><path d="M24 27h32" {...A} /></>,
    bottom: <><rect x="1" y="1" width="78" height="54" rx="6" fill="var(--bg)" stroke="var(--line)" /><rect x="1" y="42" width="78" height="13" rx="6" fill="var(--card)" stroke="var(--line)" /><path d="M10 49h10M30 49h10M50 49h10" {...L} /><path d="M30 49h10" {...A} /></>,
    dropdown: <>{head}<path d="M8 7h10M24 7h10M40 7h10" {...L} /><path d="M24 7h10" {...A} /><rect x="20" y="15" width="26" height="24" rx="4" fill="var(--card)" stroke="var(--line)" /><path d="M25 22h16M25 28h16M25 34h16" {...L} /></>,
    mega: <>{head}<path d="M8 7h10M24 7h10M40 7h10" {...L} /><path d="M24 7h10" {...A} /><rect x="10" y="15" width="60" height="30" rx="4" fill="var(--card)" stroke="var(--line)" /><path d="M16 23h18M16 30h18M16 37h18M42 23h18M42 30h18M42 37h18" {...L} /></>,
    none: <>{head}<path d="M8 7h10M24 7h10M40 7h10" {...L} /><path d="M10 26h60M10 34h44" {...L} opacity=".5" /></>,
    shadow: <><rect x="1" y="1" width="78" height="12" rx="6" fill="var(--card)" stroke="var(--line)" /><rect x="1" y="13" width="78" height="5" fill="#000" opacity=".35" /><path d="M8 7h10M24 7h10M40 7h10" {...L} /><path d="M10 30h60M10 38h44" {...L} opacity=".5" /></>,
    float: <><rect x="6" y="6" width="68" height="13" rx="7" fill="var(--card)" stroke="var(--line)" /><rect x="6" y="21" width="68" height="3" rx="1.5" fill="#000" opacity=".3" /><path d="M14 12.5h10M30 12.5h10M46 12.5h10" {...L} /><path d="M10 34h60M10 42h44" {...L} opacity=".5" /></>,
    hide: <>{head}<path d="M8 7h10M24 7h10M40 7h10" {...L} opacity=".4" /><path d="M40 24v18M34 36l6 6 6-6" {...A} /><path d="M10 50h60" {...L} opacity=".5" /></>,
    accordion: <>{frame}<path d="M10 12h40M10 22h30" {...L} /><path d="M10 22h30" {...A} /><path d="M20 30h26M20 38h26M20 46h26" {...L} opacity=".7" /></>,
  }[kind];
  return <svg viewBox="0 0 80 56" width="80" height="56" aria-hidden="true">{draw}</svg>;
}
const sample = (style) => (
  <nav className={`hmenu s-${style} z-sm`} style={{ pointerEvents: "none" }}><a>Home</a><a className="active">Over</a></nav>
);
function Tiles({ value, onChange, options, disabled, render }) {
  return (
    <div className="opt-tiles" role="radiogroup">
      {options.map(([k, l, hint]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} disabled={disabled} className={`opt-tile${value === k ? " on" : ""}`} onClick={() => onChange(k)} title={hint ? tx(hint) : undefined}>
          <span className="opt-art">{render(k)}</span>
          <span className="opt-name">{tx(l)}</span>
        </button>
      ))}
    </div>
  );
}

const Sw = ({ label, hint, checked, onChange, disabled }) => (
  <label className="check sec-toggle">
    <span className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span>
    <span>{label}{hint && <small className="muted"> {hint}</small>}</span>
  </label>
);

export default function MenuSettingsAdmin({ canEdit = true }) {
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState(null);
  const [tabs, setTabs] = useState({}); // per device: example | settings
  const [items, setItems] = useState([]);
  useEffect(() => { api("/pages/menu/").then((d) => setItems(d.items || [])).catch(() => {}); }, []);
  useEffect(() => { api("/pages/menu-settings/").then((d) => setCfg({ ...DEFAULT_MENU, ...d })).catch((e) => setMsg(errorText(e))); }, []);
  const auto = useAutoSave(cfg, async () => { try { setCfg(await api("/pages/menu-settings/", { method: "PUT", body: cfg })); window.dispatchEvent(new Event("pages-changed")); setMsg(null); } catch (e) { setMsg(errorText(e)); return false; } }, { ready: !!cfg && canEdit, delay: 800 });
  if (!cfg) return msg ? <div className="alert">{msg}</div> : <Busy />;
  const set = (patch) => setCfg({ ...cfg, ...patch });
  const setDev = (key, dev, v) => setCfg({ ...cfg, [key]: { ...cfg[key], [dev]: v } });
  return (
    <div className="form" style={{ gap: "1.2rem" }}>
      {msg && <div className="alert">{msg}</div>}
      <p className="muted" style={{ margin: 0 }}>{tx("Kies per apparaat hoe het menu in de header eruitziet en werkt. Per menu-item stel je in op welke apparaten het zichtbaar is (bij Opmaak van het item). Wijzigingen worden automatisch opgeslagen.")} <SaveStatus auto={auto} /></p>

      <div className="menu-dev-grid">
        {DEVICES.map(([dev, name, hint]) => (
          <div key={dev} className="card menu-dev">
            <strong>{tx(name)}</strong><small className="muted">{tx(hint)}{dev !== "desktop" ? ` · ≤ ${cfg.breakpoints[dev]} px` : ""}</small>
            <Tabs value={tabs[dev] || "example"} onChange={(v) => setTabs({ ...tabs, [dev]: v })} tabs={[["example", "Voorbeeld"], ["settings", "Instellingen"]]} />
            {(tabs[dev] || "example") === "example" && <MenuPreview items={items} cfg={cfg} device={dev} />}
            {(tabs[dev] || "example") === "settings" && (<>
            <div><strong className="opt-title">{tx("Vorm van het menu")}</strong>
              <Tiles value={cfg.forms[dev]} onChange={(v) => setDev("forms", dev, v)} options={FORMS} disabled={!canEdit} render={(k) => <Mini kind={k} />} />
              <small className="muted">{tx(FORMS.find(([k]) => k === cfg.forms[dev])?.[2] || "")}</small>
            </div>
            <div><strong className="opt-title">{tx("Submenu")}</strong>
              <Tiles value={cfg.sub[dev]} onChange={(v) => setDev("sub", dev, v)} options={SUBS} disabled={!canEdit} render={(k) => <Mini kind={k} />} />
              <small className="muted">{tx(SUBS.find(([k]) => k === cfg.sub[dev])?.[2] || "")}</small>
            </div>
            <label>{tx("Submenu opent")}
              <select disabled={!canEdit} value={cfg.open_on[dev]} onChange={(e) => setDev("open_on", dev, e.target.value)}>{OPEN.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select>
            </label>
            <label>{tx("Hoogte van de header (px)")}
              <input type="number" min={0} max={160} placeholder={tx("Thema")} disabled={!canEdit} value={cfg.height?.[dev] || ""} onChange={(e) => setCfg({ ...cfg, height: { ...(cfg.height || {}), [dev]: e.target.value === "" ? 0 : Number(e.target.value) } })} />
              <small className="muted">{tx("Leeg = zoals het thema (40 tot 160)")}</small>
            </label>
            <label>{tx("Positie van het menu in de header")}
              <select disabled={!canEdit} value={cfg.align[dev]} onChange={(e) => setDev("align", dev, e.target.value)}>{ALIGN.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select>
              <small className="muted">{tx("Links, midden of rechts in de header (bij een menubalk)")}</small>
            </label>
            <label>{tx("Positie van het hamburger-icoon")}
              <select disabled={!canEdit || bars(cfg.forms[dev])} value={cfg.toggle_pos?.[dev] || "right"} onChange={(e) => setDev("toggle_pos", dev, e.target.value)}>{ALIGN.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select>
              {bars(cfg.forms[dev]) && <small className="muted">{tx("Alleen bij hamburger, zijpaneel of volledig scherm")}</small>}
            </label>
            </>)}
          </div>
        ))}
      </div>

      <div className="card form">
        <strong>{tx("Items")}</strong>
        <div><strong className="opt-title">{tx("Stijl van de items")}</strong>
          <Tiles value={cfg.item_style} onChange={(v) => set({ item_style: v })} options={STYLES} disabled={!canEdit} render={(k) => sample(k)} />
        </div>
        <div><strong className="opt-title">{tx("Grootte")}</strong>
          <Tiles value={cfg.size} onChange={(v) => set({ size: v })} options={SIZES} disabled={!canEdit} render={(k) => <span className={`opt-aa z-${k}`}>Aa</span>} />
        </div>
        <Sw label={tx("Hoofdletters")} checked={cfg.uppercase} disabled={!canEdit} onChange={(v) => set({ uppercase: v })} />
        <Sw label={tx("Pijltje bij items met een submenu")} checked={cfg.arrows} disabled={!canEdit} onChange={(v) => set({ arrows: v })} />
        <Sw label={tx("Menu sluiten na een klik op een link")} checked={cfg.close_on_click} disabled={!canEdit} onChange={(v) => set({ close_on_click: v })} />
        <Sw label={tx("Pagina dimmen achter zijpaneel en volledig scherm")} checked={cfg.overlay} disabled={!canEdit} onChange={(v) => set({ overlay: v })} />
      </div>

      <div className="card form">
        <strong>{tx("Uiterlijk van de header")}</strong>
        <div className="theme-grid">
          <label>{tx("Achtergrondkleur")}
            <span className="row" style={{ flexWrap: "nowrap", justifyContent: "flex-start", gap: ".5rem" }}>
              <input type="color" disabled={!canEdit} value={cfg.bg || "#151b2b"} onChange={(e) => set({ bg: e.target.value })} style={{ width: "3.2rem", height: "2.6rem", padding: 2 }} />
              <button type="button" className="btn sm" disabled={!canEdit || !cfg.bg} onClick={() => set({ bg: "" })}>{tx("Zoals het thema")}</button>
            </span>
          </label>
          <label>{tx("Doorzichtigheid")} <small className="muted">{Math.round((cfg.bg_opacity ?? 0.88) * 100)}% {tx("zichtbaar")}</small>
            <input type="range" min={0} max={1} step={0.02} disabled={!canEdit} value={cfg.bg_opacity ?? 0.88} onChange={(e) => set({ bg_opacity: Number(e.target.value) })} />
          </label>
          <label>{tx("Vervaging achter de header")} <small className="muted">{cfg.blur ?? 10} px</small>
            <input type="range" min={0} max={30} step={1} disabled={!canEdit} value={cfg.blur ?? 10} onChange={(e) => set({ blur: Number(e.target.value) })} />
          </label>
        </div>
        <div><strong className="opt-title">{tx("Na het scrollen")}</strong>
          <Tiles value={cfg.float} onChange={(v) => set({ float: v })} options={FLOATS} disabled={!canEdit} render={(k) => <Mini kind={k} />} />
          <small className="muted">{tx(FLOATS.find(([k]) => k === cfg.float)?.[2] || "")}</small>
        </div>
        {cfg.float !== "none" && (
          <label style={{ maxWidth: 260 }}>{tx("Na hoeveel pixels scrollen")}
            <input type="number" min={10} max={600} disabled={!canEdit} value={cfg.float_after ?? 80} onChange={(e) => e.target.value !== "" && set({ float_after: Number(e.target.value) })} />
          </label>
        )}
      </div>

      <div className="card form">
        <strong>{tx("Wanneer is het een tablet of telefoon?")}</strong>
        <div className="theme-grid">
          <label>{tx("Tablet: schermen tot (px)")}<input type="number" min={700} max={1600} disabled={!canEdit} value={cfg.breakpoints.tablet} onChange={(e) => e.target.value !== "" && set({ breakpoints: { ...cfg.breakpoints, tablet: Number(e.target.value) } })} /></label>
          <label>{tx("Telefoon: schermen tot (px)")}<input type="number" min={320} max={1200} disabled={!canEdit} value={cfg.breakpoints.mobile} onChange={(e) => e.target.value !== "" && set({ breakpoints: { ...cfg.breakpoints, mobile: Number(e.target.value) } })} /></label>
        </div>
        <button type="button" className="btn" disabled={!canEdit} onClick={() => setCfg({ ...DEFAULT_MENU })} style={{ alignSelf: "flex-start" }}>{tx("Standaardinstellingen terugzetten")}</button>
      </div>
    </div>
  );
}

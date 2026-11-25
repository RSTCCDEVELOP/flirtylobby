// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../../../../lib/t";
import { useEffect, useState } from "react";
import { api, errorText } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { TILES } from "../../../../lib/admin-tiles";
import { loadAdminSetup, setAdminSetup, SETUP_DEFAULTS } from "../../../../lib/adminsetup";
import { useAuth } from "../../../../components/AuthContext";
import Tabs from "../../../../components/Tabs";
import { IconGrid, IconHome, IconMenu } from "../../../../components/Icons";

// easy2edit admin setup: the starting values of the admin and the dashboards for the whole website. A person can still choose for himself (tiles or list, page size, sidebar).
const SIZES = [["5", "5"], ["10", "10"], ["25", "25"], ["100", "100"], ["all", "Alles"]];
const BLOCKS = [
  ["ai", "AI-gebruik", "Het blok met het AI-gebruik en de kosten (alleen voor wie AI beheert)."],
  ["presets", "Standaard installaties", "Het blok om in één keer een soort website in te stellen."],
  ["backup", "Instellingen back-up", "Het blok om de instellingen op te slaan en terug te zetten (superadmin)."],
  ["about", "Over easy2edit", "De uitleg, de handleiding en de vermelding onderaan."],
];

function Switch({ checked, onChange, label, hint, disabled }) {
  return (
    <label className="switch-row" style={{ display: "flex", alignItems: "center", gap: ".7rem", padding: ".55rem .8rem", borderRadius: 10, background: "color-mix(in srgb, var(--primary) 6%, var(--card))", border: "1px solid var(--line)", opacity: disabled ? 0.6 : 1 }}>
      <span className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span>
      <span style={{ minWidth: 0 }}><strong>{tx(label)}</strong>{hint && <small className="muted" style={{ display: "block" }}>{tx(hint)}</small>}</span>
    </label>
  );
}

function Seg({ rows, value, onChange, label }) {
  return (
    <div className="stack-sm"><strong>{tx(label)}</strong>
      <span className="pb-seg" role="group" aria-label={tx(label)}>
        {rows.map(([k, l]) => <button type="button" key={k} className={value === k ? "on" : ""} aria-pressed={value === k} onClick={() => onChange(k)}>{tx(l)}</button>)}
      </span>
    </div>
  );
}

export default function AdminSetup() {
  const { user } = useAuth();
  const [tab, setTab] = useState("tiles");
  const [s, setS] = useState(SETUP_DEFAULTS);
  const [can, setCan] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { api("/admin-setup/").then((d) => { setS(d.settings); setCan(!!d.can_edit); }).catch((e) => setErr(errorText(e))); loadAdminSetup(); }, []);

  async function save(patch) {  // every change is saved at once
    const next = { ...s, ...patch };
    setS(next); setMsg(""); setErr("");
    try { const d = await api("/admin-setup/", { method: "PUT", body: patch }); setS(d.settings); setAdminSetup(d.settings); setMsg(tx("Opgeslagen.")); }
    catch (e) { setErr(errorText(e)); }
  }
  async function reset() {
    if (!(await confirmDialog(tx("Alle instellingen van de admin setup terugzetten naar de standaard van easy2edit?")))) return;
    try { const d = await api("/admin-setup/", { method: "DELETE" }); setS(d.settings); setAdminSetup(d.settings); setMsg(tx("Teruggezet naar de standaard.")); } catch (e) { setErr(errorText(e)); }
  }
  const hidden = new Set(s.hidden_tiles || []);
  const toggleTile = (href, show) => { const n = new Set(hidden); if (show) n.delete(href); else n.add(href); save({ hidden_tiles: [...n] }); };
  const tiles = TILES.filter((t) => !t.always);

  return (
    <>
      <h1>{tx("easy2edit admin setup")}</h1>
      <p className="muted">{tx("De instellingen van de admin en de dashboards voor de hele website. Dit zijn de beginwaarden: iemand die zelf kiest (tegels of lijst, aantal per pagina, zijbalk) houdt zijn eigen keuze. Elke wijziging wordt meteen opgeslagen.")}</p>
      {!can && !err && <div className="alert">{tx("Je kunt de instellingen bekijken, maar alleen een beheerder kan ze wijzigen.")}</div>}
      {err && <div className="alert">{err}</div>}
      {msg && <div className="alert ok" role="status">{msg}</div>}
      <Tabs value={tab} onChange={setTab} tabs={[["tiles", "Tegels", <IconGrid key="i" />], ["dashboards", "Dashboards", <IconHome key="i" />], ["menu", "Menu", <IconMenu key="i" />]]} />

      {tab === "tiles" && (
        <div className="stack" style={{ marginTop: "1rem", maxWidth: 980 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
            <Seg label="Standaard weergave" value={s.view} onChange={(v) => can && save({ view: v })} rows={[["tiles", "Tegels"], ["list", "Lijst"]]} />
            <Seg label="Aantal per pagina" value={s.page_size} onChange={(v) => can && save({ page_size: v })} rows={SIZES} />
          </div>
          <div>
            <h3 style={{ margin: ".4rem 0" }}>{tx("Tegels tonen")}</h3>
            <p className="muted" style={{ marginTop: 0 }}>{tx("Zet een tegel uit om hem voor iedereen van het overzicht te halen. De pagina zelf blijft werken en de tegel blijft vindbaar via het zoekveld van het menu. De tegel easy2edit admin setup is er altijd.")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: ".6rem" }}>
              {tiles.map((t) => <Switch key={t.href} checked={!hidden.has(t.href)} disabled={!can} onChange={(v) => toggleTile(t.href, v)} label={t.title} hint={t.big} />)}
            </div>
          </div>
        </div>
      )}

      {tab === "dashboards" && (
        <div className="stack" style={{ marginTop: "1rem", maxWidth: 760 }}>
          <p className="muted" style={{ margin: 0 }}>{tx("Welke blokken het Admin-dashboard onder de tegels toont. Een blok dat je uitzet, verdwijnt voor iedereen; wat iemand niet mag zien, staat er sowieso niet.")}</p>
          {BLOCKS.map(([k, label, hint]) => <Switch key={k} checked={s.blocks?.[k] !== false} disabled={!can} onChange={(v) => save({ blocks: { ...s.blocks, [k]: v } })} label={label} hint={hint} />)}
        </div>
      )}

      {tab === "menu" && (
        <div className="stack" style={{ marginTop: "1rem", maxWidth: 760 }}>
          <Seg label="Zijbalk bij de eerste keer" value={s.sidebar} onChange={(v) => can && save({ sidebar: v })} rows={[["open", "Open"], ["collapsed", "Dicht"], ["remember", "Zoals de gebruiker het laatst deed"]]} />
          <p className="muted" style={{ margin: 0 }}>{tx("Wie de zijbalk zelf opent of sluit (de pijl), houdt die keuze.")}</p>
          <Switch checked={s.menu_search !== false} disabled={!can} onChange={(v) => save({ menu_search: v })} label="Zoekveld in het menu" hint="Het veld bovenaan de zijbalk om snel een beheeronderdeel te vinden." />
        </div>
      )}

      {can && <p style={{ marginTop: "1.5rem" }}><button type="button" className="btn sm" onClick={reset}>{tx("Standaard terugzetten")}</button></p>}
    </>
  );
}

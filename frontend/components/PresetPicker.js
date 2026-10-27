// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import DemoData from "./DemoData";
import RunPopup from "./RunPopup";
import { runDemo, resumeDemo } from "../lib/demoRun";
import { PresetIcon } from "./Icons";
import InstallationsBase from "./InstallationsBase";

// Standard installations: a kind of business with its modules, plugins and community theme. One click switches everything (Super admin).
export function usePresets(adminOnly = false) {  // adminOnly: only the ones the superadmin released for the admin (also for a superadmin)
  const [list, setList] = useState(null);
  const [n, setN] = useState(0);
  useEffect(() => { const f = () => setN((v) => v + 1); window.addEventListener("presets-changed", f); return () => window.removeEventListener("presets-changed", f); }, []);
  useEffect(() => { api("/system/presets/").then((l) => setList(adminOnly ? l.filter((x) => x.admin) : l)).catch(() => setList([])); }, [adminOnly, n]);
  return list;
}

export default function PresetPicker({ manage = false, adminOnly = false, demo = manage }) {  // demo: the buttons for demo data (superadmins)  // manage: the superadmin; administrators only see the released ones
  const fetched = usePresets(adminOnly);
  const [released, setReleased] = useState({});
  const list = fetched && fetched.map((p) => ({ ...p, admin: released[p.key] ?? p.admin }));
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  useEffect(() => { try { const m = sessionStorage.getItem("preset-msg"); if (m) { sessionStorage.removeItem("preset-msg"); setMsg(JSON.parse(m)); } } catch {} }, []);
  // the menus and modules come from the server when the page loads: after a change the whole page is loaded again (the message is kept for it)
  const reloadWith = (m) => { try { sessionStorage.setItem("preset-msg", JSON.stringify(m)); } catch {} window.location.reload(); };
  const [open, setOpen] = useState("");
  const [run, setRun] = useState(null); // the status pop-up with the progress
  const [ask, setAsk] = useState(null); // {p, needs, demo}: the question before an installation is set
  if (!list || (!manage && !list.length)) return null;
  // several can be ticked as "offered when nothing is installed yet" (at least one stays ticked); the question after logging in picks one of them
  const makeDefault = async (p, on) => {
    try { await api("/system/presets/default/", { method: "POST", body: { key: p.key, on } }); window.dispatchEvent(new Event("presets-changed")); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  const release = async (p, on) => {
    const next = { ...Object.fromEntries(list.map((x) => [x.key, x.admin])), [p.key]: on };
    setReleased(next);
    try { await api("/system/presets/admin/", { method: "POST", body: { keys: Object.keys(next).filter((k) => next[k]) } }); } catch (e) { setReleased({ ...next, [p.key]: !on }); setMsg({ ok: false, text: errorText(e) }); }
  };
  // setting an installation: one question with the option to make the demo data right away (superadmins, when it is not all there yet)
  const apply = async (p) => {
    let needs = false;
    if (demo) {
      try { const d = await api("/system/demo/"); needs = !(d.presets || []).includes(p.key) || (d.incomplete || []).includes(p.key); } catch {}
    }
    setAsk({ p, needs, demo: needs, shops: "clothing" });
  };
  // Pages that already have content are never replaced without asking: the answer "Nee, behouden" keeps every page as it is
  const askOverwrite = async (key) => {
    try {
      const c = await api(`/system/presets/${key}/apply/`, { method: "POST", body: { check: true } });
      if (!c.conflicts?.length) return false;
      return await confirmDialog(tx("Deze pagina's hebben al inhoud: {0}. Overschrijven met de standaard van deze installatie? Kies \"Nee, behouden\" om je pagina's en teksten te laten zoals ze zijn.", c.conflicts.map((x) => x.title).join(", ")), { danger: true, okLabel: tx("Ja, overschrijven"), cancelLabel: tx("Nee, behouden") });
    } catch { return false; }
  };
  const doApply = async () => {
    const { p, demo: withDemo, shops } = ask;
    setAsk(null); setMsg(null);
    const overwrite = await askOverwrite(p.key);
    setRun({ title: tx("Installatie \"{0}\" instellen", p.name), steps: [{ key: "_apply", label: tx("Modules, plugins en thema instellen"), status: "busy" }], error: "", done: false, undo: p.key });
    try {
      const r = await api(`/system/presets/${p.key}/apply/`, { method: "POST", body: { overwrite_pages: overwrite } });
      let note = tx("{0} is ingesteld: {1} modules en {2} plugins staan aan.", p.name, r.modules_on.length, r.plugins_on.length) + (r.payments_warning ? ` ${tx(r.payments_warning)}` : "") + (r.plugins_installed?.length ? ` ${tx("Uit de bibliotheek geïnstalleerd:")} ${r.plugins_installed.join(", ")}.` : "") + (r.plugins_missing.length ? ` ${tx("Niet geïnstalleerd:")} ${r.plugins_missing.join(", ")}.` : "");
      setRun((x) => ({ ...x, steps: x.steps.map((st) => (st.key === "_apply" ? { ...st, status: "ok" } : st)) }));
      let ok = true;
      if (withDemo) {
        ok = await runDemo(p.key, { shops: (p.plugins || []).some((x) => x.name === "webshop") ? (shops === "all" ? [] : [shops]) : undefined }, setRun);
        if (ok) note += ` ${tx("De demo-gegevens zijn gemaakt.")}`;
      }
      setRun((x) => ({ ...x, done: ok, note }));
    } catch (e) { setRun((x) => ({ ...x, steps: x.steps.map((st) => (st.status === "busy" ? { ...st, status: "error" } : st)), error: errorText(e) })); }
  };
  // an installation that did not go well: take the demo data made so far and the installation away again, so nothing half-finished stays behind
  const undoRun = async () => {
    const key = run?.undo, p = list.find((x) => x.key === key);
    if (!p) return;
    setRun((x) => ({ ...x, undoing: true, error: "", fix: undefined }));
    try {
      await api("/system/demo/", { method: "POST", body: { remove: true, preset: key } });
      await api(`/system/presets/${key}/remove/`, { method: "POST", body: {} });
      setRun((x) => ({ ...x, undoing: false, undo: undefined, done: true, note: tx("De installatie {0} is ongedaan gemaakt.", p.name) }));
    } catch (e) { setRun((x) => ({ ...x, undoing: false, error: errorText(e) })); }
  };
  const unapply = async (p) => {
    if (!(await confirmDialog(tx("De installatie \"{0}\" verwijderen? De modules en plugins van deze installatie gaan uit en de pagina's van de webshop e.d. verdwijnen uit het menu. Je gegevens (teksten, gebruikers, producten, bestellingen) blijven bestaan.", p.name), { okLabel: tx("Installatie verwijderen"), cancelLabel: tx("Annuleren"), danger: true }))) return;
    setMsg(null);
    let withDemo = false;  // demo data of this installation (with the demo users): asked, because "Installatie verwijderen" itself leaves the data
    try { const d = await api("/system/demo/"); if ((d.presets || []).includes(p.key)) withDemo = await confirmDialog(tx("Er zijn demo-gegevens van deze installatie (ook de demo-gebruikers). Die ook verwijderen?"), { okLabel: tx("Demo-gegevens ook verwijderen"), cancelLabel: tx("Behouden"), danger: true }); } catch {}
    setRun({ title: tx("Installatie \"{0}\" verwijderen", p.name), steps: [...(withDemo ? [{ key: "_demo", label: tx("Demo-gegevens en demo-gebruikers verwijderen"), status: "busy" }] : []), { key: "_rm", label: tx("Modules en plugins uitzetten"), status: withDemo ? "wait" : "busy" }], error: "", done: false });
    try {
      if (withDemo) {
        await api("/system/demo/", { method: "POST", body: { remove: true, preset: p.key } });
        setRun((x) => ({ ...x, steps: x.steps.map((st) => (st.key === "_demo" ? { ...st, status: "ok" } : st.key === "_rm" ? { ...st, status: "busy" } : st)) }));
      }
      await api(`/system/presets/${p.key}/remove/`, { method: "POST", body: {} });
      setRun((x) => ({ ...x, steps: x.steps.map((st) => ({ ...st, status: "ok" })), done: true, note: tx("De installatie {0} is verwijderd.", p.name) }));
    } catch (e) { setRun((x) => ({ ...x, steps: x.steps.map((st) => ({ ...st, status: "error" })), error: errorText(e) })); }
  };
  return (
    <div style={{ display: "grid", gap: ".7rem" }}>
      <p className="muted" style={{ margin: 0 }}>{tx("Kies een standaard installatie en alles wordt voor je ingesteld: welke modules en plugins aan staan en het thema van de community. Teksten, gebruikers en andere gegevens blijven zoals ze zijn.")}{manage && ` ${tx("Met de schakelaar bepaal je welke installaties ook voor beheerders (admin) zichtbaar zijn.")}`}</p>
      {manage && <InstallationsBase />}
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      <RunPopup run={run} onFix={() => resumeDemo(run, setRun)} onUndo={run?.undo ? undoRun : null} onClose={() => { setRun(null); window.location.reload(); }} />  {/* the menus and modules come from the server: after the job the page is loaded again */}
      {ask && (
        <div className="overlay" onClick={() => setAsk(null)}>
          <div className="card modal" role="dialog" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{tx("Bevestigen")}</h2>
            <p style={{ marginTop: 0 }}>{tx("De installatie \"{0}\" instellen? Alle modules, plugins en het community-thema worden zoals bij deze installatie aan of uit gezet. Je gegevens blijven bestaan.", ask.p.name)}</p>
            <p className="muted" style={{ marginTop: 0 }}>{tx("De huidige startpagina wordt vervangen door de startpagina van deze installatie (niet gecombineerd). Verwijder je de installatie, dan komt je oude startpagina terug.")}</p>
            {demo && (
              <label className="check sec-toggle">
                <span className="switch"><input type="checkbox" checked={ask.demo} onChange={(e) => setAsk({ ...ask, demo: e.target.checked })} /><span /></span>
                <span>{tx("Demo-gegevens direct installeren")} <small className="muted">{tx("Voorbeeldplaatjes, gebruikers, inhoud, systeemobjecten en bestellingen om alles te testen. Wat al aanwezig is, wordt niet dubbel gemaakt.")}{!ask.needs && <> {tx("De demo-gegevens van deze installatie zijn al aanwezig: je kunt hier nog een andere demowinkel toevoegen.")}</>}</small></span>
              </label>
            )}
            {demo && ask.demo && (ask.p.plugins || []).some((x) => x.name === "webshop") && (
              <label style={{ marginTop: ".6rem" }}>{tx("Welke shopindeling wil je als demo?")}
                <select value={ask.shops} onChange={(e) => setAsk({ ...ask, shops: e.target.value })}>
                  <option value="clothing">{tx("Kleding (dames, heren, kinderen)")}</option>
                  <option value="furniture">{tx("Meubels (woonkamer, slaapkamer, kantoor)")}</option>
                  <option value="grocery">{tx("Supermarkt (boodschappen)")}</option>
                  <option value="standard">{tx("Standaard producten")}</option>
                  <option value="all">{tx("Alle vier de winkels")}</option>
                </select>
              </label>
            )}
            <div className="row" style={{ marginTop: "1rem", gap: ".5rem" }}>
              <button type="button" className="btn" onClick={() => setAsk(null)}>{tx("Annuleren")}</button>
              <button type="button" className="btn primary" onClick={doApply}>{tx("Instellen")}</button>
            </div>
          </div>
        </div>
      )}
      <div className="preset-grid">
        {list.map((p) => (
          <div key={p.key} className={`card preset-card${p.active ? " preset-active" : ""}`}>
            <div className="preset-head"><span className="preset-ico"><PresetIcon name={p.icon} /></span><strong>{tx(p.name)}</strong>{p.active && <span className="badge ok preset-used">{tx("In gebruik")}</span>}{manage && !adminOnly && p.edited && <span className="badge preset-used">{tx("Aangepast")}</span>}</div>
            {manage && (
              <label className="check sec-toggle">
                <span className="switch"><input type="checkbox" checked={!!p.admin} onChange={(e) => release(p, e.target.checked)} /><span /></span>
                <span>{tx("Zichtbaar in de admin")}</span>
              </label>
            )}
            {manage && !adminOnly && (
              <label className="check" title={tx("Vink aan welke installaties worden aangeboden als er nog niets is geïnstalleerd. Er is er altijd minstens één.")}>
                <input type="checkbox" checked={!!p.default} onChange={(e) => makeDefault(p, e.target.checked)} />
                <span>{tx("Aanbieden bij eerste installatie")}</span>
              </label>
            )}
            <p className="muted" style={{ margin: 0 }}>{tx(p.desc)}</p>
            <div className="chips">
              {p.plugins.map((x) => <span key={x.name} className={`badge ${x.installed ? "ok" : "off"}`} title={x.installed ? "" : tx("Niet geïnstalleerd")}>{x.title}</span>)}
              <span className="badge">{tx("{0} modules", p.modules.length)}</span>
              {p.theme !== "normal" && <span className="badge">{tx("Thema")}: {p.theme}</span>}
            </div>
            <button type="button" className="btn-link" onClick={() => setOpen(open === p.key ? "" : p.key)}>{open === p.key ? tx("Verberg modules") : tx("Toon modules")}</button>
            {open === p.key && <small className="muted">{p.modules.map((m) => tx(m)).join(", ")}</small>}
            {demo && <div className="preset-demo"><strong>{tx("Demo-gegevens")}</strong><DemoData preset={p.key} name={p.name} editable={manage && !adminOnly} demoCfg={p.demo_cfg} price={p.price} contents={p.contents} showPurchase={!adminOnly} active={!!p.active} parts={p.demo_parts} shop={(p.plugins || []).some((x) => x.name === "webshop")} /></div>}
            {p.active
              ? <button type="button" className="btn danger" disabled={!!busy} onClick={() => unapply(p)}>{busy === p.key ? tx("Bezig…") : tx("Installatie verwijderen")}</button>
              : <button type="button" className="btn primary" disabled={!!busy} onClick={() => apply(p)}>{busy === p.key ? tx("Bezig…") : tx("Deze installatie instellen")}</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

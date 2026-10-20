"use client";

import { Busy } from "../../../../components/PageLoader";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible from "../../../../components/Collapsible";
import { IconGrid, IconRefresh, IconSettings } from "../../../../components/Icons";
import SaveStatus from "../../../../components/SaveStatus";
import Tabs from "../../../../components/Tabs";
import { api, apiBase, downloadFile, errorText, getToken } from "../../../../lib/api";
import { useAutoSave } from "../../../../lib/autosave";
import { PluginConfig, PluginTabs, PluginWarnings, SECTION_LABEL } from "../../../../components/PluginParts";
import { confirmDialog } from "../../../../lib/dialog";
import { tx } from "../../../../lib/t";

export default function PluginsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("installed");
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef(null);
  const load = useCallback(() => api("/plugins/").then(setD).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  const upd = (p) => setD((x) => ({ ...x, plugins: x.plugins.map((o) => (o.name === p.name ? p : o)) }));

  async function upload(file) {
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const p = await api("/plugins/upload/", { method: "POST", body: fd });
      await load();
      setMsg({ ok: true, text: tx("Plugin {0} {1} is geïnstalleerd. Zet hem aan bij Geïnstalleerd als je hem wilt gebruiken.", p.title, p.version) });
      setTab("installed");
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  }
  async function toggle(p, on) {
    setMsg(null);
    try { upd(await api(`/plugins/${p.name}/`, { method: "PATCH", body: { enabled: on } })); window.dispatchEvent(new Event("plugins-changed")); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); load(); }
  }
  async function remove(p) {
    if (!(await confirmDialog(tx("Plugin {0} verwijderen? De map met bestanden, de instellingen en de gegevens van de plugin worden gewist.", p.title), { title: tx("Plugin verwijderen"), okLabel: tx("Verwijderen"), danger: true }))) return;
    try { await api(`/plugins/${p.name}/`, { method: "DELETE" }); window.dispatchEvent(new Event("plugins-changed")); load(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }
  async function scan() {
    setBusy(true); setMsg(null);
    try {
      const r = await api("/plugins/scan/", { method: "POST" });
      setD((x) => ({ ...x, plugins: r.plugins }));
      setMsg(r.problems.length ? { ok: false, text: r.problems.map((x) => `${x.folder}: ${x.problem}`).join(" · ") } : { ok: true, text: tx("Map gescand: {0} plugin(s) gevonden.", r.found.length) });
      setTab("installed");
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  }
  async function example() {
    const res = await fetch(`${apiBase()}/api/plugins/example/`, { headers: { Authorization: `Token ${getToken()}` } });
    if (!res.ok) return setMsg({ ok: false, text: tx("De voorbeeldplugin kon niet worden opgehaald.") });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob()); a.download = "hello-plugin.zip"; a.click();
  }

  const outdated = d?.plugins.filter((p) => ["outdated", "incompatible", "newer"].includes(p.compat)) || [];
  if (!user?.is_staff) return <p className="muted">{tx("Alleen superadmins beheren plugins.")}</p>;
  if (!d) return msg ? <div className="alert">{msg.text}</div> : <Busy />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Plugins")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Losse programma's die je los van het systeem uploadt en die er wel mee samenwerken: eigen pagina's, routes, instellingen en reacties op gebeurtenissen.")}</p>
        </div>
      </div>
      <div className="alert" style={{ background: "#fef3c7", color: "#78350f", marginBottom: "1rem" }}>
        <strong>{tx("Systeemversie {0}.", d.system_version)}</strong> <strong>{tx("Let op:")}</strong> {tx("een plugin draait als vertrouwde code binnen het systeem en kan alle gegevens en functies gebruiken. Alleen plugins die onze ontwikkelaar heeft ondertekend en gebouwd voor deze versie van het systeem draaien hier.")}
      </div>
      {outdated.length > 0 && <div className="alert" style={{ background: "#fef3c7", color: "#78350f", marginBottom: "1rem" }}><strong>{tx("Plugins bijwerken:")}</strong> {outdated.map((p) => `${p.title} ${p.version}`).join(", ")} {tx("zijn niet meer up-to-date voor systeemversie {0}.", d.system_version)}
      </div>}
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <Tabs value={tab} onChange={setTab} tabs={[["installed", "Geïnstalleerd", <IconGrid key="i" />, d.plugins.length || undefined], ["upload", "Uploaden", <IconRefresh key="u" />], ["develop", "Ontwikkelen", <IconSettings key="d" />]]} />

      {tab === "installed" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
          {!d.plugins.length && <p className="muted">{tx("Er zijn nog geen plugins. Upload een zipbestand, of zet een map in")} <code>{d.folder}</code> {tx("en kies Map scannen.")}</p>}
          {d.plugins.map((p) => (
            <Collapsible key={p.name} id={`plugin-${p.name}`} title={`${p.title}  ·  ${tx("plugin")} ${p.version}  ·  ${tx("systeem")} ${p.built_for}${["outdated", "incompatible", "newer"].includes(p.compat) ? "  ⚠" : ""}`}>
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={p.enabled} disabled={!p.enabled && !!p.blocked} onChange={(e) => toggle(p, e.target.checked)} /><span /></span><span><strong>{p.enabled ? tx("Aan") : tx("Uit")}</strong></span></label>
                <span className="muted">{tx("Plugin")} {p.version} · {tx("voor systeem")} {p.built_for} · {tx(SECTION_LABEL[p.section] || p.section)}</span>
              </div>
              <PluginTabs p={p} onSaved={upd} />
              <div className="row" style={{ justifyContent: "flex-start" }}>
                <a className="btn" href={`/dashboard/admin/plugins/${p.name}`}>{tx("Beheerpagina")}</a>
                {p.enabled && p.has_web && p.menu && <a className="btn" href={`/dashboard/plugins/${p.name}`}>{tx("Open de pagina van de plugin")}</a>}
                {user?.is_staff && <button type="button" className="btn" onClick={() => downloadFile(`/plugins/${p.name}/download/`, `${p.name}-${p.version}.zip`).catch((e) => setMsg({ ok: false, text: errorText(e) }))}>{tx("Downloaden (zip)")}</button>}
                <button type="button" className="btn danger" onClick={() => remove(p)}>{tx("Verwijderen")}</button>
              </div>
            </Collapsible>
          ))}
        </div>
      )}

      {tab === "upload" && (
        <div className="card" style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: ".8rem" }}>
          <p className="muted" style={{ margin: 0 }}>{tx("Alleen plugins die onze ontwikkelaar heeft ondertekend (gebouwd met plugin_build). Kies het zipbestand van de plugin. Het wordt uitgepakt in de map van de plugin. Een plugin met dezelfde naam wordt bijgewerkt (de instellingen blijven). Na het uploaden staat een nieuwe plugin uit.")}</p>
          <div className={`dropzone ${over ? "over" : ""}`} role="button" tabIndex={0} onClick={() => input.current.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files[0]); }}>
            <span>{busy ? tx("Bezig…") : tx("Sleep het zipbestand hierheen of klik om te kiezen")}</span>
            <input ref={input} type="file" accept=".zip,application/zip" hidden onChange={(e) => { upload(e.target.files[0]); e.target.value = ""; }} />
          </div>
          <small className="muted">{tx("Maximaal {0} MB. Het zipbestand moet een plugin.json bevatten.", d.max_zip_mb)}</small>
        </div>
      )}

      {tab === "develop" && (
        <div className="card" style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: ".8rem" }}>
          <p style={{ margin: 0 }}>{tx("Een plugin ontwikkel je in een eigen map:")} <code>{d.folder}/<em>naam</em>/</code>. {tx("Die map hoort niet bij de code van het systeem (staat niet in Git) en wordt apart geüpload of op de server gezet. Met plugin_build (alleen de ontwikkelaar) wordt hij ondertekend en voor deze systeemversie gebouwd.")}</p>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.7 }}>
            <li><code>plugin.json</code>: {tx("naam, titel, versie, instellingen, menu en de gebeurtenissen waar de plugin op reageert.")}</li>
            <li><code>plugin.py</code>: {tx("het programma. Met register(system) schrijf je in op gebeurtenissen en voeg je routes toe. Je mag alles van het systeem importeren en gebruiken.")}</li>
            <li><code>web/index.html</code>: {tx("een eigen pagina in het dashboard. Met system.api(...) praat de pagina met het systeem namens de ingelogde gebruiker.")}</li>
          </ul>
          <p className="muted" style={{ margin: 0 }}>{tx("Gebeurtenissen:")} {d.events.join(", ")}.</p>
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="btn" disabled={busy} onClick={scan}>{tx("Map scannen")}</button>
            <button type="button" className="btn" onClick={example}>{tx("Voorbeeldplugin downloaden (om mee te beginnen)")}</button>
          </div>
        </div>
      )}
    </>
  );
}

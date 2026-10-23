"use client";

import { ResourceButtons } from "../../../../components/ResourceLibrary";
import { tx } from "../../../../lib/t";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import { lvl } from "../../../../lib/perms";
import Collapsible from "../../../../components/Collapsible";
import Flag from "../../../../components/Flag";
import ViewBar from "../../../../components/ViewBar";
import TableView from "../../../../components/TableView";
import { useView } from "../../../../lib/useView";
import { api, apiBase, errorText, getToken } from "../../../../lib/api";
import { alertDialog, confirmDialog } from "../../../../lib/dialog";

export default function Languages() {
  const tv = useView("languages", "list");
  const { user } = useAuth();
  const L = lvl(user, "languages");
  const [langs, setLangs] = useState([]);
  const [error, setError] = useState("");
  const [switcher, setSwitcher] = useState("dropdown");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileIn = useRef(null);

  const load = useCallback(() => api("/languages/all/").then(setLangs).catch((e) => setError(errorText(e))), []);
  useEffect(() => { load(); api("/languages/config/").then((c) => setSwitcher(c.switcher)).catch(() => {}); }, [load]);
  const chooseSwitcher = (v) => act(async () => { const c = await api("/languages/config/", { method: "PUT", body: { switcher: v } }); setSwitcher(c.switcher); window.dispatchEvent(new Event("languages-changed")); });

  async function act(fn) {
    setError("");
    try { await fn(); await load(); window.dispatchEvent(new Event("languages-changed")); } catch (e) { setError(errorText(e)); }
  }

  const toggle = (l) => act(() => api(`/languages/${l.code}/`, { method: "PATCH", body: { enabled: !l.enabled } }));
  const makeDefault = (l) => act(() => api(`/languages/${l.code}/default/`, { method: "POST" }));
  const remove = async (l) => {
    if (await confirmDialog(tx("Taal \"{0}\" verwijderen?", l.name), { danger: true })) act(() => api(`/languages/${l.code}/`, { method: "DELETE" }));
  };
  async function importPack(file) { // one language or a zip with all languages (a folder per language, each with a language.json)
    if (!file) return;
    setBusy(true); setMsg(null); setError("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await api("/languages/import/", { method: "POST", body: fd });
      setLangs(r.languages);
      setMsg({ ok: true, text: r.installed.length > 1 ? tx("{0} talen geïnstalleerd. Zet aan wat je wilt gebruiken.", r.installed.length) : tx("Taal {0} geïnstalleerd. Zet hem aan als je hem wilt gebruiken.", r.installed[0]) });
      window.dispatchEvent(new Event("languages-changed"));
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  }
  async function exportDist() { // superadmin: <project>/resource/languages/<code>.zip per language + all_languages.zip
    setBusy(true); setMsg(null);
    try {
      const r = await api("/languages/export/", { method: "POST", body: {} });
      const text = tx("{0} zips staan in {1}.", r.files.length, r.folder);
      setMsg({ ok: true, text });
      await alertDialog(`${tx("Export klaar")}\n${text}`);
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); await alertDialog(errorText(e)); }
    setBusy(false);
  }
  async function downloadAll() {
    const res = await fetch(`${apiBase()}/api/languages/export/all/`, { headers: { Authorization: `Token ${getToken()}` } });
    if (!res.ok) return setMsg({ ok: false, text: tx("Downloaden mislukt.") });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob()); a.download = "all_languages.zip"; a.click();
  }
  const enabledCount = langs.filter((l) => l.enabled).length;

  return (
    <>
      <h1>{tx("Talen")}</h1>
      <p className="muted">{tx("Zet talen aan voor de website en kies de standaardtaal.")} {tx("{0} van {1} actief.", enabledCount, langs.length)}</p>
      {error && <div className="alert">{error}</div>}
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}

      <Collapsible id="languages-list" title={tx("Talen")}>
      <ViewBar view={tv} />
      <TableView view={tv}>
        <table>
          <thead>
            <tr><th>{tx("Taal")}</th><th>{tx("Code")}</th><th>{tx("Actief")}</th><th>{tx("Standaard")}</th>{L >= 3 && <th />}</tr>
          </thead>
          <tbody>
            {langs.map((l) => (
              <tr key={l.code}>
                <td>
                  <strong>{l.name}</strong> <span className="muted" dir={l.rtl ? "rtl" : "ltr"}>· {l.native_name}</span>
                  {l.rtl && <span className="badge off" style={{ marginLeft: ".5rem" }}>{tx("rechts-naar-links")}</span>}
                </td>
                <td>{l.code}</td>
                <td>
                  <label className="switch" title={l.is_default ? tx("De standaardtaal blijft altijd actief") : ""}>
                    <input type="checkbox" checked={l.enabled} disabled={l.is_default || L < 2} onChange={() => toggle(l)} />
                    <span />
                  </label>
                </td>
                <td>
                  <label className="check">
                    <input type="radio" name="default" disabled={L < 2} checked={l.is_default} onChange={() => makeDefault(l)} />
                    {l.is_default ? <span className="badge ok">{tx("Standaard")}</span> : <span className="muted">{tx("Maak standaard")}</span>}
                  </label>
                </td>
                {L >= 3 && <td style={{ textAlign: "right" }}>{l.protected
                  ? <span className="muted" style={{ fontSize: ".8rem" }} title={l.code === "en" ? tx("Engels is de standaardtaal van het systeem en kan niet worden verwijderd") : tx("De standaardtaal kan niet worden verwijderd")}>{tx("Vast")}</span>
                  : <button type="button" className="btn sm danger" onClick={() => remove(l)}>{tx("Verwijderen")}</button>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </TableView>
      </Collapsible>

      {L >= 2 && (
        <Collapsible id="languages-packages" title={tx("Taalpakketten")}>
          <p className="muted" style={{ margin: 0 }}>{tx("Een taal is een pakket: een zipbestand met een map per taal, en daarin language.json met de naam en alle vertalingen van de interface. Importeer één taal of alle talen tegelijk; een bestaande taal wordt vervangen, een nieuwe taal komt uit.")}</p>
          <div className="row" style={{ marginTop: ".5rem" }}>
            <ResourceButtons kind="languages" onChanged={() => window.location.reload()} />
            <button type="button" className="btn" disabled={busy} onClick={() => fileIn.current?.click()}>{tx("Taal importeren (.zip)")}</button>
            <input ref={fileIn} type="file" accept=".zip,application/zip" hidden onChange={(e) => { importPack(e.target.files[0]); e.target.value = ""; }} />
            {user?.is_staff && L >= 3 && (
              <>
                <button type="button" className="btn" disabled={busy} onClick={exportDist}>{tx("Exporteer alle talen (resource/languages)")}</button>
                <button type="button" className="btn" disabled={busy} onClick={downloadAll}>{tx("Download all_languages.zip")}</button>
              </>
            )}
          </div>
        </Collapsible>
      )}

      <Collapsible id="languages-switcher" title={tx("Taalkeuze in de header")}>
        <p className="muted" style={{ margin: 0 }}>{tx("Kies hoe bezoekers van taal wisselen. De keuze verschijnt alleen als er meer dan één taal aan staat.")}</p>
        <div className="popup-presets">
          {[["dropdown", tx("Tekst (pulldown)"), tx("Een keuzelijst met de naam van de taal")], ["flags", tx("Vlaggetjes"), tx("Een rij kleine vlaggen, één per taal")]].map(([v, title, hint]) => (
            <button key={v} type="button" className="card" disabled={L < 2} onClick={() => chooseSwitcher(v)}
              style={{ textAlign: "left", cursor: L < 2 ? "default" : "pointer", display: "flex", flexDirection: "column", gap: ".5rem", borderColor: switcher === v ? "var(--blue)" : undefined }}>
              <strong>{title} {switcher === v && <span className="badge ok">{tx("Actief")}</span>}</strong>
              <span className="muted" style={{ fontSize: ".82rem" }}>{hint}</span>
              {v === "flags"
                ? <span className="lang-flags">{langs.filter((l) => l.enabled).map((l) => <span key={l.code} className="lang-flag"><Flag code={l.code} width={24} title={l.native_name} /></span>)}</span>
                : <span className="lang-select" style={{ display: "inline-block", pointerEvents: "none" }}>{langs.find((l) => l.is_default)?.native_name || "Nederlands"} ▾</span>}
            </button>
          ))}
        </div>
      </Collapsible>
    </>
  );
}

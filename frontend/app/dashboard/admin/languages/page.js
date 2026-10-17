"use client";

import { tx } from "../../../../lib/t";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import { lvl } from "../../../../lib/perms";
import Collapsible from "../../../../components/Collapsible";
import Flag from "../../../../components/Flag";
import ViewBar from "../../../../components/ViewBar";
import TableView from "../../../../components/TableView";
import { useView } from "../../../../lib/useView";
import { api, errorText } from "../../../../lib/api";

export default function Languages() {
  const tv = useView("languages", "list");
  const { user } = useAuth();
  const L = lvl(user, "languages");
  const [langs, setLangs] = useState([]);
  const [error, setError] = useState("");
  const [switcher, setSwitcher] = useState("dropdown");

  const load = useCallback(() => api("/languages/all/").then(setLangs).catch((e) => setError(errorText(e))), []);
  useEffect(() => { load(); api("/languages/config/").then((c) => setSwitcher(c.switcher)).catch(() => {}); }, [load]);
  const chooseSwitcher = (v) => act(async () => { const c = await api("/languages/config/", { method: "PUT", body: { switcher: v } }); setSwitcher(c.switcher); window.dispatchEvent(new Event("languages-changed")); });

  async function act(fn) {
    setError("");
    try { await fn(); await load(); window.dispatchEvent(new Event("languages-changed")); } catch (e) { setError(errorText(e)); }
  }

  const toggle = (l) => act(() => api(`/languages/${l.code}/`, { method: "PATCH", body: { enabled: !l.enabled } }));
  const makeDefault = (l) => act(() => api(`/languages/${l.code}/default/`, { method: "POST" }));
  const enabledCount = langs.filter((l) => l.enabled).length;

  return (
    <>
      <h1>{tx("Talen")}</h1>
      <p className="muted">{tx("Zet talen aan voor de website en kies de standaardtaal.")} {tx("{0} van {1} actief.", enabledCount, langs.length)}</p>
      {error && <div className="alert">{error}</div>}

      <Collapsible id="languages-list" title={tx("Talen")}>
      <ViewBar view={tv} />
      <TableView view={tv}>
        <table>
          <thead>
            <tr><th>{tx("Taal")}</th><th>{tx("Code")}</th><th>{tx("Actief")}</th><th>{tx("Standaard")}</th></tr>
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
              </tr>
            ))}
          </tbody>
        </table>
      </TableView>
      </Collapsible>

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

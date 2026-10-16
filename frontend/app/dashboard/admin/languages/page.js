"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import { lvl } from "../../../../lib/perms";
import Collapsible from "../../../../components/Collapsible";
import { api, errorText } from "../../../../lib/api";

export default function Languages() {
  const { user } = useAuth();
  const L = lvl(user, "languages");
  const [langs, setLangs] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(() => api("/languages/all/").then(setLangs).catch((e) => setError(errorText(e))), []);
  useEffect(() => { load(); }, [load]);

  async function act(fn) {
    setError("");
    try { await fn(); await load(); } catch (e) { setError(errorText(e)); }
  }

  const toggle = (l) => act(() => api(`/languages/${l.code}/`, { method: "PATCH", body: { enabled: !l.enabled } }));
  const makeDefault = (l) => act(() => api(`/languages/${l.code}/default/`, { method: "POST" }));
  const enabledCount = langs.filter((l) => l.enabled).length;

  return (
    <>
      <h1>Talen</h1>
      <p className="muted">Zet talen aan voor de website en kies de standaardtaal. {enabledCount} van {langs.length} actief.</p>
      {error && <div className="alert">{error}</div>}

      <Collapsible id="languages-list" title="Talen">
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Taal</th><th>Code</th><th>Actief</th><th>Standaard</th></tr>
          </thead>
          <tbody>
            {langs.map((l) => (
              <tr key={l.code}>
                <td>
                  <strong>{l.name}</strong> <span className="muted" dir={l.rtl ? "rtl" : "ltr"}>· {l.native_name}</span>
                  {l.rtl && <span className="badge off" style={{ marginLeft: ".5rem" }}>rechts-naar-links</span>}
                </td>
                <td>{l.code}</td>
                <td>
                  <label className="switch" title={l.is_default ? "De standaardtaal blijft altijd actief" : ""}>
                    <input type="checkbox" checked={l.enabled} disabled={l.is_default || L < 2} onChange={() => toggle(l)} />
                    <span />
                  </label>
                </td>
                <td>
                  <label className="check">
                    <input type="radio" name="default" disabled={L < 2} checked={l.is_default} onChange={() => makeDefault(l)} />
                    {l.is_default ? <span className="badge ok">Standaard</span> : <span className="muted">Maak standaard</span>}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </Collapsible>
    </>
  );
}

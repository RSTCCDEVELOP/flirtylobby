// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import { HELP_ENTRIES } from "../../../../components/EditHelp";
import Tabs from "../../../../components/Tabs";
import { api, errorText } from "../../../../lib/api";
import { lvl } from "../../../../lib/perms";
import { tx } from "../../../../lib/t";

// The explanations of the help mode in edit mode (the "?" icon): change them per language; "Standaard" puts the original text back.
export default function HelpTips() {
  const { user } = useAuth();
  const L = lvl(user, "pages");
  const [custom, setCustom] = useState({});
  const [langs, setLangs] = useState({ languages: [], default: "nl" });
  const [lang, setLang] = useState("");
  const [open, setOpen] = useState("");
  const [draft, setDraft] = useState({});
  const [msg, setMsg] = useState(null);
  const load = () => api("/help/tips/").then(setCustom).catch((e) => setMsg(errorText(e)));
  useEffect(() => { load(); api("/languages/").then(setLangs).catch(() => {}); }, []);
  const edit = langs.languages.length ? langs.languages : [{ code: "nl", native_name: "Nederlands" }];
  const cur = edit.some((l) => l.code === lang) ? lang : langs.default;
  const start = (e) => { setOpen(open === e.key ? "" : e.key); setDraft({ nl: tx(e.text), ...(custom[e.key] || {}) }); };
  async function save(key, texts) {
    try { await api(`/help/tips/${key}/`, { method: "PUT", body: { texts } }); setMsg(null); await load(); } catch (e) { setMsg(errorText(e)); }
  }
  async function reset(key) { try { await api(`/help/tips/${key}/`, { method: "DELETE" }); setDraft({}); setOpen(""); await load(); } catch (e) { setMsg(errorText(e)); } }
  return (
    <>
      <div className="page-head"><div><h1>{tx("Help-teksten")}</h1><p className="muted" style={{ margin: 0 }}>{tx("De uitleg die verschijnt als je in bewerkmodus het vraagteken aanzet en een icoon aanwijst. Wijzig de tekst per taal; Standaard zet de oorspronkelijke tekst terug.")}</p></div></div>
      {msg && <div className="alert" style={{ marginBottom: "1rem" }}>{msg}</div>}
      <div className="plugin-items">
        {HELP_ENTRIES.map((e) => {
          const changed = !!custom[e.key];
          return (
            <div key={e.key} className="plugin-item" style={{ flexWrap: "wrap" }}>
              <span className="pi-main"><strong>{tx(e.text).slice(0, 70)}{tx(e.text).length > 70 ? "…" : ""}</strong>{changed && <span className="badge ok" style={{ width: "auto", display: "inline-block" }}>{tx("Aangepast")}</span>}<small className="muted">{e.sel.split(",")[0]}</small></span>
              <span className="pi-actions">{L >= 2 && <button type="button" className="btn sm" onClick={() => start(e)}>{open === e.key ? tx("Sluiten") : tx("Wijzig")}</button>}{L >= 2 && changed && <button type="button" className="btn sm" onClick={() => reset(e.key)}>{tx("Standaard")}</button>}</span>
              {open === e.key && (
                <div className="form" style={{ flex: "1 1 100%", marginTop: ".6rem" }}>
                  <Tabs className="lang-tabs" value={cur} onChange={setLang} tabs={edit.map((l) => [l.code, l.native_name || l.code, null, draft[l.code] ? "✓" : null])} />
                  <textarea rows={4} maxLength={600} value={draft[cur] || ""} onChange={(ev) => setDraft({ ...draft, [cur]: ev.target.value })} />
                  <div className="row" style={{ justifyContent: "flex-start" }}><button type="button" className="btn primary" onClick={() => save(e.key, draft).then(() => setOpen(""))}>{tx("Opslaan")}</button><small className="muted">{tx("Een taal zonder tekst gebruikt de Nederlandse.")}</small></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

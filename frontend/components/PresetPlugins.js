// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";

// The tab "Plugins" of a standard installation: a switch for every module and every plugin. Every switch is saved at once as the standard of this installation: the next time the
// installation is set up it gets exactly these modules and plugins (and installations.json, the basis for other sites, follows by itself: see installations_config.py).
export default function PresetPlugins({ preset }) {
  const [opts, setOpts] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api(`/system/presets/${preset}/edit/`).then(setOpts).catch((e) => setMsg({ ok: false, text: errorText(e) })), [preset]);
  useEffect(() => { load(); }, [load]);

  const flip = async (field, key) => {
    if (!opts || busy) return;
    const cur = new Set(opts[field].filter((x) => x.on).map((x) => x.key || x.name));
    cur.has(key) ? cur.delete(key) : cur.add(key);
    setBusy(true); setMsg(null);
    try {
      setOpts(await api(`/system/presets/${preset}/edit/`, { method: "PUT", body: { [field]: [...cur] } }));
      setMsg({ ok: true, text: tx("Opgeslagen: dit is de standaard voor de volgende keer dat deze installatie wordt ingesteld.") });
      window.dispatchEvent(new Event("presets-changed"));
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const Row = ({ on, disabled, title, sub, badge, onChange }) => (
    <label className={`wz-q${on ? " on" : ""}`} style={disabled ? { opacity: .75 } : undefined}>
      <span className="switch"><input type="checkbox" checked={on} disabled={disabled || busy} onChange={onChange} /><span /></span>
      <span className="wz-text"><strong>{title}{badge && <span className="badge" style={{ marginLeft: ".5rem" }}>{badge}</span>}</strong>{sub && <small className="muted">{sub}</small>}</span>
    </label>
  );
  if (!opts) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Laden…")}</p>;
  const groups = [...new Set(opts.modules.map((m) => m.group || ""))];
  return (
    <>
      <p className="muted" style={{ margin: 0 }}>{tx("Zet modules en plugins aan of uit voor deze installatie. Elke wijziging wordt meteen opgeslagen en is de standaard voor de volgende installatie en voor site-updates.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      <h3 style={{ margin: ".4rem 0 0" }}>{tx("Plugins")}</h3>
      {opts.plugins.length
        ? <div className="wz-grid">{opts.plugins.map((p) => <Row key={p.name} on={p.on} onChange={() => flip("plugins", p.name)} title={p.title} badge={p.enabled ? tx("Aan") : tx("Uit")} sub={`${p.name}${p.requires.length ? ` · ${tx("nodig")}: ${p.requires.join(", ")}` : ""}`} />)}</div>
        : <p className="muted">{tx("Er zijn geen plugins geïnstalleerd.")}</p>}
      <h3 style={{ margin: ".8rem 0 0" }}>{tx("Modules")}</h3>
      {groups.map((g) => (
        <div key={g || "x"} className="stack" style={{ gap: ".5rem" }}>
          {g && <h4 style={{ margin: ".2rem 0 0" }} className="muted">{tx(g)}</h4>}
          <div className="wz-grid">{opts.modules.filter((m) => (m.group || "") === g).map((m) => {
            const auto = !m.on && m.auto;
            return <Row key={m.key} on={m.on || auto} disabled={auto} onChange={() => flip("modules", m.key)} title={tx(m.label)} sub={auto ? `${tx("Nodig voor")}: ${m.needed_by.map((x) => tx(x)).join(", ")}` : tx(m.desc)} />;
          })}</div>
        </div>
      ))}
    </>
  );
}

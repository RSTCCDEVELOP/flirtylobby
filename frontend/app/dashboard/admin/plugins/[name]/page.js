"use client";

import { Busy } from "../../../../../components/PageLoader";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../../components/AuthContext";
import { IconEye, IconSettings } from "../../../../../components/Icons";
import PluginFrame from "../../../../../components/PluginFrame";
import PluginPages from "../../../../../components/PluginPages";
import { IconEdit } from "../../../../../components/Icons";
import { PluginTabs } from "../../../../../components/PluginParts";
import { api, downloadFile, errorText } from "../../../../../lib/api";
import { tx } from "../../../../../lib/t";

// The admin page of one plugin: its settings and, when the plugin brings one, its own admin page (e.g. moderation).
export default function PluginAdminPage() {
  const { name } = useParams();
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api("/plugins/").then((d) => setP(d.plugins.find((x) => x.name === name) || false)).catch((e) => setMsg(errorText(e))), [name]);
  useEffect(() => { load(); }, [load]);

  async function toggle(on) {
    try { setP(await api(`/plugins/${name}/`, { method: "PATCH", body: { enabled: on } })); window.dispatchEvent(new Event("plugins-changed")); setMsg(null); }
    catch (e) { setMsg(errorText(e)); load(); }
  }
  if (!user?.is_staff) return <p className="muted">{tx("Alleen superadmins beheren plugins.")}</p>;
  if (msg && p === null) return <div className="alert">{msg}</div>;
  if (p === null) return <Busy />;
  if (p === false) return <p className="muted">{tx("Deze plugin bestaat niet.")} <Link href="/dashboard/admin/plugins" style={{ color: "var(--blue)" }}>{tx("Naar alle plugins")}</Link></p>;

  const hasPages = (p.public_pages || []).some((x) => x.page) || !!p.blocks_page || !!p.admin_links?.length;
  const tabs = [
    ...(p.admin_web && p.enabled ? [["manage", p.admin_label || "Beheer", <IconEye key="m" />]] : []),
    ...(hasPages ? [["pages", "Pagina's", <IconEdit key="pg" />]] : []),
    ...(p.settings_web && p.enabled ? [["shopsettings", "Instellingen", <IconSettings key="ss" />]] : []),
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{p.title}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Plugin")} {p.version} · {tx("voor systeem")} {p.built_for}{p.description ? ` — ${p.description}` : ""}</p>
        </div>
        <div className="row">
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={p.enabled} disabled={!p.enabled && !!p.blocked} onChange={(e) => toggle(e.target.checked)} /><span /></span><span><strong>{p.enabled ? tx("Aan") : tx("Uit")}</strong></span></label>
          <Link className="btn" href="/dashboard/admin/plugins">{tx("Alle plugins")}</Link>
        </div>
      </div>
      {msg && <div className="alert" style={{ marginBottom: "1rem" }}>{msg}</div>}
      <PluginTabs p={p} onSaved={setP} first={p.admin_web && p.enabled ? "manage" : "overview"} extra={tabs}>
        {(tab) => (
          <>
            {tab === "manage" && p.admin_web && p.enabled && <PluginFrame name={name} file={p.admin_web} title={`${p.title} – ${tx("beheer")}`} />}
            {tab === "pages" && <PluginPages p={p} />}
            {tab === "shopsettings" && p.settings_web && p.enabled && <PluginFrame name={name} file={p.settings_web} title={`${p.title} – ${tx("instellingen")}`} bare />}
          </>
        )}
      </PluginTabs>
      <p className="row" style={{ justifyContent: "flex-start" }}>
        {p.enabled && p.has_web && p.menu && <Link className="btn" href={`/dashboard/plugins/${p.name}`}>{tx("Open de pagina van de plugin")}</Link>}
        {user?.is_staff && <button type="button" className="btn" onClick={() => downloadFile(`/plugins/${p.name}/download/`, `${p.name}-${p.version}.zip`).catch((e) => setMsg(errorText(e)))}>{tx("Downloaden (zip)")}</button>}
      </p>
    </>
  );
}

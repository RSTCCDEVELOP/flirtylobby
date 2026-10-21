"use client";

import { Busy } from "../../../../../components/PageLoader";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../../components/AuthContext";
import { IconEye, IconSettings } from "../../../../../components/Icons";
import PluginFrame from "../../../../../components/PluginFrame";
import PluginPages from "../../../../../components/PluginPages";
import { IconEdit } from "../../../../../components/Icons";
import { PluginTabs } from "../../../../../components/PluginParts";
import { api, downloadFile, errorText } from "../../../../../lib/api";
import { tx } from "../../../../../lib/t";
import { confirmDialog } from "../../../../../lib/dialog";

// The admin page of one plugin: its settings and, when the plugin brings one, its own admin page (e.g. moderation).
export default function PluginAdminPage() {
  const { name } = useParams();
  const wanted = useSearchParams().get("tab") || ""; // ?tab=products: the menu entry of a plugin opens its admin page at that part
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api("/plugins/").then((d) => setP(d.plugins.find((x) => x.name === name) || false)).catch((e) => setMsg(errorText(e))), [name]);
  useEffect(() => { load(); }, [load]);

  async function toggle(on) {
    const off = on ? p.requires_off || [] : [];
    if (off.length && !(await confirmDialog(tx("{0} heeft ook {1} nodig. Die staan nog uit. Ook aanzetten?", p.title, off.map((x) => x.title).join(", ")), { title: tx("Plugins aanzetten"), okLabel: tx("Alles aanzetten") }))) return;
    try { setP(await api(`/plugins/${name}/`, { method: "PATCH", body: { enabled: on, with_requires: off.length > 0 } })); window.dispatchEvent(new Event("plugins-changed")); setMsg(null); }
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
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={p.enabled} disabled={!p.enabled && (!!p.blocked || (p.requires_missing || []).length > 0)} onChange={(e) => toggle(e.target.checked)} /><span /></span><span><strong>{p.enabled ? tx("Aan") : tx("Uit")}</strong></span></label>
          <Link className="btn" href="/dashboard/admin/plugins">{tx("Alle plugins")}</Link>
        </div>
        {(p.requires?.length > 0 || p.required_by?.length > 0) && <p className="muted" style={{ margin: ".4rem 0 0", fontSize: ".85rem" }}>{p.requires?.length > 0 && <>{tx("Heeft nodig:")} {p.requires.join(", ")}. </>}{p.required_by?.length > 0 && <>{tx("Nodig voor:")} {p.required_by.join(", ")}.</>}{(p.requires_missing || []).length > 0 ? ` ${tx("Nog niet geïnstalleerd:")} ${p.requires_missing.join(", ")}.` : (p.requires_off || []).length > 0 && !p.enabled ? ` ${tx("Staan nog uit:")} ${p.requires_off.map((x) => x.title).join(", ")}.` : ""}</p>}
      </div>
      {msg && <div className="alert" style={{ marginBottom: "1rem" }}>{msg}</div>}
      <PluginTabs p={p} onSaved={setP} first={p.admin_web && p.enabled ? "manage" : "overview"} extra={tabs}>
        {(tab) => (
          <>
            {tab === "manage" && p.admin_web && p.enabled && <PluginFrame key={wanted} name={name} file={p.admin_web} title={`${p.title} – ${tx("beheer")}`} route={wanted ? { params: {}, query: { tab: wanted } } : null} />}
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

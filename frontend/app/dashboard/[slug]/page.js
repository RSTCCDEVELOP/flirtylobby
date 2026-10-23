// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { Busy } from "../../../components/PageLoader";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EditableText } from "../../../components/EditMode";
import GamesPage from "../../../components/GamesPage";
import PageBlocks from "../../../components/PageBlocks";
import PluginFrame from "../../../components/PluginFrame";
import { api } from "../../../lib/api";
import { menuLabel } from "../../../components/SiteMenu";
import { tx } from "../../../lib/t";

// A page at its own address inside the dashboard, /dashboard/<slug>: the page of a plugin (public_path in plugin.json) or a dashboard page (Admin -> Pagina's, tab Dashboard).
export default function DashboardPage() {
  const { slug } = useParams();
  const [found, setFound] = useState(null); // {plugin} | {page} | false
  useEffect(() => {
    let alive = true;
    (async () => {
      let r = false;
      try { const p = (await api("/plugins/menu/")).find((x) => x.path === slug); if (p) r = { plugin: p }; } catch {}
      if (!r) { try { const pg = await api(`/pages/public/${encodeURIComponent(slug)}/`); if (pg.scope === "private") r = { page: pg }; } catch {} }
      if (alive) setFound(r);
    })();
    return () => { alive = false; };
  }, [slug]);
  if (found === null) return <Busy />;
  if (!found) return <p className="muted">{tx("Deze pagina bestaat niet, staat uit of is niet voor jou.")}</p>;
  if (found.plugin) {
    const p = found.plugin;
    if (p.name === "games") return <GamesPage />;  // the games, in a grid
    return (
      <>
        <div className="page-head"><div><h1>{p.label}</h1><p className="muted" style={{ margin: 0 }}>{p.title}</p></div></div>
        <PluginFrame name={p.name} title={p.title} />
      </>
    );
  }
  const t = found.page.title;
  return (
    <>
      <EditableText id={`page.${slug}.title`} as="h1" fallbacks={t} fallback={menuLabel(t)} />
      <EditableText id={`page.${slug}.body`} as="div" rich fallback="" className="doc-rich" />
      <PageBlocks pageKey={slug} />
    </>
  );
}

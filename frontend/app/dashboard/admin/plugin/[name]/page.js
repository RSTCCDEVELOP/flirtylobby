"use client";

import { Busy } from "../../../../../components/PageLoader";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../../../../components/AuthContext";
import PluginFrame from "../../../../../components/PluginFrame";
import { api, errorText } from "../../../../../lib/api";
import { tx } from "../../../../../lib/t";

// The working page of a plugin (the orders, the products, the moderation ...): only that, no settings. The settings of every plugin are only under Admin → Plugins.
export default function PluginWorkPage() {
  const { name } = useParams();
  const wanted = useSearchParams().get("tab") || ""; // ?tab=products: the menu entry of a plugin opens its page at that part
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/plugins/menu/?scope=admin").then((list) => setP(list.find((x) => x.name === name && x.has_admin) || false)).catch((e) => setError(errorText(e))); }, [name]);
  if (!user?.is_staff) return <p className="muted">{tx("Alleen superadmins openen deze pagina.")}</p>;
  if (error) return <div className="alert">{error}</div>;
  if (p === null) return <Busy />;
  if (p === false) return <p className="muted">{tx("Deze plugin bestaat niet, staat uit of heeft geen beheerpagina.")}</p>;
  return (
    <>
      <div className="page-head"><div><h1>{p.label}</h1></div></div>
      <PluginFrame key={wanted} name={name} file={p.admin_web} title={p.title} route={wanted ? { params: {}, query: { tab: wanted } } : null} />
    </>
  );
}

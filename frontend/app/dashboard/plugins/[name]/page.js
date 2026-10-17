"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import PluginFrame from "../../../../components/PluginFrame";
import { api, errorText } from "../../../../lib/api";
import { tx } from "../../../../lib/t";

// The own page of a plugin, inside the dashboard (menu, header and footer of the dashboard stay).
export default function PluginPage() {
  const { name } = useParams();
  const [p, setP] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/plugins/menu/").then((list) => setP(list.find((x) => x.name === name) || false)).catch((e) => setError(errorText(e))); }, [name]);
  if (error) return <div className="alert">{error}</div>;
  if (p === null) return <p className="muted">{tx("Laden…")}</p>;
  if (p === false) return <p className="muted">{tx("Deze plugin bestaat niet, staat uit of is niet voor jou.")}</p>;
  return (
    <>
      <div className="page-head"><div><h1>{p.label}</h1><p className="muted" style={{ margin: 0 }}>{p.title}</p></div></div>
      <PluginFrame name={name} title={p.title} />
    </>
  );
}

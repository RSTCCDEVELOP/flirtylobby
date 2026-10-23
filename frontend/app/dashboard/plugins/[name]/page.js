// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { Busy } from "../../../../components/PageLoader";
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
  const [query, setQuery] = useState({});
  useEffect(() => { setQuery(Object.fromEntries(new URLSearchParams(window.location.search))); }, []); // e.g. ?with=12: a plugin can start from the address
  useEffect(() => { api("/plugins/menu/").then((list) => setP(list.find((x) => x.name === name) || false)).catch((e) => setError(errorText(e))); }, [name]);
  if (error) return <div className="alert">{error}</div>;
  if (p === null) return <Busy />;
  if (p === false) return <p className="muted">{tx("Deze plugin bestaat niet, staat uit of is niet voor jou.")}</p>;
  return (
    <>
      <div className="page-head"><div><h1>{p.label}</h1><p className="muted" style={{ margin: 0 }}>{p.title}</p></div></div>
      <PluginFrame name={name} title={p.title} route={{ path: "/", params: {}, query }} />
    </>
  );
}

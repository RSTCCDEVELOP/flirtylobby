"use client";

import { tx } from "../lib/t";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useModule } from "./Modules";
import { useSession } from "./Session";

// Shows its children only to people whose subscription gives access.
//   <Paywall content="cursus-1">…</Paywall>       a piece of content (key set at the subscription: "Exclusieve content")
//   <Paywall page="mijn-pagina">…</Paywall>       an own page that a subscription lists
// With the subscriptions module off, or when nothing locks this part, everything is shown.
export default function Paywall({ content, page, children, fallback }) {
  const on = useModule("subscriptions");
  const { user, ready } = useSession();
  const [ok, setOk] = useState(null);
  useEffect(() => {
    if (!on) return setOk(true);
    if (!ready) return;
    api(`/subscriptions/access/?${page ? `page=${encodeURIComponent(page)}` : `content=${encodeURIComponent(content)}`}`).then((r) => setOk(r.ok)).catch(() => setOk(true));
  }, [on, ready, user, page, content]);
  if (ok === null) return null;
  if (ok) return children;
  return fallback || (
    <div className="card paywall">
      <strong>{tx("Dit is er voor leden met een abonnement.")}</strong>
      <p className="muted" style={{ margin: 0 }}>{user ? tx("Neem een abonnement om dit te bekijken.") : tx("Log in en neem een abonnement om dit te bekijken.")}</p>
      <Link className="btn primary" href={user ? "/abonnementen" : "/login?next=/abonnementen"}>{user ? tx("Bekijk de abonnementen") : tx("Inloggen")}</Link>
    </div>
  );
}

"use client";

import { Busy } from "./PageLoader";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setDeepLink } from "../lib/deeplink";
import { api, errorText } from "../lib/api";
import { getLanguage, tx } from "../lib/t";
import FaqArt from "./FaqArt";
import Tabs from "./Tabs";
import { useSession } from "./Session";

// The help of Easy2edit: groups with a picture in the colours of the theme, and questions that open. Only what the person has the rights for.
const LAYER_LABEL = { user: "Gebruiker", admin: "Beheer", super: "Super admin" };

export default function FaqPage({ withTitle = true, layer: first = "user", single = true }) {
  const { user, ready } = useSession();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState("");
  const [group, setGroup] = useState("");
  const [layer, setLayer] = useState(first);
  const router = useRouter();
  const go = (g) => { setDeepLink(g); router.push(g.href); }; // to the page, the tab and the block of this setting
  useEffect(() => {
    if (!ready) return;
    api(`/help/?lang=${encodeURIComponent(getLanguage())}&layer=${layer}`).then((d) => { setData(d); setGroup(""); }).catch((e) => setErr(errorText(e)));
  }, [ready, user, layer]);
  const norm = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const items = useMemo(() => {
    const w = norm(q).split(/\s+/).filter(Boolean);
    return (data?.items || []).filter((i) => (!group || i.group === group) && w.every((x) => norm(`${i.q} ${i.a}`).includes(x)));
  }, [data, q, group]);
  if (err) return <div className="alert">{err}</div>;
  if (!data) return <Busy />;
  return (
    <div className="faq">
      {withTitle && <h1>{layer === "user" ? tx("Help van Easy2edit") : layer === "admin" ? tx("Help voor beheer") : tx("Help voor super admin")}</h1>}
      <p className="muted">{layer === "user" ? tx("Uitleg over het gebruik van de onderdelen die aan staan en die jij mag gebruiken.") : layer === "admin" ? tx("Uitleg over het beheer van de onderdelen, plugins en spelletjes waar jij rechten voor hebt.") : tx("Uitleg voor superadmins: modules, plugins, thema's en back-up.")}</p>
      {!single && data.layers.length > 1 && <Tabs value={layer} onChange={setLayer} tabs={data.layers.map((l) => [l, LAYER_LABEL[l]])} />}
      <div className="faq-tools">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoek in de uitleg…")} aria-label={tx("Zoeken")} />
      </div>
      <div className="faq-groups">
        <button type="button" className={`faq-chip${group ? "" : " on"}`} onClick={() => setGroup("")}>{tx("Alles")}</button>
        {data.groups.map((g) => <button key={g.id} type="button" className={`faq-chip${group === g.id ? " on" : ""}`} onClick={() => setGroup(group === g.id ? "" : g.id)}>{g.title}</button>)}
      </div>
      {data.groups.filter((g) => items.some((i) => i.group === g.id)).map((g) => (
        <section key={g.id} className="faq-section">
          <header className="faq-head"><FaqArt kind={g.art} size={84} /><h2>{g.title}</h2></header>
          <div className="faq-list">
            {items.filter((i) => i.group === g.id).map((i) => (
              <details key={i.id} className="faq-item" open={open === i.id || !!q.trim()} onToggle={(e) => { if (e.currentTarget.open) setOpen(i.id); else if (open === i.id) setOpen(""); }}>
                <summary>{i.q}</summary>
                <p>{i.a}</p>
                {i.go && <button type="button" className="btn sm primary faq-go" onClick={() => go(i.go)} title={tx("Ga naar deze instelling")}>{tx("GO")} →</button>}
              </details>
            ))}
          </div>
        </section>
      ))}
      {!items.length && <p className="muted">{tx("Niets gevonden.")}</p>}
    </div>
  );
}

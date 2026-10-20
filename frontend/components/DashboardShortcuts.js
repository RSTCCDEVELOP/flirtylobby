"use client";

import Link from "next/link";
import { useShortcuts } from "../lib/shortcuts";
import { tx } from "../lib/t";
import { IconStar, IconX } from "./Icons";

// The shortcut tiles on the dashboard: pages you use a lot. Add them with the star (in the header or in the search results), remove them here.
export default function DashboardShortcuts() {
  const sc = useShortcuts();
  if (!sc.ready) return null;
  return (
    <section className="shortcuts" aria-label={tx("Snelkoppelingen")}>
      <h2 className="shortcuts-title">{tx("Snelkoppelingen")}</h2>
      {sc.list.length === 0
        ? <p className="muted" style={{ margin: 0 }}>{tx("Gebruik je een pagina vaak? Klik op de ster bovenaan die pagina, of bij een zoekresultaat, om hier een tegel te maken.")}</p>
        : (
          <div className="shortcut-grid">
            {sc.list.map((x) => (
              <div key={x.href} className="card shortcut-tile">
                <Link href={x.href}><IconStar /><span>{tx(x.title)}</span></Link>
                <button type="button" className="icon-btn shortcut-del" onClick={() => sc.remove(x.href)} aria-label={tx("Snelkoppeling verwijderen")} title={tx("Snelkoppeling verwijderen")}><IconX /></button>
              </div>
            ))}
          </div>
        )}
    </section>
  );
}

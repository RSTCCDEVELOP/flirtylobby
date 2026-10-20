"use client";

import { useEffect, useRef } from "react";
import Paged from "./Paged";

// A table that can also be shown as tiles, and filtered with the search box of <ViewBar>. Works on the table inside it without changing it:
// cells get their column name (data-label) for the tile layout, rows that do not match the search are hidden.
export default function TableView({ view, children, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const t = ref.current?.querySelector("table");
    if (!t) return;
    const heads = [...t.querySelectorAll("thead th")].map((th) => th.textContent.trim());
    const q = view.q.trim().toLowerCase();
    t.querySelectorAll("tbody tr").forEach((tr) => {
      [...tr.children].forEach((td, i) => td.setAttribute("data-label", heads[i] || ""));
      tr.hidden = !!q && !tr.textContent.toLowerCase().includes(q);
    });
  });
  return (
    <Paged id={`${view.id || "table"}`} selector="tbody" defaultSize="25" query={view.q}>
      <div ref={ref} className={`table-wrap${view.mode === "tiles" ? " as-tiles" : ""}`} style={style}>{children}</div>
    </Paged>
  );
}

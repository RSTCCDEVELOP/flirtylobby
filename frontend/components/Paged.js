// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { tx } from "../lib/t";

// Paging for any list or table: 5, 10, 25, 100 or all items per page. The choice is remembered per list (view:<id>:size, kept on the server for a logged-in person);
// a page can bring its own default (set in the layout of the page: data-pagesize on the page). It works on the DOM of the list it wraps, so every list can use it:
// <Paged id="games-page" selector=".games-grid"> ...the list... </Paged>
export const SIZES = ["5", "10", "25", "100", "all"];
const read = (id) => { try { const v = localStorage.getItem(`view:${id}:size`); return SIZES.includes(v) ? v : ""; } catch { return ""; } };

export default function Paged({ id, selector = "", defaultSize = "all", query = "", children }) {
  const root = useRef(null);
  const [own, setOwn] = useState(""); // the choice of the person
  const [theirs, setTheirs] = useState(""); // the default of the page
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const size = own || theirs || defaultSize;

  useEffect(() => { setOwn(read(id)); }, [id]);
  useEffect(() => { const d = root.current?.closest("[data-pagesize]")?.dataset.pagesize; setTheirs(SIZES.includes(d) ? d : ""); });
  useEffect(() => { const on = () => setOwn(read(id)); window.addEventListener("storage", on); return () => window.removeEventListener("storage", on); }, [id]);
  useEffect(() => { setPage(0); }, [size, query]);

  useEffect(() => { // show the items of the current page, hide the rest
    const box = root.current;
    const list = box && (selector ? box.querySelector(selector) : box.firstElementChild);
    if (!list) return;
    const items = [...list.children].filter((c) => !c.hidden && !c.hasAttribute("data-nopage"));
    items.forEach((c) => c.classList.remove("paged-out"));
    const n = size === "all" ? items.length : Number(size);
    const last = Math.max(0, Math.ceil(items.length / (size === "all" ? Math.max(1, items.length) : n)) - 1);
    const cur = Math.min(page, last);
    if (size !== "all") items.forEach((c, i) => { if (i < cur * n || i >= (cur + 1) * n) c.classList.add("paged-out"); });
    if (cur !== page) setPage(cur);
    if (items.length !== total) setTotal(items.length);
  });

  const choose = (v) => { setOwn(v); try { localStorage.setItem(`view:${id}:size`, v); } catch {} };
  const n = size === "all" ? Math.max(total, 1) : Number(size);
  const pages = Math.max(1, Math.ceil(total / n));
  const from = total ? page * n + 1 : 0, to = Math.min(total, (page + 1) * n);
  const nums = [...new Set([0, page - 1, page, page + 1, pages - 1])].filter((p) => p >= 0 && p < pages).sort((a, b) => a - b);
  return (
    <>
      <div ref={root} className="paged">{children}</div>
      {(total > 5 || size !== "all") && (
        <div className="pager" data-nopage>
          <span className="pager-size">{tx("Per pagina")}
            <select value={size} onChange={(e) => choose(e.target.value)} aria-label={tx("Aantal per pagina")}>{SIZES.map((s) => <option key={s} value={s}>{s === "all" ? tx("Alles") : s}</option>)}</select>
          </span>
          <span className="muted pager-count">{from}–{to} {tx("van")} {total}</span>
          {pages > 1 && (
            <span className="pager-nav">
              <button type="button" className="btn sm" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label={tx("Vorige pagina")}>‹</button>
              {nums.map((p, i) => <span key={p}>{i > 0 && p - nums[i - 1] > 1 ? <span className="muted">…</span> : null}<button type="button" className={`btn sm ${p === page ? "primary" : ""}`} onClick={() => setPage(p)}>{p + 1}</button></span>)}
              <button type="button" className="btn sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label={tx("Volgende pagina")}>›</button>
            </span>
          )}
        </div>
      )}
    </>
  );
}

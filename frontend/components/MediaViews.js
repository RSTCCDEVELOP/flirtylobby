// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mediaUrl } from "../lib/api";
import { tx } from "../lib/t";

// The media system objects: photo book, image carousel, photo wall and slideshow. `settings` holds the effects (see backend/apps/medialib/mediaviews.py).

function Lightbox({ items, index, onClose, onIndex }) {
  const it = items[index];
  useEffect(() => {
    const key = (e) => { if (e.key === "Escape") onClose(); else if (e.key === "ArrowRight") onIndex((index + 1) % items.length); else if (e.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, items.length, onClose, onIndex]);
  if (!it || typeof document === "undefined") return null;
  return createPortal(
    <div className="mv-lb" role="dialog" aria-modal="true" onClick={onClose}>
      <button type="button" className="mv-lb-x" onClick={onClose} aria-label={tx("Sluiten")}>×</button>
      {items.length > 1 && <button type="button" className="mv-lb-nav prev" onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + items.length) % items.length); }} aria-label={tx("Vorige")}>‹</button>}
      <figure onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaUrl(it.url)} alt={it.alt} />
        <figcaption>{it.name} <small>{index + 1} / {items.length}</small></figcaption>
      </figure>
      {items.length > 1 && <button type="button" className="mv-lb-nav next" onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % items.length); }} aria-label={tx("Volgende")}>›</button>}
    </div>, document.body);
}

const itemClass = (s) => `mv-item hov-${s.hover || "none"}${s.frame && s.frame !== "none" ? ` fr-${s.frame}` : ""}${s.tilt ? " tilt" : ""}`;
const itemStyle = (s, i) => ({ borderRadius: s.radius, ...(s.ratio && s.ratio !== "auto" ? { aspectRatio: s.ratio.replace("/", " / ") } : {}), ...(s.tilt ? { "--tilt": `${((i * 37) % 7) - 3}deg` } : {}) });

function Tile({ it, i, s, onOpen }) {
  const cap = s.captions !== "none";
  return (
    <figure className={`${itemClass(s)}${s.captions === "hover" ? " cap-hover" : ""}`} style={{ ...itemStyle(s, i), "--op": `${s.plane_opacity ?? 45}%`, boxShadow: s.shadow ? "0 6px 18px rgba(0,0,0,.3)" : undefined, cursor: s.lightbox ? "zoom-in" : "default" }}
      onClick={s.lightbox ? () => onOpen(i) : undefined}>
      <div className="mv-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaUrl(it.url)} alt={it.alt} loading="lazy" style={s.ratio === "auto" ? { height: "auto", aspectRatio: "auto" } : undefined} />
        {s.hover === "plane" && <span className="mv-plane" />}
      </div>
      {(cap || s.hover === "caption") && <figcaption className={s.hover === "caption" ? "cap-over" : ""}>{it.name}</figcaption>}
    </figure>
  );
}

function Carousel({ items, s, onOpen }) {
  const track = useRef(null);
  const [page, setPage] = useState(0);
  const per = Math.max(1, s.visible || 3);
  const pages = Math.max(1, Math.ceil(items.length / per));
  const go = useCallback((dir) => {
    const el = track.current; if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (dir > 0 && el.scrollLeft >= max - 4) { if (s.loop) el.scrollTo({ left: 0, behavior: "smooth" }); }
    else if (dir < 0 && el.scrollLeft <= 4) { if (s.loop) el.scrollTo({ left: max, behavior: "smooth" }); }
    else el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  }, [s.loop]);
  useEffect(() => {
    if (!s.autoplay) return;
    const t = setInterval(() => go(1), Math.max(2, s.interval || 4) * 1000);
    return () => clearInterval(t);
  }, [s.autoplay, s.interval, go]);
  const onScroll = () => { const el = track.current; if (el) setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); };
  return (
    <div className="mv-car" style={{ "--per": per, "--gap": `${s.gap}px` }}>
      <div className="mv-track" ref={track} onScroll={onScroll} style={{ gap: s.gap }}>{items.map((it, i) => <Tile key={i} it={it} i={i} s={s} onOpen={onOpen} />)}</div>
      {s.arrows && <><button type="button" className="mv-arrow prev" onClick={() => go(-1)} aria-label={tx("Vorige")}>‹</button><button type="button" className="mv-arrow next" onClick={() => go(1)} aria-label={tx("Volgende")}>›</button></>}
      {s.dots && pages > 1 && <div className="mv-dots">{Array.from({ length: pages }).map((_, i) => <button type="button" key={i} className={i === page ? "on" : ""} aria-label={`${i + 1}`} onClick={() => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" })} />)}</div>}
    </div>
  );
}

function Slideshow({ items, s, onOpen }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const n = items.length;
  useEffect(() => { if (i >= n) setI(0); }, [n, i]);
  useEffect(() => {
    if (!s.autoplay || hold || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), Math.max(2, s.interval || 5) * 1000);
    return () => clearInterval(t);
  }, [s.autoplay, s.interval, hold, n]);
  return (
    <div className={`mv-show tr-${s.transition}`} style={{ height: s.height, borderRadius: s.radius, boxShadow: s.shadow ? "0 8px 24px rgba(0,0,0,.35)" : undefined }} onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
      {items.map((it, k) => (
        <div key={k} className={`mv-slide${k === i ? " on" : k < i ? " before" : " after"}`} onClick={s.lightbox ? () => onOpen(k) : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaUrl(it.url)} alt={it.alt} loading={k === 0 ? "eager" : "lazy"} />
          {s.captions !== "none" && <div className={`mv-scap${s.caption_overlay ? " over" : ""}`}>{it.name}</div>}
        </div>
      ))}
      {s.arrows && n > 1 && <><button type="button" className="mv-arrow prev" onClick={() => setI((i - 1 + n) % n)} aria-label={tx("Vorige")}>‹</button><button type="button" className="mv-arrow next" onClick={() => setI((i + 1) % n)} aria-label={tx("Volgende")}>›</button></>}
      {s.dots && n > 1 && <div className="mv-dots over">{items.map((_, k) => <button type="button" key={k} className={k === i ? "on" : ""} aria-label={`${k + 1}`} onClick={() => setI(k)} />)}</div>}
    </div>
  );
}

export default function MediaView({ type, settings: s = {}, items = [] }) {
  const [lb, setLb] = useState(-1);
  if (!items.length) return <p className="muted">{tx("Nog geen afbeeldingen gekozen voor dit onderdeel.")}</p>;
  const open = (i) => s.lightbox && setLb(i);
  return (
    <>
      {type === "carousel" ? <Carousel items={items} s={s} onOpen={open} />
        : type === "slideshow" ? <Slideshow items={items} s={s} onOpen={open} />
        : type === "wall" ? <div className="mv-wall" style={{ "--cols": s.columns, columnGap: s.gap }}>{items.map((it, i) => <div key={i} style={{ marginBottom: s.gap }} className="mv-wallitem"><Tile it={it} i={i} s={s} onOpen={open} /></div>)}</div>
        : <div className="mv-grid" style={{ "--cols": s.columns, gap: s.gap }}>{items.map((it, i) => <Tile key={i} it={it} i={i} s={s} onOpen={open} />)}</div>}
      {lb >= 0 && <Lightbox items={items} index={lb} onClose={() => setLb(-1)} onIndex={setLb} />}
    </>
  );
}

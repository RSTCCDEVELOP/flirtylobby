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

// The media system objects: photo book, image carousel, photo wall, slideshow, coverflow, gallery with film strip, mosaic, photo stack, flip book and the video kinds (grid, list with player, carousel); every picture can have a shape. `settings` holds the effects (see backend/apps/medialib/mediaviews.py).

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
        {it.kind === "video"
          ? <video src={mediaUrl(it.url)} controls autoPlay playsInline />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={mediaUrl(it.url)} alt={it.alt} />}
        <figcaption>{it.name} <small>{index + 1} / {items.length}</small></figcaption>
      </figure>
      {items.length > 1 && <button type="button" className="mv-lb-nav next" onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % items.length); }} aria-label={tx("Volgende")}>›</button>}
    </div>, document.body);
}

const shapeCls = (s) => (s.shape && s.shape !== "rect" ? ` sh-${s.shape}` : "");  // the form of the picture (rounded, circle, arch, hexagon, diamond)
const PlayIcon = () => <svg className="mv-play" width="44" height="44" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,.55)" /><path d="M10 8.5v7l6-3.5z" fill="#fff" /></svg>;
const ratioNum = (r) => { const [a, b] = String(r || "4/3").split("/").map(Number); return a && b ? a / b : 4 / 3; };
// a picture, or the first picture of a video (a video has no poster: the browser shows the first frame)
function Pic({ it, s, eager }) {
  return it.kind === "video"
    ? <><video src={`${mediaUrl(it.url)}#t=0.1`} preload="metadata" muted playsInline /><PlayIcon /></>
    // eslint-disable-next-line @next/next/no-img-element
    : <img src={mediaUrl(it.url)} alt={it.alt} loading={eager ? "eager" : "lazy"} style={s?.ratio === "auto" ? { height: "auto", aspectRatio: "auto" } : undefined} />;
}

const itemClass = (s) => `mv-item hov-${s.hover || "none"}${shapeCls(s)}${s.frame && s.frame !== "none" ? ` fr-${s.frame}` : ""}${s.tilt ? " tilt" : ""}`;
const itemStyle = (s, i) => ({ borderRadius: s.radius, ...(s.ratio && s.ratio !== "auto" ? { aspectRatio: s.ratio.replace("/", " / ") } : {}), ...(s.tilt ? { "--tilt": `${((i * 37) % 7) - 3}deg` } : {}) });

function Tile({ it, i, s, onOpen }) {
  const cap = s.captions !== "none";
  return (
    <figure className={`${itemClass(s)}${s.captions === "hover" ? " cap-hover" : ""}`} style={{ ...itemStyle(s, i), "--op": `${s.plane_opacity ?? 45}%`, boxShadow: s.shadow ? "0 6px 18px rgba(0,0,0,.3)" : undefined, cursor: s.lightbox || it.kind === "video" ? (it.kind === "video" ? "pointer" : "zoom-in") : "default" }}
      onClick={s.lightbox || it.kind === "video" ? () => onOpen(i) : undefined}>
      <div className="mv-img">
        <Pic it={it} s={s} />
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

// a timer that moves on by itself (coverflow, film strip, stack)
function useAuto(on, seconds, n, step) {
  useEffect(() => {
    if (!on || n < 2) return undefined;
    const t = setInterval(step, Math.max(2, seconds || 4) * 1000);
    return () => clearInterval(t);
  }, [on, seconds, n, step]);
}
const Arrows = ({ onPrev, onNext }) => <><button type="button" className="mv-arrow prev" onClick={onPrev} aria-label={tx("Vorige")}>‹</button><button type="button" className="mv-arrow next" onClick={onNext} aria-label={tx("Volgende")}>›</button></>;
const Dots = ({ n, i, set }) => <div className="mv-dots">{Array.from({ length: n }).map((_, k) => <button type="button" key={k} className={k === i ? "on" : ""} aria-label={`${k + 1}`} onClick={() => set(k)} />)}</div>;
const Cap = ({ it, s }) => (s.captions !== "none" ? <div className="mv-cf-cap">{it.name}</div> : null);

// Coverflow: the picture in the middle is big, the others stand turned at the sides
function CoverFlow({ items, s, onOpen }) {
  const [i, setI] = useState(0);
  const n = items.length;
  const next = useCallback(() => setI((x) => (x + 1) % n), [n]);
  useAuto(s.autoplay, s.interval, n, next);
  const r = ratioNum(s.ratio), depth = s.depth ?? 55;
  return (
    <div className="mv-cfwrap">
      <div className="mv-cf" style={{ aspectRatio: `${1 / (0.46 * (1 / r) * 1.18)} / 1` }}>
        {items.map((it, k) => {
          let o = k - i; if (o > n / 2) o -= n; if (o < -n / 2) o += n;
          if (Math.abs(o) > 3) return null;
          return (
            <figure key={k} className={`mv-cfitem${shapeCls(s)}${o === 0 ? " on" : ""}`} onClick={() => (o === 0 ? (s.lightbox || it.kind === "video") && onOpen(k) : setI(k))}
              style={{ aspectRatio: String(r), borderRadius: s.radius, boxShadow: s.shadow ? "0 10px 28px rgba(0,0,0,.35)" : undefined, zIndex: 10 - Math.abs(o), opacity: 1 - Math.abs(o) * 0.18,
                transform: `translate(-50%, -50%) translateX(${o * 52}%) translateZ(${-Math.abs(o) * depth * 3}px) rotateY(${-Math.sign(o) * Math.min(Math.abs(o), 1.4) * depth * 0.8}deg) scale(${o === 0 ? 1 : 0.92})` }}>
              <Pic it={it} s={s} eager={Math.abs(o) < 2} />
            </figure>
          );
        })}
        {n > 1 && <Arrows onPrev={() => setI((i - 1 + n) % n)} onNext={next} />}
      </div>
      <Cap it={items[i]} s={s} />
      {n > 1 && <Dots n={n} i={i} set={setI} />}
    </div>
  );
}

// Gallery with a film strip: one big picture, the small ones next to it
function Filmstrip({ items, s, onOpen }) {
  const [i, setI] = useState(0);
  const n = items.length;
  const next = useCallback(() => setI((x) => (x + 1) % n), [n]);
  useAuto(s.autoplay, s.interval, n, next);
  const it = items[Math.min(i, n - 1)];
  const side = s.thumbs === "left" || s.thumbs === "right";
  return (
    <div className={`mv-film pos-${s.thumbs || "bottom"}`} style={{ "--th": `${s.thumb_size || 84}px` }}>
      <div className="mv-filmmain">
        <figure className={`mv-filmbig${shapeCls(s)}`} style={{ aspectRatio: s.ratio?.replace("/", " / "), borderRadius: s.radius, boxShadow: s.shadow ? "0 8px 24px rgba(0,0,0,.3)" : undefined, cursor: s.lightbox || it.kind === "video" ? "zoom-in" : "default" }} onClick={s.lightbox || it.kind === "video" ? () => onOpen(i) : undefined}>
          <Pic it={it} s={s} eager />
        </figure>
        {n > 1 && <Arrows onPrev={() => setI((i - 1 + n) % n)} onNext={next} />}
        <Cap it={it} s={s} />
      </div>
      <div className="mv-strip" style={side ? { maxHeight: "100%" } : undefined}>
        {items.map((x, k) => <button type="button" key={k} className={`mv-thumb${shapeCls(s)}${k === i ? " on" : ""}`} onClick={() => setI(k)} aria-label={x.name} style={{ borderRadius: s.shape && s.shape !== "rect" ? undefined : Math.min(s.radius, 10) }}><Pic it={x} s={{}} /></button>)}
      </div>
    </div>
  );
}

// Mosaic: pictures of different sizes that fit together
function Mosaic({ items, s, onOpen }) {
  const span = (k) => {
    if (s.pattern === "alternate") return k % 5 === 0 ? [2, 1] : k % 7 === 3 ? [1, 2] : [1, 1];
    if (s.pattern === "random") { const v = (k * 7 + 3) % 6; return v === 0 ? [2, 2] : v === 1 ? [2, 1] : v === 2 ? [1, 2] : [1, 1]; }
    return k === 0 ? [2, 2] : [1, 1];  // feature: the first picture is the big one
  };
  return (
    <div className="mv-mosaic" style={{ "--c": s.columns, "--gap": `${s.gap}px`, gap: s.gap }}>
      {items.map((it, k) => { const [cw, rh] = span(k); return (
        <div key={k} className="mv-mosaicitem" style={{ gridColumn: `span ${Math.min(cw, s.columns)}`, gridRow: `span ${rh}` }}>
          <Tile it={it} i={k} s={{ ...s, ratio: "auto" }} onOpen={onOpen} />
        </div>
      ); })}
    </div>
  );
}

// Photo stack: pictures lie on top of each other, a click sends the top one to the back
function Stack({ items, s, onOpen }) {
  const [i, setI] = useState(0);
  const n = items.length;
  const next = useCallback(() => setI((x) => (x + 1) % n), [n]);
  useAuto(s.autoplay, s.interval, n, next);
  const r = ratioNum(s.ratio);
  return (
    <div className="mv-stackwrap">
      <div className="mv-stack" style={{ aspectRatio: String(r * 0.9) }}>
        {items.map((it, k) => {
          const o = (k - i + n) % n;
          if (o > 4) return null;
          const ang = o === 0 ? 0 : (((k * 37) % 7) - 3) * ((s.spread || 10) / 3);
          return (
            <figure key={k} className={`mv-stackitem${shapeCls(s)}`} onClick={o === 0 ? next : undefined}
              style={{ zIndex: 10 - o, borderRadius: s.radius, transform: `translate(-50%, -50%) rotate(${ang}deg) translateY(${o * 2}%) scale(${1 - o * 0.03})`, boxShadow: s.shadow ? "0 8px 22px rgba(0,0,0,.35)" : undefined, cursor: o === 0 ? "pointer" : "default" }}>
              <Pic it={it} s={s} eager={o < 2} />
            </figure>
          );
        })}
      </div>
      <div className="mv-stackbar">
        {n > 1 && <button type="button" className="mv-sbtn" onClick={() => setI((i - 1 + n) % n)} aria-label={tx("Vorige")}>‹</button>}
        <Cap it={items[i]} s={s} />
        {(s.lightbox || items[i].kind === "video") && <button type="button" className="mv-sbtn" onClick={() => onOpen(i)} aria-label={tx("Groot bekijken")}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg></button>}
        {n > 1 && <button type="button" className="mv-sbtn" onClick={next} aria-label={tx("Volgende")}>›</button>}
      </div>
    </div>
  );
}

// Flip book: two pages next to each other, the page turns
function Book({ items, s, onOpen }) {
  const per = Math.max(1, s.per_page || 1);
  const pages = []; for (let k = 0; k < items.length; k += per) pages.push(items.slice(k, k + per));
  if (pages.length % 2) pages.push([]);  // the last spread has a blank page
  const spreads = pages.length / 2;
  const [sp, setSp] = useState(0);
  const [turn, setTurn] = useState("");
  const go = (d) => {
    const to = sp + d; if (turn || to < 0 || to >= spreads) return;
    setTurn(d > 0 ? "next" : "prev");
    setTimeout(() => setSp(to), 260);
    setTimeout(() => setTurn(""), 560);
  };
  const page = (list, side) => (
    <div className={`mv-page ${side}${turn && ((turn === "next" && side === "right") || (turn === "prev" && side === "left")) ? ` turn-${turn}` : ""}`}>
      <div className={`mv-pagegrid g${list.length}`}>
        {list.map((it, k) => (
          <figure key={k} className={shapeCls(s)} style={{ borderRadius: s.radius, aspectRatio: per === 1 ? s.ratio?.replace("/", " / ") : undefined, cursor: s.lightbox || it.kind === "video" ? "zoom-in" : "default" }} onClick={s.lightbox || it.kind === "video" ? () => onOpen(items.indexOf(it)) : undefined}>
            <Pic it={it} s={s} />
            {s.captions !== "none" && <figcaption>{it.name}</figcaption>}
          </figure>
        ))}
      </div>
    </div>
  );
  return (
    <div className={`mv-book cover-${s.cover || "classic"}`} style={{ boxShadow: s.shadow ? "0 14px 34px rgba(0,0,0,.35)" : undefined }}>
      <div className="mv-spread">{page(pages[sp * 2] || [], "left")}{page(pages[sp * 2 + 1] || [], "right")}<span className="mv-spine" /></div>
      {s.arrows && spreads > 1 && <><button type="button" className="mv-bk prev" disabled={sp === 0} onClick={() => go(-1)} aria-label={tx("Vorige")}>‹</button><button type="button" className="mv-bk next" disabled={sp >= spreads - 1} onClick={() => go(1)} aria-label={tx("Volgende")}>›</button></>}
      <div className="mv-bookno">{sp + 1} / {spreads}</div>
    </div>
  );
}

// Video list with a player: one big player, the other videos next to it or under it
function Playlist({ items, s }) {
  const [i, setI] = useState(0);
  const n = items.length;
  const it = items[Math.min(i, n - 1)];
  return (
    <div className={`mv-plist pos-${s.list_pos || "right"}`}>
      <div className={`mv-player${shapeCls(s)}`} style={{ aspectRatio: s.ratio?.replace("/", " / "), borderRadius: s.radius, boxShadow: s.shadow ? "0 8px 24px rgba(0,0,0,.3)" : undefined }}>
        <video key={it.url} src={mediaUrl(it.url)} controls playsInline autoPlay={s.autoplay && i > 0} onEnded={() => { if (i < n - 1) setI(i + 1); else if (s.loop) setI(0); }} />
      </div>
      <ul className="mv-plistitems">
        {items.map((x, k) => (
          <li key={k}><button type="button" className={k === i ? "on" : ""} onClick={() => setI(k)}>
            <span className="mv-plthumb"><video src={`${mediaUrl(x.url)}#t=0.1`} preload="metadata" muted playsInline /></span>
            <span className="mv-plname">{x.name}</span>
          </button></li>
        ))}
      </ul>
    </div>
  );
}

export default function MediaView({ type, settings: s = {}, items = [] }) {
  const [lb, setLb] = useState(-1);
  if (!items.length) return <p className="muted">{["videogrid", "playlist", "vcarousel"].includes(type) ? tx("Nog geen video's gekozen voor dit onderdeel.") : tx("Nog geen afbeeldingen gekozen voor dit onderdeel.")}</p>;
  const open = (i) => (s.lightbox || items[i]?.kind === "video") && setLb(i);
  return (
    <>
      {type === "carousel" || type === "vcarousel" ? <Carousel items={items} s={s} onOpen={open} />
        : type === "coverflow" ? <CoverFlow items={items} s={s} onOpen={open} />
        : type === "filmstrip" ? <Filmstrip items={items} s={s} onOpen={open} />
        : type === "mosaic" ? <Mosaic items={items} s={s} onOpen={open} />
        : type === "stack" ? <Stack items={items} s={s} onOpen={open} />
        : type === "book" ? <Book items={items} s={s} onOpen={open} />
        : type === "playlist" ? <Playlist items={items} s={s} />
        : type === "slideshow" ? <Slideshow items={items} s={s} onOpen={open} />
        : type === "wall" ? <div className="mv-wall" style={{ "--cols": s.columns, columnGap: s.gap }}>{items.map((it, i) => <div key={i} style={{ marginBottom: s.gap }} className="mv-wallitem"><Tile it={it} i={i} s={s} onOpen={open} /></div>)}</div>
        : <div className="mv-grid" style={{ "--cols": s.columns, gap: s.gap }}>{items.map((it, i) => <Tile key={i} it={it} i={i} s={s} onOpen={open} />)}</div>}
      {lb >= 0 && <Lightbox items={items} index={lb} onClose={() => setLb(-1)} onIndex={setLb} />}
    </>
  );
}

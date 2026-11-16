// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

const blobToDataUrl = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
const cache = new Map();
async function inline(url) { // a picture of the page as a data url (so it can be drawn); what cannot be fetched stays as it is
  if (!url || url.startsWith("data:")) return url;
  if (!cache.has(url)) cache.set(url, fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.blob() : Promise.reject())).then(blobToDataUrl).catch(() => url));
  return cache.get(url);
}

// A screenshot of what you see in the preview (the page in the frame, at the place where you scrolled to), as a png (data url). The frame has no scripts: it is only read here.
export async function captureFrame(iframe, maxWidth = 1400, opts = {}) {
  const doc = iframe?.contentDocument;
  const win = iframe?.contentWindow;
  if (!doc?.documentElement || !win) throw new Error("De voorbeeldpagina is nog niet klaar.");
  const el = doc.documentElement;
  const vw = Math.max(200, el.clientWidth), vh = Math.max(200, el.clientHeight), sy = Math.max(0, win.scrollY || 0), full = Math.max(el.scrollHeight, vh);
  const root = el.cloneNode(true);
  root.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  root.querySelectorAll("script,video,audio,iframe,link").forEach((n) => n.remove());
  if (opts.styles) {  // a live page has its css in files (link): the rules are put in the picture as one style, so the page keeps its look
    let css = "";
    for (const sh of [...doc.styleSheets]) { try { for (const r of [...sh.cssRules]) css += `${r.cssText}\n`; } catch { /* a sheet of another site cannot be read */ } }
    const st = doc.createElement("style"); st.textContent = css;
    (root.querySelector("head") || root).appendChild(st);
  }
  await Promise.all([...root.querySelectorAll("img")].map(async (img) => { img.removeAttribute("srcset"); img.removeAttribute("loading"); const s = img.getAttribute("src"); if (s) img.setAttribute("src", await inline(new URL(s, doc.baseURI).href)); }));
  let html = new XMLSerializer().serializeToString(root);
  const urls = [...new Set([...html.matchAll(/url\(\s*["']?((?:https?:)?\/\/[^)"']+|\/[^)"']+)["']?\s*\)/g)].map((m) => m[1].replace(/&amp;/g, "&")))];
  for (const u of urls) { const d = await inline(new URL(u, doc.baseURI).href); html = html.split(u.replace(/&/g, "&amp;")).join(d.replace(/&/g, "&amp;")).split(u).join(d); }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 ${sy} ${vw} ${vh}"><foreignObject x="0" y="0" width="${vw}" height="${full}">${html}</foreignObject></svg>`;
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("De screenshot kon niet worden gemaakt.")); i.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; });
  const k = Math.min(2, maxWidth / vw);
  const c = document.createElement("canvas");
  c.width = Math.round(vw * k); c.height = Math.round(vh * k);
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  let out = c.toDataURL("image/png");
  if (out.length > 5_000_000) out = c.toDataURL("image/jpeg", 0.85);
  return out;
}

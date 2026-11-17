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
  // the pictures of the website come from the server of the site (another address while developing): that server allows a plain request (no cookies) from the site, not one with cookies; a picture that needs a login is tried with cookies second
  if (!cache.has(url)) cache.set(url, fetch(url, { credentials: "omit" }).then((r) => (r.ok ? r.blob() : Promise.reject())).catch(() => fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.blob() : Promise.reject()))).then(blobToDataUrl).catch(() => url));
  return cache.get(url);
}

// A screenshot of what you see in the preview (the page in the frame, at the place where you scrolled to), as a png (data url). The frame has no scripts: it is only read here.
export async function captureFrame(iframe, maxWidth = 1400, opts = {}) {
  const doc = iframe?.contentDocument;
  const win = iframe?.contentWindow;
  if (!doc?.documentElement || !win) throw new Error("De voorbeeldpagina is nog niet klaar.");
  const el = doc.documentElement;
  const vw = Math.max(200, el.clientWidth), full = Math.max(el.scrollHeight, doc.body?.scrollHeight || 0, Math.max(200, el.clientHeight));
  const vh = opts.full ? full : Math.max(200, el.clientHeight), sy = opts.full ? 0 : Math.max(0, win.scrollY || 0);  // full: the whole page from the top, not only what is visible
  const root = el.cloneNode(true);
  root.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  root.querySelectorAll("script,video,audio,iframe,link").forEach((n) => n.remove());
  // the light or dark mode that the preview SHOWS is frozen: a picture is drawn in another context, where "prefers-color-scheme" can be something else (the dark mode of the computer), and then the page came out dark and unreadable
  let darkNow = false; try { darkNow = !!win.matchMedia("(prefers-color-scheme: dark)").matches; } catch { /* no media query: light */ }
  const freeze = (css) => css.replace(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/gi, darkNow ? "@media all" : "@media not all").replace(/@media\s*\(\s*prefers-color-scheme\s*:\s*light\s*\)/gi, darkNow ? "@media not all" : "@media all");
  root.querySelectorAll("style").forEach((n) => { n.textContent = freeze(n.textContent || ""); });
  if (opts.styles) {  // a live page has its css in files (link): the rules are put in the picture as one style, so the page keeps its look
    let css = "";
    for (const sh of [...doc.styleSheets]) { try { for (const r of [...sh.cssRules]) css += `${r.cssText}\n`; } catch { /* a sheet of another site cannot be read */ } }
    const st = doc.createElement("style"); st.textContent = freeze(css);
    (root.querySelector("head") || root).appendChild(st);
  }
  await Promise.all([...root.querySelectorAll("img")].map(async (img) => { img.removeAttribute("srcset"); img.removeAttribute("loading"); const s = img.getAttribute("src"); if (s) img.setAttribute("src", await inline(new URL(s, doc.baseURI).href)); }));
  let html = new XMLSerializer().serializeToString(root);
  const urls = [...new Set([...html.matchAll(/url\(\s*["']?((?:https?:)?\/\/[^)"']+|\/[^)"']+)["']?\s*\)/g)].map((m) => m[1].replace(/&amp;/g, "&")))];
  for (const u of urls) { const d = await inline(new URL(u, doc.baseURI).href); html = html.split(u.replace(/&/g, "&amp;")).join(d.replace(/&/g, "&amp;")).split(u).join(d); }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 ${sy} ${vw} ${vh}"><foreignObject x="0" y="0" width="${vw}" height="${full}">${html}</foreignObject></svg>`;
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("De screenshot kon niet worden gemaakt.")); i.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; });
  let k = Math.min(2, maxWidth / vw);
  if (vh * k > 15000) k = 15000 / vh;  // a very long page: a smaller picture (a canvas has a maximum size)
  const c = document.createElement("canvas");
  c.width = Math.round(vw * k); c.height = Math.round(vh * k);
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  let out = c.toDataURL("image/png");
  if (out.length > 5_000_000) out = c.toDataURL("image/jpeg", 0.85);
  return out;
}

// ── saving a screenshot as a file ──
async function toJpegBlob(dataUrl, quality = 0.92) {  // a jpeg (white behind transparent parts)
  const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("De screenshot kon niet worden omgezet.")); i.src = dataUrl; });
  const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0);
  const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", quality));
  if (!blob) throw new Error("De screenshot kon niet worden omgezet.");
  return { blob, w: im.width, h: im.height };
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const safeName = (t) => String(t || "screenshot").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "screenshot";

export async function saveAsJpg(dataUrl, name) {
  const { blob } = await toJpegBlob(dataUrl);
  download(blob, `${safeName(name)}.jpg`);
}

// A PDF with one page that has the size of the picture (so a long page stays one piece): the jpeg is put in the file as it is, no library needed.
export async function saveAsPdf(dataUrl, name) {
  const { blob, w, h } = await toJpegBlob(dataUrl, 0.9);
  const jpg = new Uint8Array(await blob.arrayBuffer());
  const W = 595, H = Math.min(14400, Math.max(100, Math.round(595 * h / w)));  // points; the PDF format has a maximum page size of 14400
  const enc = new TextEncoder(), parts = [], offs = [];
  let pos = 0;
  const add = (u8) => { parts.push(u8); pos += u8.length; };
  const str = (s) => add(enc.encode(s));
  const obj = (n, body, stream) => { offs[n] = pos; str(`${n} 0 obj\n${body}`); if (stream) { str("\nstream\n"); add(stream); str("\nendstream"); } str("\nendobj\n"); };
  str("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4, `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>`, jpg);
  const content = enc.encode(`q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`);
  obj(5, `<< /Length ${content.length} >>`, content);
  const xref = pos;
  str(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => `${String(offs[n]).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  download(new Blob(parts, { type: "application/pdf" }), `${safeName(name)}.pdf`);
}

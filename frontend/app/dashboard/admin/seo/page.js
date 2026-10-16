"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import MediaPicker from "../../../../components/MediaPicker";
import { api, errorText, mediaUrl } from "../../../../lib/api";
import { lvl } from "../../../../lib/perms";

const DOT = { ok: "ok", warn: "warn", fail: "fail", info: "none" };
const origin = () => (typeof window === "undefined" ? "" : window.location.origin);
const getText = async (path) => { try { return await (await fetch(mediaUrl(`${path}?base=${encodeURIComponent(origin())}`), { cache: "no-store" })).text(); } catch { return ""; } };

const Switch = ({ label, checked, onChange, hint, disabled }) => (
  <label className="check sec-toggle">
    <span className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span>
    <span>{label}{hint && <small className="muted"> {hint}</small>}</span>
  </label>
);

// How the page could look in Google
function Serp({ title, description, url }) {
  return (
    <div className="serp">
      <small>{url}</small>
      <div className="serp-title">{title || "Titel van de pagina"}</div>
      <div className="serp-desc">{description || "De omschrijving verschijnt hier. Schrijf 70 tot 160 tekens die uitnodigen om te klikken."}</div>
    </div>
  );
}
const Counter = ({ n, lo, hi }) => <small className={n && n >= lo && n <= hi ? "ok-text" : "muted"}> {n} tekens (ideaal {lo}–{hi})</small>;

export default function Seo() {
  const { user } = useAuth();
  const L = lvl(user, "seo");
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({ bots: [], pages: [], languages: [], types: [], freq: [] });
  const [pages, setPages] = useState([]);
  const [audit, setAudit] = useState([]);
  const [msg, setMsg] = useState(null);
  const [previews, setPreviews] = useState({ robots: "", sitemap: "", llms: "", jsonld: "" });
  const [lang, setLang] = useState("nl");
  const [path, setPath] = useState("/");
  const [custom, setCustom] = useState("");
  const [picker, setPicker] = useState(null); // "site" | "page"

  const loadPreviews = useCallback(async () => {
    const [robots, sitemap, llms, pub] = await Promise.all([getText("/api/seo/robots.txt"), getText("/api/seo/sitemap.xml"), getText("/api/seo/llms.txt"), getText("/api/seo/public/")]);
    let jsonld = "";
    try { jsonld = JSON.stringify(JSON.parse(pub).jsonld, null, 2); } catch {}
    setPreviews({ robots, sitemap, llms, jsonld });
  }, []);
  const loadAudit = useCallback(() => api("/seo/audit/").then(setAudit).catch(() => {}), []);
  const load = useCallback(async () => {
    try {
      const d = await api("/seo/settings/");
      setData(d.settings);
      setMeta(d);
      setLang((l) => (d.languages.find((x) => x.code === l) ? l : (d.languages.find((x) => x.is_default) || d.languages[0] || { code: "nl" }).code));
      setPages(await api("/seo/pages/"));
      loadAudit();
      loadPreviews();
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }, [loadAudit, loadPreviews]);
  useEffect(() => { load(); }, [load]);

  if (!data) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">Laden…</p>;

  const set = (sec) => (k, v) => setData((d) => ({ ...d, [sec]: { ...d[sec], [k]: v } }));
  const site = set("site"), ver = set("verification"), bots = set("bots"), rob = set("robots"), map = set("sitemap"), llms = set("llms"), sc = set("schema");

  async function save() {
    try {
      const r = await api("/seo/settings/", { method: "PUT", body: data });
      setData(r.settings);
      setMsg({ ok: true, text: "SEO-instellingen opgeslagen." });
      loadAudit();
      loadPreviews();
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }

  // page editor
  const allPaths = [...meta.pages.map((p) => p.path), ...pages.map((p) => p.path)].filter((v, i, a) => a.indexOf(v) === i);
  const label = (p) => meta.pages.find((x) => x.path === p)?.label || p;
  const current = pages.find((p) => p.path === path && p.lang === lang) || { path, lang, title: "", description: "", og_media: null, og_image: null, noindex: false, canonical: "" };
  const setPage = (patch) => setPages((list) => (list.some((p) => p.path === path && p.lang === lang) ? list.map((p) => (p.path === path && p.lang === lang ? { ...p, ...patch } : p)) : [...list, { ...current, ...patch }]));
  async function savePage() {
    try {
      const saved = await api("/seo/pages/", { method: "PUT", body: current });
      setPages((list) => list.map((p) => (p.path === saved.path && p.lang === saved.lang ? saved : p)));
      setMsg({ ok: true, text: `${label(path)} (${lang}) opgeslagen.` });
      loadAudit(); loadPreviews();
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }
  const base = data.site.site_url || origin();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>SEO</h1>
          <p className="muted" style={{ margin: 0 }}>Hoe zoekmachines, bots en AI-agents je site vinden, lezen en tonen. Pagina's per taal, robots.txt, sitemap, llms.txt en structured data.</p>
        </div>
        <div className="row">
          <CollapseAll />
          <button className="btn primary" onClick={save} disabled={L < 2}>Opslaan</button>
        </div>
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <Collapsible id="seo-audit" title={`Controle (${audit.filter((c) => c.level === "warn" || c.level === "fail").length} aandachtspunten)`}>
        <div className="audit">
          {audit.map((c, i) => (
            <div key={i} className="audit-row">
              <span className={`dot ${DOT[c.level]}`} />
              <span><strong>{c.title}</strong>{c.detail && <small className="muted"> {c.detail}</small>}</span>
              {c.path && <button className="btn sm" onClick={() => { setPath(c.path); }}>Naar pagina</button>}
            </div>
          ))}
        </div>
        <button className="btn sm" style={{ marginTop: ".75rem" }} onClick={loadAudit}>Opnieuw controleren</button>
      </Collapsible>

      <Collapsible id="seo-site" title="Algemeen en indexeren">
        <Switch label="Zoekmachines mogen de site indexeren" hint="zet uit voor een testomgeving" checked={data.site.allow_indexing} onChange={(v) => site("allow_indexing", v)} />
        <div className="theme-grid">
          <label>Sitenaam<input value={data.site.name} onChange={(e) => site("name", e.target.value)} /></label>
          <label>Website-adres<input value={data.site.site_url} placeholder="https://www.jouwdomein.nl" onChange={(e) => site("site_url", e.target.value)} /></label>
          <label>Standaardtitel (homepage)<input value={data.site.default_title} onChange={(e) => site("default_title", e.target.value)} /></label>
          <label>Titelformaat voor andere pagina's <small className="muted">%s = paginatitel</small><input value={data.site.title_template} onChange={(e) => site("title_template", e.target.value)} /></label>
          <label>X / Twitter-gebruikersnaam<input value={data.site.twitter} placeholder="@studio2" onChange={(e) => site("twitter", e.target.value)} /></label>
          <label>AI-gebruik van je teksten
            <select value={data.site.ai_meta} onChange={(e) => site("ai_meta", e.target.value)}>
              <option value="allow">Toestaan</option><option value="noai">Niet gebruiken voor AI-training (noai-tag)</option>
            </select>
          </label>
        </div>
        <label>Standaard omschrijving <Counter n={data.site.default_description.length} lo={70} hi={160} />
          <textarea rows={2} value={data.site.default_description} onChange={(e) => site("default_description", e.target.value)} />
        </label>
        <div className="photo-row">
          {data.site.default_og_media ? <span className="muted">Deelafbeelding gekozen</span> : <span className="muted">Geen deelafbeelding (1200×630 aanbevolen)</span>}
          <button type="button" className="btn sm" onClick={() => setPicker("site")} disabled={L < 2}>Deelafbeelding kiezen</button>
          {data.site.default_og_media && <button type="button" className="btn sm danger" onClick={() => site("default_og_media", null)}>Verwijderen</button>}
        </div>
        <h3>Verificatie (Search Console)</h3>
        <div className="theme-grid">
          <label>Google<input value={data.verification.google} onChange={(e) => ver("google", e.target.value)} /></label>
          <label>Bing<input value={data.verification.bing} onChange={(e) => ver("bing", e.target.value)} /></label>
          <label>Yandex<input value={data.verification.yandex} onChange={(e) => ver("yandex", e.target.value)} /></label>
          <label>Pinterest<input value={data.verification.pinterest} onChange={(e) => ver("pinterest", e.target.value)} /></label>
        </div>
      </Collapsible>

      <Collapsible id="seo-pages" title="Pagina's: titel, omschrijving en deelafbeelding">
        <div className="lang-bar" style={{ boxShadow: "none", border: 0, padding: 0 }}>
          <strong>Taal:</strong>
          {meta.languages.map((l) => <button key={l.code} className={`btn sm ${lang === l.code ? "primary" : ""}`} onClick={() => setLang(l.code)}>{l.native_name}</button>)}
        </div>
        <div className="grid2">
          <label>Pagina
            <select value={path} onChange={(e) => setPath(e.target.value)}>{allPaths.map((p) => <option key={p} value={p}>{label(p)} ({p})</option>)}</select>
          </label>
          <label>Eigen pagina toevoegen (pad)
            <span className="color-row">
              <input value={custom} placeholder="/diensten" onChange={(e) => setCustom(e.target.value)} />
              <button type="button" className="btn" disabled={!custom.startsWith("/") || L < 2} onClick={() => { setPath(custom); setPages((l) => [...l, { path: custom, lang, title: "", description: "", og_media: null, noindex: false, canonical: "" }]); setCustom(""); }}>Toevoegen</button>
            </span>
          </label>
        </div>
        <Serp title={current.title} description={current.description} url={`${base}${path}`} />
        <label>Titel <Counter n={current.title.length} lo={30} hi={60} />
          <input value={current.title} onChange={(e) => setPage({ title: e.target.value })} maxLength={200} />
        </label>
        <label>Omschrijving <Counter n={current.description.length} lo={70} hi={160} />
          <textarea rows={3} value={current.description} onChange={(e) => setPage({ description: e.target.value })} maxLength={400} />
        </label>
        <div className="theme-grid">
          <label>Canonical URL (optioneel)<input value={current.canonical} placeholder={`${base}${path}`} onChange={(e) => setPage({ canonical: e.target.value })} /></label>
          <div className="photo-row">
            {current.og_image && <img src={mediaUrl(current.og_image)} alt="" className="photo-preview" style={{ borderRadius: 8 }} />}
            <button type="button" className="btn sm" onClick={() => setPicker("page")} disabled={L < 2}>Deelafbeelding</button>
            {current.og_media && <button type="button" className="btn sm danger" onClick={() => setPage({ og_media: null, og_image: null })}>Verwijderen</button>}
          </div>
        </div>
        <Switch label="Niet indexeren (noindex)" hint="de pagina verdwijnt uit zoekresultaten en sitemap" checked={current.noindex} onChange={(v) => setPage({ noindex: v })} />
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <button className="btn primary" onClick={savePage} disabled={L < 2}>Pagina opslaan</button>
        </div>
      </Collapsible>

      <Collapsible id="seo-bots" title="Bots, crawlers en AI-agents (robots.txt)">
        <p className="muted" style={{ marginTop: 0 }}>Bepaal per bot of die je site mag lezen. Let op: robots.txt is een verzoek; nette bots houden zich eraan. AI-training staat standaard uit.</p>
        {meta.bots.map((g) => (
          <div key={g.group}>
            <h3>{g.label}</h3>
            <div className="bot-grid">
              {g.bots.map((b) => <Switch key={b.key} label={b.label} hint={b.token} checked={data.bots[b.key]} onChange={(v) => bots(b.key, v)} disabled={L < 2} />)}
            </div>
          </div>
        ))}
        <Switch label="Alle andere bots toestaan" checked={data.bots.other} onChange={(v) => bots("other", v)} />
        <div className="theme-grid">
          <label>Paden die voor alle bots verboden zijn (één per regel)
            <textarea rows={3} value={data.robots.disallow.join("\n")} onChange={(e) => rob("disallow", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
          </label>
          <label>Crawl-delay <small className="muted">seconden, 0 = niet instellen</small>
            <input type="number" min={0} max={60} value={data.robots.crawl_delay} onChange={(e) => rob("crawl_delay", Number(e.target.value))} />
          </label>
        </div>
        <label>Extra regels voor robots.txt (geavanceerd)
          <textarea rows={3} value={data.robots.extra} onChange={(e) => rob("extra", e.target.value)} />
        </label>
        <h3>Voorbeeld: robots.txt <a href="/robots.txt" target="_blank" rel="noreferrer" className="muted">(openen)</a></h3>
        <pre className="preview">{previews.robots}</pre>
      </Collapsible>

      <Collapsible id="seo-sitemap" title="Sitemap">
        <Switch label="Sitemap (sitemap.xml) aanbieden" checked={data.sitemap.enabled} onChange={(v) => map("enabled", v)} />
        <div className="theme-grid">
          <label>Hoe vaak verandert de site
            <select value={data.sitemap.changefreq} onChange={(e) => map("changefreq", e.target.value)}>{meta.freq.map((f) => <option key={f}>{f}</option>)}</select>
          </label>
          <label>Prioriteit van pagina's <small className="muted">0 tot 1, homepage is altijd 1</small>
            <input type="number" min={0} max={1} step={0.1} value={data.sitemap.priority} onChange={(e) => map("priority", Number(e.target.value))} />
          </label>
        </div>
        <h3>Voorbeeld: sitemap.xml <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="muted">(openen)</a></h3>
        <pre className="preview">{previews.sitemap}</pre>
      </Collapsible>

      <Collapsible id="seo-llms" title="AI-agents (llms.txt)">
        <p className="muted" style={{ marginTop: 0 }}>Een korte beschrijving van je site in gewone tekst, bedoeld voor AI-assistenten.</p>
        <Switch label="llms.txt aanbieden" checked={data.llms.enabled} onChange={(v) => llms("enabled", v)} />
        <Switch label="Pagina's met titel en omschrijving opnemen" checked={data.llms.include_pages} onChange={(v) => llms("include_pages", v)} />
        <label>Samenvatting <small className="muted">leeg = standaard omschrijving</small>
          <textarea rows={3} value={data.llms.summary} onChange={(e) => llms("summary", e.target.value)} />
        </label>
        <label>Extra tekst (bv. diensten, contact, hoe je citeert)
          <textarea rows={4} value={data.llms.extra} onChange={(e) => llms("extra", e.target.value)} />
        </label>
        <h3>Voorbeeld: llms.txt <a href="/llms.txt" target="_blank" rel="noreferrer" className="muted">(openen)</a></h3>
        <pre className="preview">{previews.llms || "(staat uit)"}</pre>
      </Collapsible>

      <Collapsible id="seo-schema" title="Structured data (JSON-LD)">
        <Switch label="Organisatie en website meegeven aan zoekmachines" checked={data.schema.enabled} onChange={(v) => sc("enabled", v)} />
        <div className="theme-grid">
          <label>Soort
            <select value={data.schema.type} onChange={(e) => sc("type", e.target.value)}>{meta.types.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
          <label>Officiële naam<input value={data.schema.legal_name} onChange={(e) => sc("legal_name", e.target.value)} /></label>
          <label>E-mail<input value={data.schema.email} onChange={(e) => sc("email", e.target.value)} /></label>
          <label>Telefoon<input value={data.schema.phone} placeholder="+31…" onChange={(e) => sc("phone", e.target.value)} /></label>
        </div>
        <label>Omschrijving<textarea rows={2} value={data.schema.description} onChange={(e) => sc("description", e.target.value)} /></label>
        <label>Sociale profielen (één URL per regel)
          <textarea rows={3} value={data.schema.same_as.join("\n")} onChange={(e) => sc("same_as", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
        </label>
        <h3>Voorbeeld</h3>
        <pre className="preview">{previews.jsonld || "(staat uit)"}</pre>
      </Collapsible>

      {picker && (
        <MediaPicker
          onClose={() => setPicker(null)}
          onPick={(item) => { if (picker === "site") site("default_og_media", item.id); else setPage({ og_media: item.id, og_image: item.url }); setPicker(null); }}
        />
      )}
    </>
  );
}

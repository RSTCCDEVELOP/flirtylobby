"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import MediaPicker from "../../../../components/MediaPicker";
import RichEditor from "../../../../components/RichEditor";
import { api, errorText, mediaUrl } from "../../../../lib/api";
import { money } from "../../../../lib/format";
import { lvl } from "../../../../lib/perms";

const NEW_GROUP = { name: "", description: "", parent: "", order: 0, active: true, media: null, image: null };
const NEW_PRODUCT = { name: "", sku: "", summary: "", description: "", price: "", stock: "", vat_rate: "", group: "", active: true, images: [] };

export default function Products() {
  const { user } = useAuth();
  const L = lvl(user, "products");
  const [groups, setGroups] = useState([]);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState(null);
  const [gm, setGm] = useState(null); // group modal
  const [pm, setPm] = useState(null); // product modal
  const [picker, setPicker] = useState(null); // "group" | "product"
  const [editor, setEditor] = useState(false);
  const [vat, setVat] = useState({ vat_rates: ["21", "9", "0"], default_vat: "21", prices_include_vat: true });
  useEffect(() => { api("/shop/admin/settings/").then(setVat).catch(() => {}); }, []);

  const load = useCallback(() => {
    api("/shop/admin/groups/").then(setGroups).catch((e) => setMsg({ ok: false, text: errorText(e) }));
    api(`/shop/admin/products/${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(setProducts).catch(() => {});
  }, [q]);
  useEffect(() => { load(); }, [load]);

  async function saveGroup(e) {
    e.preventDefault();
    const { id, image, product_count, slug, error: _e, ...body } = gm;
    body.parent = body.parent || null;
    try {
      await (id ? api(`/shop/admin/groups/${id}/`, { method: "PATCH", body }) : api("/shop/admin/groups/", { method: "POST", body }));
      setGm(null); load();
    } catch (err) { setGm({ ...gm, error: errorText(err) }); }
  }
  async function saveProduct(e) {
    e.preventDefault();
    const { id, group_name, slug, error: _e, ...body } = pm;
    body.group = body.group || null;
    body.stock = body.stock === "" || body.stock === null ? null : Number(body.stock);
    body.vat_rate = body.vat_rate === "" || body.vat_rate === null ? null : body.vat_rate;
    body.images = body.images.map((i) => ({ media: i.media, alt: i.alt || "" }));
    try {
      await (id ? api(`/shop/admin/products/${id}/`, { method: "PATCH", body }) : api("/shop/admin/products/", { method: "POST", body }));
      setPm(null); load();
    } catch (err) { setPm({ ...pm, error: errorText(err) }); }
  }
  const del = (kind, o) => confirm(`"${o.name}" verwijderen?`) && api(`/shop/admin/${kind}/${o.id}/`, { method: "DELETE" }).then(load).catch((e) => setMsg({ ok: false, text: errorText(e) }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Producten</h1>
          <p className="muted" style={{ margin: 0 }}>Producten en productgroepen voor de webshop. De productpagina's staan op <code>/producten</code>.</p>
        </div>
        <CollapseAll />
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <Collapsible id="shop-groups" title={`Productgroepen (${groups.length})`}>
        {L >= 3 && <button className="btn primary" onClick={() => setGm({ ...NEW_GROUP })}>+ Nieuwe groep</button>}
        <div className="int-list" style={{ marginTop: ".75rem" }}>
          {groups.map((g) => (
            <div className="card int-item" key={g.id}>
              {g.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(g.image)} alt="" className="photo-preview" style={{ borderRadius: 8 }} />}
              <div className="int-main">
                <strong>{g.name} <span className={`badge ${g.active ? "ok" : "off"}`} style={{ marginLeft: ".4rem" }}>{g.active ? "Actief" : "Verborgen"}</span></strong>
                <span className="muted">{g.product_count} product{g.product_count === 1 ? "" : "en"}{g.parent ? ` · onder ${groups.find((x) => x.id === g.parent)?.name || "…"}` : ""}</span>
              </div>
              <div className="int-actions">
                {L >= 2 && <button className="btn sm" onClick={() => setGm({ ...g, parent: g.parent || "" })}>Wijzig</button>}
                {L >= 3 && <button className="btn sm danger" onClick={() => del("groups", g)}>Verwijder</button>}
              </div>
            </div>
          ))}
          {!groups.length && <p className="muted">Nog geen groepen.</p>}
        </div>
      </Collapsible>

      <Collapsible id="shop-products" title={`Producten (${products.length})`}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: ".75rem" }}>
          <input style={{ maxWidth: 300 }} placeholder="Zoek op naam of artikelnummer…" value={q} onChange={(e) => setQ(e.target.value)} />
          {L >= 3 && <button className="btn primary" onClick={() => setPm({ ...NEW_PRODUCT })}>+ Nieuw product</button>}
        </div>
        <div className="table-wrap" style={{ border: "1px solid var(--line)", borderRadius: "var(--btn-radius)" }}>
          <table>
            <thead><tr><th>Product</th><th>Groep</th><th>Prijs</th><th>Voorraad</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td><span className="user-cell">{p.images[0] && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(p.images[0].url)} alt="" className="avatar-img" style={{ borderRadius: 6 }} />}{p.name}{p.sku && <small className="muted"> {p.sku}</small>}</span></td>
                  <td>{p.group_name || "—"}</td>
                  <td>{money(p.price)}</td>
                  <td>{p.stock === null ? "∞" : <span className={p.stock === 0 ? "stock-out" : ""}>{p.stock}</span>}</td>
                  <td><span className={`badge ${p.active ? "ok" : "off"}`}>{p.active ? "Actief" : "Verborgen"}</span></td>
                  <td className="actions">
                    {p.active && <a className="btn sm" href={`/producten/${p.slug}`} target="_blank" rel="noreferrer">Bekijk</a>}
                    {L >= 2 && <button className="btn sm" onClick={() => setPm({ ...p, group: p.group || "", stock: p.stock ?? "", vat_rate: p.vat_rate ?? "" })}>Wijzig</button>}
                    {L >= 3 && <button className="btn sm danger" onClick={() => del("products", p)}>Verwijder</button>}
                  </td>
                </tr>
              ))}
              {!products.length && <tr><td colSpan={6} className="muted">Geen producten.</td></tr>}
            </tbody>
          </table>
        </div>
      </Collapsible>

      {gm && (
        <div className="overlay" onClick={() => setGm(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={saveGroup}>
            <h2>{gm.id ? "Groep wijzigen" : "Nieuwe groep"}</h2>
            <div className="grid2">
              <label>Naam<input value={gm.name} onChange={(e) => setGm({ ...gm, name: e.target.value })} required /></label>
              <label>Onder groep
                <select value={gm.parent} onChange={(e) => setGm({ ...gm, parent: e.target.value ? Number(e.target.value) : "" })}>
                  <option value="">— Hoofdgroep —</option>
                  {groups.filter((g) => g.id !== gm.id && !g.parent).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
            </div>
            <label>Omschrijving<input value={gm.description} onChange={(e) => setGm({ ...gm, description: e.target.value })} maxLength={500} /></label>
            <div className="grid2">
              <label>Volgorde<input type="number" min={0} value={gm.order} onChange={(e) => setGm({ ...gm, order: Number(e.target.value) })} /></label>
              <label className="check" style={{ alignSelf: "end" }}><input type="checkbox" checked={gm.active} onChange={(e) => setGm({ ...gm, active: e.target.checked })} /> Zichtbaar in de webshop</label>
            </div>
            <div className="photo-row">
              {gm.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(gm.image)} alt="" className="photo-preview" style={{ borderRadius: 8 }} />}
              <button type="button" className="btn sm" onClick={() => setPicker("group")}>Afbeelding kiezen</button>
              {gm.media && <button type="button" className="btn sm danger" onClick={() => setGm({ ...gm, media: null, image: null })}>Verwijderen</button>}
            </div>
            {gm.error && <div className="alert">{gm.error}</div>}
            <div className="row"><button type="button" className="btn" onClick={() => setGm(null)}>Annuleren</button><button className="btn primary">Opslaan</button></div>
          </form>
        </div>
      )}

      {pm && (
        <div className="overlay" onClick={() => setPm(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={saveProduct}>
            <h2>{pm.id ? "Product wijzigen" : "Nieuw product"}</h2>
            <div className="grid2">
              <label>Naam<input value={pm.name} onChange={(e) => setPm({ ...pm, name: e.target.value })} required /></label>
              <label>Artikelnummer<input value={pm.sku} onChange={(e) => setPm({ ...pm, sku: e.target.value })} /></label>
              <label>Prijs (€, {vat.prices_include_vat ? "incl." : "excl."} btw)<input value={pm.price} inputMode="decimal" onChange={(e) => setPm({ ...pm, price: e.target.value })} required /></label>
              <label>Voorraad <small className="muted">leeg = onbeperkt</small><input type="number" min={0} value={pm.stock} onChange={(e) => setPm({ ...pm, stock: e.target.value })} /></label>
              <label>Btw-percentage
                <select value={pm.vat_rate ?? ""} onChange={(e) => setPm({ ...pm, vat_rate: e.target.value })}>
                  <option value="">Standaard ({vat.default_vat}%)</option>
                  {vat.vat_rates.map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </label>
              <label>Groep
                <select value={pm.group} onChange={(e) => setPm({ ...pm, group: e.target.value ? Number(e.target.value) : "" })}>
                  <option value="">— Geen groep —</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
              <label className="check" style={{ alignSelf: "end" }}><input type="checkbox" checked={pm.active} onChange={(e) => setPm({ ...pm, active: e.target.checked })} /> Zichtbaar in de webshop</label>
            </div>
            <label>Korte omschrijving<input value={pm.summary} onChange={(e) => setPm({ ...pm, summary: e.target.value })} maxLength={300} /></label>
            <div>
              <strong style={{ fontSize: ".85rem" }}>Uitgebreide beschrijving</strong>
              <div className="rich-text" style={{ border: "1px solid var(--line)", borderRadius: "var(--btn-radius)", padding: ".75rem", maxHeight: 120, overflow: "auto", margin: ".4rem 0" }}
                dangerouslySetInnerHTML={{ __html: pm.description || "<p class='muted'>Nog geen beschrijving.</p>" }} />
              <button type="button" className="btn sm" onClick={() => setEditor(true)}>Beschrijving bewerken</button>
            </div>
            <div>
              <strong style={{ fontSize: ".85rem" }}>Foto's ({pm.images.length}/12)</strong>
              <div className="photo-admin" style={{ marginTop: ".4rem" }}>
                {pm.images.map((im, n) => (
                  <div className="photo-item" key={n}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(im.url)} alt="" />
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span>
                        <button type="button" className="btn sm" disabled={n === 0} onClick={() => { const a = [...pm.images]; [a[n - 1], a[n]] = [a[n], a[n - 1]]; setPm({ ...pm, images: a }); }}>←</button>{" "}
                        <button type="button" className="btn sm" disabled={n === pm.images.length - 1} onClick={() => { const a = [...pm.images]; [a[n + 1], a[n]] = [a[n], a[n + 1]]; setPm({ ...pm, images: a }); }}>→</button>
                      </span>
                      <button type="button" className="btn sm danger" onClick={() => setPm({ ...pm, images: pm.images.filter((_, i) => i !== n) })}>Weg</button>
                    </div>
                  </div>
                ))}
              </div>
              {pm.images.length < 12 && <button type="button" className="btn sm" style={{ marginTop: ".5rem" }} onClick={() => setPicker("product")}>+ Foto toevoegen</button>}
            </div>
            {pm.error && <div className="alert">{pm.error}</div>}
            <div className="row"><button type="button" className="btn" onClick={() => setPm(null)}>Annuleren</button><button className="btn primary">Opslaan</button></div>
          </form>
        </div>
      )}

      {picker && (
        <MediaPicker onClose={() => setPicker(null)} onPick={(item) => {
          if (picker === "group") setGm({ ...gm, media: item.id, image: item.url });
          else setPm({ ...pm, images: [...pm.images, { media: item.id, url: item.url, alt: pm.name }] });
          setPicker(null);
        }} />
      )}
      {editor && <RichEditor title="Beschrijving bewerken" initialHtml={pm.description} onSave={async (html) => setPm((p) => ({ ...p, description: html }))} onPlain={async (t) => setPm((p) => ({ ...p, description: `<p>${t.replace(/</g, "&lt;")}</p>` }))} onClose={() => setEditor(false)} />}
    </>
  );
}

"use client";

import { tx } from "../lib/t";

// What a plan or donation gives: a list of rows (type + choice). Used by Admin -> Subscription.
export default function GrantsEditor({ value, onChange, options, disabled }) {
  const rows = value || [];
  // some actions only belong to one profile theme (Dating: date actions, Business: jobs); the ones in use always stay in the list
  const types = (cur) => options.grant_types.filter((g) => !g.themes || g.themes.includes(options.theme) || g.type === cur);
  const spec = (t) => options.grant_types.find((x) => x.type === t);
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = () => {
    const used = new Set(rows.map((r) => r.type));
    const next = types().find((g) => !used.has(g.type) || g.ref) || types()[0];
    onChange([...rows, { type: next.type, ref: "", value: 0 }]);
  };
  return (
    <div className="grants">
      {rows.map((r, i) => {
        const sp = spec(r.type);
        return (
          <div className="grant-row" key={i}>
            <select value={r.type} disabled={disabled} onChange={(e) => set(i, { type: e.target.value, ref: "", value: 0 })}>
              {types(r.type).map((g) => <option key={g.type} value={g.type}>{tx(g.label)}</option>)}
            </select>
            {sp?.ref === "page" && (
              <select value={r.ref} disabled={disabled} onChange={(e) => set(i, { ref: e.target.value })}>
                <option value="">{tx("Kies een pagina…")}</option>
                {options.pages.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}
              </select>
            )}
            {sp?.ref === "product" && (
              <select value={r.ref} disabled={disabled} onChange={(e) => set(i, { ref: e.target.value })}>
                <option value="">{tx("Kies een product…")}</option>
                {options.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {sp?.ref === "text" && <input value={r.ref} disabled={disabled} maxLength={80} placeholder={tx("bv. cursus-1")} onChange={(e) => set(i, { ref: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} />}
            {sp?.value && <input type="number" min={0} value={r.value} disabled={disabled} title={tx("0 = onbeperkt")} placeholder={tx("0 = onbeperkt")} onChange={(e) => set(i, { value: e.target.value })} />}
            {!sp?.ref && !sp?.value && <span className="muted grant-help">{tx(sp?.help || "")}</span>}
            {!disabled && <button type="button" className="btn sm danger" onClick={() => onChange(rows.filter((_, j) => j !== i))}>{tx("Weg")}</button>}
          </div>
        );
      })}
      {!rows.length && <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{tx("Nog geen toegang gekoppeld.")}</p>}
      {!disabled && <div><button type="button" className="btn sm" onClick={add}>{tx("+ Toegang toevoegen")}</button></div>}
    </div>
  );
}

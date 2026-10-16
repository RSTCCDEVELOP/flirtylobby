"use client";

import { tx } from "../lib/t";
import { IconCart, IconCheck } from "./Icons";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useModule } from "./Modules";

const CartContext = createContext({ items: [], count: 0, add: () => {}, setQty: () => {}, remove: () => {}, clear: () => {} });
export const useCart = () => useContext(CartContext);

// The cart lives in the browser (ids + quantities only); prices and stock are always checked on the server
export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  useEffect(() => { try { setItems(JSON.parse(localStorage.getItem("cart")) || []); } catch {} }, []);
  const save = useCallback((next) => { setItems(next); try { localStorage.setItem("cart", JSON.stringify(next)); } catch {} }, []);
  const add = (id, qty = 1) => save(items.some((i) => i.id === id) ? items.map((i) => (i.id === id ? { ...i, qty: Math.min(99, i.qty + qty) } : i)) : [...items, { id, qty }]);
  const setQty = (id, qty) => save(items.map((i) => (i.id === id ? { ...i, qty: Math.max(1, Math.min(99, qty)) } : i)));
  const remove = (id) => save(items.filter((i) => i.id !== id));
  const clear = () => save([]);
  return <CartContext.Provider value={{ items, count: items.reduce((n, i) => n + i.qty, 0), add, setQty, remove, clear }}>{children}</CartContext.Provider>;
}

// Header links of the webshop: only when the modules are on
export function ShopLinks() {
  const { count } = useCart();
  const products = useModule("products");
  const orders = useModule("orders");
  return (
    <>
      {useModule("profiles") && <Link href="/leden" className="shop-link">{tx("Leden")}</Link>}
      {products && <Link href="/producten" className="shop-link">{tx("Producten")}</Link>}
      {orders && (
        <Link href="/winkelwagen" className="shop-link" title={tx("Winkelwagen")}>
          <IconCart /> {tx("Winkelwagen")}{count > 0 && <span className="cart-count">{count}</span>}
        </Link>
      )}
    </>
  );
}

export function AddToCart({ id, disabled }) {
  const { add } = useCart();
  const orders = useModule("orders");
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);
  if (!orders) return null;
  return (
    <div className="add-cart">
      <input type="number" min={1} max={99} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} aria-label={tx("Aantal")} />
      <button className="btn primary" disabled={disabled} onClick={() => { add(id, qty); setDone(true); setTimeout(() => setDone(false), 1800); }}>
        {disabled ? tx("Uitverkocht") : done ? <>{tx("Toegevoegd")} <IconCheck /></> : tx("In winkelwagen")}
      </button>
      {done && <Link href="/winkelwagen" className="btn">{tx("Naar winkelwagen")}</Link>}
    </div>
  );
}

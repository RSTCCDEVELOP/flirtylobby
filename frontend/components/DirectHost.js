"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DirectConnection from "./DirectConnection";

// Keeps the owner's direct connection (WebRTC) alive while he moves around the site.
// The connection lives here, high in the tree; pages and the popup only show it through <DirectSlot />.
const Ctx = createContext(null);
export const useDirectHost = () => useContext(Ctx);

export function DirectHostProvider({ children }) {
  const [session, setSession] = useState(null); // {token, info, mode}
  const [node, setNode] = useState(null);
  const holder = useRef(null); // hidden parking place for the connection's screen while no page shows it

  useEffect(() => {
    const n = document.createElement("div");
    n.className = "direct-host-node";
    holder.current?.appendChild(n);
    setNode(n);
    return () => n.remove();
  }, []);

  const open = useCallback((s) => setSession((cur) => (cur && cur.token === s.token ? { ...cur, ...s } : s)), []);
  const close = useCallback(() => setSession(null), []);

  return (
    <Ctx.Provider value={{ session, open, close, node, holder }}>
      {children}
      <div ref={holder} hidden />
      {node && session && createPortal(<DirectConnection key={session.token} token={session.token} role="owner" info={session.info} onClosed={close} />, node)}
    </Ctx.Provider>
  );
}

// Shows the running connection in this place; when the page goes away the connection moves back to the hidden holder and keeps running.
export function DirectSlot() {
  const h = useDirectHost();
  const ref = useRef(null);
  useEffect(() => {
    const node = h?.node, holder = h?.holder;
    if (!node || !ref.current) return;
    ref.current.appendChild(node);
    return () => { holder?.current?.appendChild(node); };
  }, [h?.node, h?.holder]);
  return <div ref={ref} />;
}

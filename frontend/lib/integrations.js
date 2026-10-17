"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

// Which integrations are switched on (slugs). Cached per page load.
let cache = null;

export function useIntegrations() {
  const [active, setActive] = useState(cache);
  useEffect(() => {
    if (cache) return;
    api("/integrations/").then((d) => { cache = d.active; setActive(d.active); }).catch(() => setActive([]));
  }, []);
  return active; // null while loading
}

export const useIntegration = (slug) => {
  const active = useIntegrations();
  return active ? active.includes(slug) : false;
};

// Usage: <IfIntegration slug="anthropic"><ChatButton /></IfIntegration>  (renders nothing when switched off)
export function IfIntegration({ slug, children, fallback = null }) {
  return useIntegration(slug) ? children : fallback;
}

export const resetIntegrationsCache = () => { cache = null; };

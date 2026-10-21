"use client";

import { useEffect, useRef } from "react";
import { tx } from "../lib/t";
import { deepLink } from "../lib/deeplink";

// Tabs for edit and system screens (pop-ups, admin blocks): icon + name, line under the active tab, house colour.
// tabs: [[key, "Label", <Icon />, badge?]]
export default function Tabs({ tabs, value, onChange, className = "" }) {
  const done = useRef(0);
  const keys = tabs.map((t) => t[0]).join("|");
  const cur = useRef({ value, onChange });
  cur.current = { value, onChange };
  useEffect(() => { // coming from "GO" in the help: this tab was asked for
    const apply = () => {
      const dl = deepLink();
      if (!dl?.tab?.length) return;
      const hit = dl.tab.find((k) => keys.split("|").includes(k));
      if (hit && done.current !== dl.at) { done.current = dl.at; if (hit !== cur.current.value) cur.current.onChange(hit); }
    };
    apply();
    window.addEventListener("deeplink", apply);
    return () => window.removeEventListener("deeplink", apply);
  }, [keys]);
  return (
    <div className={`tabs-pro ${className}`} role="tablist">
      {tabs.map(([k, label, icon, badge]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} className={`tab-pro ${value === k ? "active" : ""}`} onClick={() => onChange(k)}>
          {icon && <span className="tab-ico">{icon}</span>}
          <span>{tx(label)}</span>
          {badge !== undefined && badge !== null && <span className="tab-badge">{badge}</span>}
        </button>
      ))}
    </div>
  );
}

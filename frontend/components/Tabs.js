"use client";

import { tx } from "../lib/t";

// Tabs for edit and system screens (pop-ups, admin blocks): icon + name, line under the active tab, house colour.
// tabs: [[key, "Label", <Icon />, badge?]]
export default function Tabs({ tabs, value, onChange, className = "" }) {
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

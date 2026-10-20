"use client";

import { Busy } from "./PageLoader";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { getLanguage, tx } from "../lib/t";

// "Beschikbaar voor": the label of an item in the language of the visitor
export const availLabel = (lab = {}) => lab[getLanguage()] || lab[(getLanguage() || "").split("-")[0]] || lab.nl || Object.values(lab)[0] || "";

// small chips on a card or a profile page: what this member is available for
export function AvailChips({ items, max = 6, className = "" }) {
  if (!items?.length) return null;
  return (
    <span className={`avail-chips ${className}`}>
      {items.slice(0, max).map((a) => <span key={a.key} className={`avail-chip g-${a.group}`}>{availLabel(a.label)}</span>)}
      {items.length > max && <span className="avail-chip more">+{items.length - max}</span>}
    </span>
  );
}

// the choices per group (games, direct connection, chat, type of date ...) for the profile and the search
export function useAvailability() {
  const [groups, setGroups] = useState(null);
  useEffect(() => { api("/community/availability/").then((d) => setGroups(d.groups || [])).catch(() => setGroups([])); }, []);
  return groups;
}

// pick items: value = list of keys
export function AvailPicker({ value, onChange, groups, compact = false }) {
  if (!groups) return <Busy />;
  if (!groups.length) return <p className="muted" style={{ margin: 0 }}>{tx("Er zijn nog geen keuzes. De beheerder maakt ze bij Admin → Community.")}</p>;
  const toggle = (k) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <div className="avail-groups">
      {groups.map((g) => (
        <div key={g.key} className="avail-group">
          <strong style={{ fontSize: compact ? ".8rem" : ".85rem" }}>{availLabel(g.label)}</strong>
          <div className="avail-pick">
            {g.items.map((i) => <button key={i.key} type="button" className={`avail-chip pick ${value.includes(i.key) ? "on" : ""}`} aria-pressed={value.includes(i.key)} onClick={() => toggle(i.key)}>{availLabel(i.label)}</button>)}
          </div>
        </div>
      ))}
    </div>
  );
}

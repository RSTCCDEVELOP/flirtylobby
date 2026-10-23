// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

// Shortcut tiles on the dashboard: [{href, title}] per user (server: /dashboard/shortcuts/). Shared by every component that shows or changes them.
let items = null;
let loading = false;
const listeners = new Set();
const emit = () => listeners.forEach((f) => f(items));

function load() {
  if (items !== null || loading) return;
  loading = true;
  api("/dashboard/shortcuts/").then((d) => { items = d.items || []; emit(); }).catch(() => { loading = false; });
}

function save(next) {
  items = next;
  emit();
  api("/dashboard/shortcuts/", { method: "PUT", body: { items: next } }).then((d) => { items = d.items; emit(); }).catch(() => {});
}

export function useShortcuts() {
  const [list, setList] = useState(items);
  useEffect(() => {
    listeners.add(setList);
    load();
    setList(items);
    return () => listeners.delete(setList);
  }, []);
  return {
    list: list || [],
    ready: list !== null,
    has: (href) => (list || []).some((x) => x.href === href),
    add: (href, title) => items && !items.some((x) => x.href === href) && save([...items, { href, title }]),
    remove: (href) => items && save(items.filter((x) => x.href !== href)),
    toggle(href, title) { return (list || []).some((x) => x.href === href) ? this.remove(href) : this.add(href, title); },
  };
}

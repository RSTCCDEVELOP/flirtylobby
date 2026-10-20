"use client";

import { useEffect, useRef } from "react";
import { api, getToken } from "../lib/api";
import { useSession } from "./Session";

// Personal settings (open blocks, tiles or list, menu or tiles, light or dark, language, ...) live in the database per user, so they are the same on every computer.
// The browser keeps a copy (localStorage) so nothing flickers; every change is sent to the server a moment later, and after logging in the server's version wins.
const PREFIX = /^(collapse|collapse-pin|navg|navg-pin|view|plg):/;
const NAMES = new Set(["navmode", "sidebar", "lastBackendUrl", "theme", "lang", "editMode", "directSize", "directPos", "directView"]);
const KEEP_AT_LOGOUT = new Set(["theme", "lang"]); // choices of the device itself stay for the next visitor
const synced = (k) => PREFIX.test(k) || NAMES.has(k);

let installed = false, pending = { set: {}, remove: new Set() }, timer = null, orig = null;

function flush() {
  timer = null;
  if (!getToken()) { pending = { set: {}, remove: new Set() }; return; }
  const body = { set: pending.set, remove: [...pending.remove] };
  pending = { set: {}, remove: new Set() };
  if (!Object.keys(body.set).length && !body.remove.length) return;
  api("/dashboard/prefs/", { method: "PUT", body }).catch(() => {});
}
const queue = () => { clearTimeout(timer); timer = setTimeout(flush, 700); };

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const proto = Storage.prototype;
  orig = { set: proto.setItem, remove: proto.removeItem };
  proto.setItem = function (k, v) {
    orig.set.call(this, k, v);
    if (this === window.localStorage && synced(String(k)) && getToken()) { pending.set[k] = String(v); pending.remove.delete(k); queue(); }
  };
  proto.removeItem = function (k) {
    orig.remove.call(this, k);
    if (this === window.localStorage && synced(String(k)) && getToken()) { pending.remove.add(k); delete pending.set[k]; queue(); }
  };
}

export default function PrefsSync() {
  const { user } = useSession();
  const was = useRef(null);
  useEffect(() => { install(); }, []);
  useEffect(() => {
    if (!user) {
      if (was.current) { // logged out: the settings of this person leave the browser (not the choices of the device)
        try { Object.keys(localStorage).filter((k) => synced(k) && !KEEP_AT_LOGOUT.has(k)).forEach((k) => orig.remove.call(localStorage, k)); } catch {}
      }
      was.current = null;
      return;
    }
    was.current = user.id;
    api("/dashboard/prefs/").then((d) => {
      const server = d.prefs || {};
      let changed = false;
      for (const [k, v] of Object.entries(server)) {
        try { if (localStorage.getItem(k) !== v) { orig.set.call(localStorage, k, v); changed = true; } } catch {}
      }
      // first time on this account: what this browser already has goes to the server
      const seed = {};
      try { Object.keys(localStorage).filter((k) => synced(k) && !(k in server)).forEach((k) => { seed[k] = localStorage.getItem(k); }); } catch {}
      if (Object.keys(seed).length) api("/dashboard/prefs/", { method: "PUT", body: { set: seed, remove: [] } }).catch(() => {});
      if (changed) {  // the screen was drawn with the old values: once more with the settings of this person
        try {
          const last = Number(sessionStorage.getItem("prefs-reload") || 0);
          if (Date.now() - last > 20000) { sessionStorage.setItem("prefs-reload", String(Date.now())); window.location.reload(); }
        } catch {}
      }
    }).catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

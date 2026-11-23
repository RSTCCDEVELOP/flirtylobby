// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { AddressPopup } from "./AddressFinder";

// The Zoeken button behind a postcode field (for every logged-in person): looks up `query` (a postcode, with a house number when there is one), shows the results in a pop-up
// and gives the chosen address to onPick({street, house_number, postal_code, city, country}).
export default function PostcodeSearch({ query, onPick }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [note, setNote] = useState("");
  const q = String(query || "").trim();
  const run = async () => {
    if (q.replace(/\s/g, "").length < 6 || busy) return;
    setBusy(true); setNote(""); setRes(null);
    try {
      const r = await api("/address/lookup/", { method: "POST", body: { q } });
      if (!(r.results || []).length) setNote(tx("Niets gevonden. Controleer de postcode en het huisnummer."));
      else setRes(r.results);
    } catch (e) { setNote(errorText(e)); }
    setBusy(false);
  };
  return (
    <>
      <button type="button" className="btn" disabled={busy || q.replace(/\s/g, "").length < 6} onClick={run} title={tx("Postcode opzoeken")} style={{ flex: "none" }}>{busy ? tx("Bezig…") : tx("Zoeken")}</button>
      {note && <small className="muted" style={{ flexBasis: "100%" }}>{note}</small>}
      {res && <AddressPopup results={res} onPick={(r) => { setRes(null); onPick(r); }} onClose={() => setRes(null)} />}
    </>
  );
}

// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import AiCreditPopup from "./AiCreditPopup";

// The red message of a screen. When it says that the AI credit is missing or used up, a button "Tegoed opwaarderen" opens the offer to buy credit (the popup with the slider) right there.
const NO_CREDIT = /AI-tegoed|AI credit|AI-credit/i;
export default function AiCreditAlert({ text, style }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [gone, setGone] = useState("");   // the message that no longer applies because credit was bought
  const buy = !!text && NO_CREDIT.test(String(text));
  useEffect(() => {   // credit bought (here, in a payment tab or by a superadmin): the red message goes away by itself
    if (!buy) return undefined;
    let stop = false;
    const check = async () => {
      try {
        const i = await api("/ai/me/");
        if (!stop) setGone(i && (i.balance > 0 || i.credit_required === false || i.exempt) ? String(text) : "");
      } catch { /* the message stays */ }
    };
    check();
    const t = setInterval(check, 8000);
    window.addEventListener("ai-credit-changed", check);
    window.addEventListener("focus", check);
    return () => { stop = true; clearInterval(t); window.removeEventListener("ai-credit-changed", check); window.removeEventListener("focus", check); };
  }, [buy, text]);
  if (!text || gone === String(text)) return null;
  const open = async () => { setErr(""); try { const i = await api("/ai/me/"); if (i?.proposal) setInfo(i); else setErr(tx("Opwaarderen is nu niet mogelijk.")); } catch (e) { setErr(errorText(e)); } };
  return (
    <div className="alert" role="alert" style={style}>
      <div>{text}</div>
      {buy && <div className="row" style={{ marginTop: ".5rem", justifyContent: "flex-start" }}><button type="button" className="btn sm primary" onClick={open}>{tx("Tegoed opwaarderen")}</button></div>}
      {err && <small style={{ display: "block", marginTop: ".3rem" }}>{err}</small>}
      {info && <AiCreditPopup info={info} onClose={() => setInfo(null)} />}
    </div>
  );
}

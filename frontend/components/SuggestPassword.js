// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { generatePassword } from "../lib/password";
import { tx } from "../lib/t";

// The button "suggest a strong password" for every screen where a password is made. onPick(password) fills the password field(s) (and the repeat field); the screens show the password then.
// The password is shown next to the button so the person can see and copy it.
export default function SuggestPassword({ onPick, className = "btn sm" }) {
  const [last, setLast] = useState("");
  const [copied, setCopied] = useState(false);
  const pick = () => { const p = generatePassword(); setLast(p); setCopied(false); onPick(p); };
  const copy = async () => { try { await navigator.clipboard.writeText(last); setCopied(true); } catch { /* no clipboard: the password is shown */ } };
  return (
    <div className="sugpw">
      <button type="button" className={className} onClick={pick}>{tx("Veilig wachtwoord voorstellen")}</button>
      {last && <><code className="sugpw-code">{last}</code><button type="button" className="btn sm" onClick={copy}>{copied ? tx("Gekopieerd") : tx("Kopiëren")}</button></>}
    </div>
  );
}

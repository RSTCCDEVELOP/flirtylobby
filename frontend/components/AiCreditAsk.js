// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import AiCreditPopup from "./AiCreditPopup";

// Someone without AI credit asks for something that uses the AI: nothing is started (the server said so); here the offer to buy credit comes first (a slider and the payment).
export default function AiCreditAsk() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    const on = async () => { try { setInfo(await api("/ai/me/")); } catch { /* no offer possible: the message of the screen stays */ } };
    window.addEventListener("ai-credit-needed", on);
    return () => window.removeEventListener("ai-credit-needed", on);
  }, []);
  return info?.proposal ? <AiCreditPopup info={info} onClose={() => setInfo(null)} /> : null;
}

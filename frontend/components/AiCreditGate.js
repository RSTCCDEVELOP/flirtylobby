// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";
import { useModules } from "./Modules";
import AiCreditPopup from "./AiCreditPopup";

// In the dashboard: someone who has to buy AI credit and whose credit is (almost) gone gets the offer once per visit (a popup with a slider).
export default function AiCreditGate() {
  const { user } = useAuth();
  const mods = useModules();
  const [info, setInfo] = useState(null);
  useEffect(() => {
    if (!user || user.is_staff || mods.ai === false) return;
    try { if (sessionStorage.getItem("ai-credit-seen")) return; } catch {}
    api("/ai/me/").then((i) => { if (i.credit_required && i.low && !i.welcome) { setInfo(i); try { sessionStorage.setItem("ai-credit-seen", "1"); } catch {} } }).catch(() => {});
  }, [user, mods.ai]);
  return info ? <AiCreditPopup info={info} onClose={() => setInfo(null)} /> : null;
}

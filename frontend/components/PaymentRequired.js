// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { confirmDialog } from "../lib/dialog";
import { useModule } from "./Modules";

// When the server says a subscription is needed (chat, video, likes…): offer to look at the subscriptions.
export default function PaymentRequired() {
  const subsOn = useModule("subscriptions");
  const donOn = useModule("donations");
  const on = subsOn || donOn;
  const router = useRouter();
  useEffect(() => {
    if (!on) return;
    let busy = false;
    const h = async (e) => {
      if (busy) return;
      busy = true;
      if (await confirmDialog(`${tx(e.detail || "Hiervoor heb je een abonnement nodig.")}\n\n${tx("Wil je de abonnementen bekijken?")}`)) router.push("/abonnementen");
      busy = false;
    };
    window.addEventListener("payment-required", h);
    return () => window.removeEventListener("payment-required", h);
  }, [on, router]);
  return null;
}

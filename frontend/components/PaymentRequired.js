"use client";

import { tx } from "../lib/t";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { confirmDialog } from "../lib/dialog";
import { useModule } from "./Modules";

// When the server says a subscription is needed (chat, video, likes…): offer to look at the subscriptions.
export default function PaymentRequired() {
  const on = useModule("subscriptions");
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

"use client";

import { tx } from "../../../../lib/t";
import { ChatPanel, useChat } from "../../../../components/Chat";

// Chat in the screen itself (the popup is hidden on this page)
export default function ChatPage() {
  const { cfg } = useChat();
  return (
    <>
      <h1>{tx("Chat")}</h1>
      <p className="muted">
        {cfg ? (cfg.method === "portal" ? tx("Je berichten gaan via de portal en blijven bewaard.") : tx("Directe verbinding tussen jullie apparaten (WebRTC). De ander moet online zijn; berichten worden niet bewaard."))
          : tx("De chat is niet beschikbaar.")}
      </p>
      {cfg && cfg.display !== "popup" ? <div style={{ height: tx("min(70vh, 640px)") }}><ChatPanel /></div> : cfg && <p className="muted">{tx("De chat staat ingesteld als popup rechtsonder.")}</p>}
    </>
  );
}

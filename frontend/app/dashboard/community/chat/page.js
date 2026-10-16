"use client";

import { ChatPanel, useChat } from "../../../../components/Chat";

// Chat in the screen itself (the popup is hidden on this page)
export default function ChatPage() {
  const { cfg } = useChat();
  return (
    <>
      <h1>Chat</h1>
      <p className="muted">
        {cfg ? (cfg.method === "portal" ? "Je berichten gaan via de portal en blijven bewaard." : "Directe verbinding tussen jullie apparaten (WebRTC). De ander moet online zijn; berichten worden niet bewaard.")
          : "De chat is niet beschikbaar."}
      </p>
      {cfg && cfg.display !== "popup" ? <div style={{ height: "min(70vh, 640px)" }}><ChatPanel /></div> : cfg && <p className="muted">De chat staat ingesteld als popup rechtsonder.</p>}
    </>
  );
}

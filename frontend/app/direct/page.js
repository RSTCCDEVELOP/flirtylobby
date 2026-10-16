"use client";

import { tx } from "../../lib/t";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "../../components/BrandingContext";
import { IconImage, IconSliders } from "../../components/Icons";
import QrScanner from "../../components/QrScanner";
import Tabs from "../../components/Tabs";
import ThemeToggle from "../../components/ThemeToggle";
import { api, errorText } from "../../lib/api";

// What a QR code / pasted text can hold: the full invitation link, the bare token, or the short code
export function parseInvite(text) {
  const t = String(text || "").trim();
  const m = t.match(/\/direct\/([A-Za-z0-9_-]{16,})/);
  if (m) return { token: m[1] };
  if (/^[A-Za-z0-9_-]{20,}$/.test(t)) return { token: t };
  const code = t.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return code.length === 6 ? { code } : null;
}

// (Re)connect without a link: type the short code or scan the QR code of the invitation
export default function DirectHub() {
  const router = useRouter();
  const [tab, setTab] = useState("code");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(found) {
    setError(""); setBusy(true);
    try {
      if (found?.token) return router.push(`/direct/${found.token}`);
      if (found?.code) { const r = await api("/direct/code/", { method: "POST", body: { code: found.code } }); return router.push(`/direct/${r.token}`); }
      setError(tx("Dit is geen uitnodiging of code."));
    } catch (e) { setError(errorText(e)); }
    setBusy(false);
  }

  return (
    <main className="login-page" style={{ alignItems: "flex-start", paddingTop: "2rem" }}>
      <div className="login-theme"><ThemeToggle /></div>
      <div className="card login-card" style={{ maxWidth: 520, width: "100%" }}>
        <Logo />
        <h1>{tx("Verbind opnieuw")}</h1>
        <p className="muted" style={{ margin: 0, textAlign: "center" }}>{tx("Voer de code in die je van de ander krijgt, of scan de QR-code. Een link is niet nodig.")}</p>
        <Tabs value={tab} onChange={(k) => { setTab(k); setError(""); }} tabs={[["code", "Code invoeren", <IconSliders key="c" />], ["scan", "QR scannen", <IconImage key="s" />]]} />
        {error && <div className="alert">{error}</div>}
        {tab === "code" && (
          <form className="form" onSubmit={(e) => { e.preventDefault(); go(parseInvite(code)); }}>
            <label>{tx("Code")}
              <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={14} autoFocus autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="K7M3QX" inputMode="text" />
            </label>
            <button className="btn primary" disabled={busy || !code.trim()}>{busy ? tx("Bezig…") : tx("Verbinden")}</button>
          </form>
        )}
        {tab === "scan" && <QrScanner onResult={(t) => go(parseInvite(t))} />}
        <Link href="/" className="muted center">{tx("← Naar de website")}</Link>
      </div>
    </main>
  );
}

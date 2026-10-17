"use client";

import { tx } from "../lib/t";
import { useState } from "react";
import { IconChat, IconPaperclip, IconVideo } from "./Icons";
import Tabs from "./Tabs";

export const POPUP_STYLES = [
  ["clean", "Strak", "Rustig venster met een lijn onder het actieve tabblad."],
  ["header", "Kopbalk", "Kleurige kopbalk bovenaan, tabbladen als gelijke segmenten."],
  ["glass", "Glas", "Doorzichtig, sterk afgerond, tabbladen als pillen."],
  ["minimal", "Minimaal", "Zonder kader en schaduw, tabbladen alleen als tekst."],
  ["bold", "Gedurfd", "Dikke rand met schaduw, tabbladen als mappen."],
];

// Five example windows with tabs: pick the look of all system pop-ups, windows and tabs.
function Sample({ id }) {
  const [tab, setTab] = useState("chat");
  const tabs = [["chat", "Chat", <IconChat key="c" />], ["video", "Videochat", <IconVideo key="v" />], ["files", "Bestanden", <IconPaperclip key="f" />]];
  return (
    <div className={`pw pw-${id}`}>
      <div className="pw-title">{tx("Voorbeeldvenster")}</div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <div className="pw-body">
        <span className="pw-line" style={{ width: "80%" }} /><span className="pw-line" style={{ width: "60%" }} /><span className="pw-line" style={{ width: "70%" }} />
      </div>
      <div className="pw-foot"><span className="btn sm">{tx("Annuleren")}</span><span className="btn sm primary">{tx("Opslaan")}</span></div>
    </div>
  );
}

export default function PopupStyleGallery({ value, onChange }) {
  return (
    <div className="pw-grid">
      {POPUP_STYLES.map(([id, name, hint]) => (
        <div key={id} className={`pw-card ${value === id ? "active" : ""}`}>
          <Sample id={id} />
          <div className="pw-meta">
            <strong>{tx(name)} {value === id && <span className="badge ok">{tx("Actief")}</span>}</strong>
            <small className="muted">{tx(hint)}</small>
            <button type="button" className={`btn sm ${value === id ? "" : "primary"}`} disabled={value === id} onClick={() => onChange(id)}>{value === id ? tx("In gebruik") : tx("Gebruik dit uiterlijk")}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

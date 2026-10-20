"use client";

import { useState } from "react";
import { useAuth } from "./AuthContext";
import { IconImage } from "./Icons";
import MediaPicker from "./MediaPicker";
import { useModule } from "./Modules";
import { lvl } from "../lib/perms";
import { mediaToFile } from "../lib/mediafile";
import { tx } from "../lib/t";

// The same small button everywhere a picture or video goes into the system: "Media" opens the media window, where you drop or choose a file
// to upload, or pick one that is already in the library. onFiles(files) does the work (a File from the computer and a library item arrive the same way);
// it may return an error text.
export default function MediaField({ onFiles, kind = "image", disabled = false, busy: busyProp = false, label }) {
  const { user } = useAuth();
  const mediaOn = useModule("media");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const library = mediaOn && lvl(user, "media") >= 1;

  async function run(getFiles) {
    setOpen(false); setBusy(true); setError("");
    try { const err = await onFiles(await getFiles()); if (err) setError(err); } catch (e) { setError(e.message || tx("Uploaden mislukt.")); }
    setBusy(false);
  }

  return (
    <span className="media-field">
      <button type="button" className="btn sm" disabled={disabled || busy || busyProp} onClick={() => setOpen(true)}><IconImage /> {busy || busyProp ? tx("Bezig…") : (label || tx("Media"))}</button>
      {error && <small style={{ color: "var(--danger, #d92d20)" }}>{error}</small>}
      {open && <MediaPicker kind={kind === "video" ? "video" : "image"} library={library} onClose={() => setOpen(false)} onFiles={(files) => run(async () => files)} onPick={(item) => run(async () => [await mediaToFile(item)])} />}
    </span>
  );
}

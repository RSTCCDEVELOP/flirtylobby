// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { dragFixed, movedFor, subscribeMoved } from "../lib/moved";
import { tx } from "../lib/t";
import { useSession } from "./Session";
import { useIsGone } from "./EditMode";

// A fixed element of a page (logo, title, intro text) with a drag handle at its top left in edit mode: drag it into a block or a hero.
// Once it sits in a block it is hidden here (and shown there); removing it from the block brings it back.
export const GripContext = createContext(null); // a picture draws the handle itself, on the corner of its dashed frame

export default function Movable({ page, id, type, children }) {
  const { editing } = useSession();
  const gone = useIsGone(id);
  const [, tick] = useState(0);
  useEffect(() => subscribeMoved(() => tick((n) => n + 1)), []);
  const set = movedFor(page);
  if (gone || (set && set.has(id))) return null; // removed with the trash icon, or moved into a block
  if (!editing) return children;
  const grip = (
    <span className="movable-grip" draggable title={tx("Sleep dit onderdeel naar een blok of een hero")}
      onDragStart={(e) => { dragFixed({ id, type, page }); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); const box = e.currentTarget.closest(".movable, .img-edit"); if (box) e.dataTransfer.setDragImage(box, 16, 16); document.documentElement.classList.add("fixed-dragging"); }}
      onDragEnd={() => { dragFixed(null); document.documentElement.classList.remove("fixed-dragging"); }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.7" /><circle cx="15" cy="6" r="1.7" /><circle cx="9" cy="12" r="1.7" /><circle cx="15" cy="12" r="1.7" /><circle cx="9" cy="18" r="1.7" /><circle cx="15" cy="18" r="1.7" /></svg>
    </span>
  );
  if (type === "image") return <GripContext.Provider value={grip}>{children}</GripContext.Provider>;
  return (
    <div className="movable">
      {grip}
      {children}
    </div>
  );
}

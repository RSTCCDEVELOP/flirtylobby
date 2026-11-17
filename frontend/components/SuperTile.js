// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import PlusLock from "./PlusLock";
import { tx } from "../lib/t";

// One tile of Super admin: an icon at the top left, the lock (superadmin+) at the top right, always at the same height; the text; and the button at the bottom, on one line for every tile.
// href: the whole top of the tile is a link and the button opens it. footer: own buttons instead (tiles that do something themselves).
export default function SuperTile({ href, onClick, icon: Icon, label, title, text, lock = false, footer, children }) {
  const head = (
    <>
      <span className="st-top">
        <span className="st-ico">{Icon && <Icon />}</span>
        {lock && <PlusLock />}
      </span>
      <span className="st-label">{label}</span>
      <strong className="st-title">{title}</strong>
      {text && <small className="st-text">{text}</small>}
    </>
  );
  return (
    <div className={`st-tile${lock ? " locked" : ""}`}>
      {href ? <Link href={href} onClick={onClick} className="st-main">{head}</Link> : <div className="st-main">{head}</div>}
      {children}
      <div className="st-foot">
        {footer || <Link href={href} onClick={onClick} className="btn sm primary">{tx("Open")}</Link>}
      </div>
    </div>
  );
}

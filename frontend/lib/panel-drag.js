// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Dragging a part from the editor panel (at the left) to the page: what is dragged is kept here, the page reads it when it is dropped.
// payload: {kind: "basic", type, widget} | {kind: "component", comp} | {kind: "object", slug} | {kind: "media", media}
const state = { cur: null };
export const panelDrag = () => state.cur;
export const setPanelDrag = (v) => {
  state.cur = v || null;
  if (typeof document !== "undefined") document.documentElement.classList.toggle("pb-panel-dragging", !!v);  // the page shows where it can be dropped
};
// props for a tile in the panel: draggable, and a click still adds it
export const dragProps = (payload) => ({
  draggable: true,
  onDragStart: (e) => { try { e.dataTransfer.setData("text/plain", "easy2edit-panel"); e.dataTransfer.effectAllowed = "copy"; } catch {} setPanelDrag(payload); },
  onDragEnd: () => setPanelDrag(null),
});

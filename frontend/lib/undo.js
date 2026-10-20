// Undo for edit mode: the last 10 actions (layout changes, texts, picture settings). Each entry knows how to put things back.
const MAX = 10;
let stack = [];
const subs = new Set();
const emit = () => subs.forEach((f) => f());
export const undoCount = () => stack.length;
export const subscribeUndo = (f) => { subs.add(f); return () => subs.delete(f); };
export const lastUndoLabel = () => stack[stack.length - 1]?.label || "";
// key: changes with the same key within `merge` ms count as one action (typing, sliders)
export function pushUndo(label, undo, { key = "", merge = 0 } = {}) {
  const last = stack[stack.length - 1];
  if (merge && last && last.key === key && Date.now() - last.t < merge) { last.t = Date.now(); return; }
  stack.push({ label, undo, key, t: Date.now() });
  if (stack.length > MAX) stack.shift();
  emit();
}
export async function runUndo() {
  const e = stack.pop();
  emit();
  if (e) await e.undo();
}

// Fixed elements of a page (logo, title, intro) that were dragged into a block: shared between the page and its blocks.
const state = { pages: {}, fixed: null }; // pages[pageKey] = Set of content keys (undefined until the layout is known); fixed = the element that is being dragged
const subs = new Set();
export const movedFor = (page) => state.pages[page];
export const setMoved = (page, keys) => { state.pages[page] = new Set(keys || []); subs.forEach((f) => f()); };
export const subscribeMoved = (f) => { subs.add(f); return () => subs.delete(f); };
export const dragFixed = (v) => { if (v !== undefined) state.fixed = v; return state.fixed; };

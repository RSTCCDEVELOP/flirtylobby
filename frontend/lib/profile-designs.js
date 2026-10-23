// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Colour themes for a member's profile page. Each sets the accent colours (--blue, --orange) and a gradient (--pt-grad) of the page.
// "key" matches PROFILE_DESIGNS in backend/apps/social/themes.py; the CSS for [data-pt="key"] is in app/globals.css.
export const DESIGNS = [
  { key: "", label: "Standaard", group: "Gebruikelijk", colors: ["#3b82f6", "#f97316"] },
  { key: "ocean", label: "Oceaan", group: "Gebruikelijk", colors: ["#0ea5e9", "#0369a1"] },
  { key: "forest", label: "Bos", group: "Gebruikelijk", colors: ["#16a34a", "#166534"] },
  { key: "sunset", label: "Zonsondergang", group: "Gebruikelijk", colors: ["#f97316", "#dc2626"] },
  { key: "midnight", label: "Middernacht", group: "Gebruikelijk", colors: ["#6366f1", "#1e1b4b"] },
  { key: "lavender", label: "Lavendel", group: "Gebruikelijk", colors: ["#a78bfa", "#7c3aed"] },
  { key: "mono", label: "Zwart-wit", group: "Gebruikelijk", colors: ["#374151", "#9ca3af"] },
  { key: "rose", label: "Rose", group: "Kleuren van trots", colors: ["#ec4899", "#f9a8d4"] },
  { key: "rainbow", label: "Regenboog", group: "Kleuren van trots", colors: ["#e40303", "#ff8c00", "#ffed00", "#008026", "#004dff", "#750787"] },
  { key: "trans", label: "Trans", group: "Kleuren van trots", colors: ["#5bcefa", "#f5a9b8", "#ffffff", "#f5a9b8", "#5bcefa"] },
  { key: "bi", label: "Bi", group: "Kleuren van trots", colors: ["#d60270", "#9b4f96", "#0038a8"] },
  { key: "lesbian", label: "Lesbisch", group: "Kleuren van trots", colors: ["#d52d00", "#ff9a56", "#ffffff", "#d362a4", "#a30262"] },
  { key: "nonbinary", label: "Non-binair", group: "Kleuren van trots", colors: ["#fcf434", "#ffffff", "#9c59d1", "#2c2c2c"] },
];
export const gradient = (colors) => `linear-gradient(90deg, ${colors.map((c, i) => `${c} ${Math.round((i / colors.length) * 100)}% ${Math.round(((i + 1) / colors.length) * 100)}%`).join(", ")})`;

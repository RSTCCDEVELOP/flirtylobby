// Small flag images (inline SVG, 3:2) for the language switch. Flags keep their own colours.
const star = (cx, cy, r, rot = -90) => Array.from({ length: 10 }, (_, i) => { const a = ((rot + i * 36) * Math.PI) / 180, rr = i % 2 ? r * 0.4 : r; return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`; }).join(" ");

const FLAGS = {
  nl: <><rect width="30" height="20" fill="#fff" /><rect width="30" height="6.67" fill="#AE1C28" /><rect y="13.33" width="30" height="6.67" fill="#21468B" /></>,
  en: <><rect width="30" height="20" fill="#012169" /><path d="M0 0l30 20M30 0L0 20" stroke="#fff" strokeWidth="4" /><path d="M0 0l30 20M30 0L0 20" stroke="#C8102E" strokeWidth="1.6" /><path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6.5" /><path d="M15 0v20M0 10h30" stroke="#C8102E" strokeWidth="3.6" /></>,
  zh: <><rect width="30" height="20" fill="#DE2910" /><polygon points={star(5, 5, 3)} fill="#FFDE00" /><polygon points={star(10, 2.2, 1, -70)} fill="#FFDE00" /><polygon points={star(12, 4.4, 1, -50)} fill="#FFDE00" /><polygon points={star(12, 7.4, 1, -20)} fill="#FFDE00" /><polygon points={star(10, 9.6, 1, 0)} fill="#FFDE00" /></>,
  ar: <><rect width="30" height="20" fill="#006C35" /><rect x="7" y="6" width="16" height="2.2" rx="1" fill="#fff" /><rect x="9" y="9.6" width="12" height="1.4" rx=".7" fill="#fff" /><rect x="8" y="14" width="14" height="1.2" rx=".6" fill="#fff" /></>,
  pt: <><rect width="30" height="20" fill="#FF0000" /><rect width="12" height="20" fill="#006600" /><circle cx="12" cy="10" r="4" fill="#FFCC00" /><circle cx="12" cy="10" r="2.4" fill="#fff" /><circle cx="12" cy="10" r="1.3" fill="#FF0000" /></>,
  es: <><rect width="30" height="20" fill="#AA151B" /><rect y="5" width="30" height="10" fill="#F1BF00" /></>,
  de: <><rect width="30" height="20" fill="#FFCE00" /><rect width="30" height="6.67" fill="#000" /><rect y="6.67" width="30" height="6.67" fill="#DD0000" /></>,
  fr: <><rect width="30" height="20" fill="#fff" /><rect width="10" height="20" fill="#0055A4" /><rect x="20" width="10" height="20" fill="#EF4135" /></>,
};

export default function Flag({ code, width = 24, title }) {
  const f = FLAGS[code];
  if (!f) return <span className="flag-fallback">{code.toUpperCase()}</span>;
  return (
    <svg className="flag" width={width} height={(width * 2) / 3} viewBox="0 0 30 20" role="img" aria-label={title || code} preserveAspectRatio="none">
      <title>{title || code}</title>
      <clipPath id={`fc-${code}`}><rect width="30" height="20" rx="2.5" /></clipPath>
      <g clipPath={`url(#fc-${code})`}>{f}</g>
      <rect width="30" height="20" rx="2.5" fill="none" stroke="rgba(128,128,128,.55)" strokeWidth=".8" />
    </svg>
  );
}

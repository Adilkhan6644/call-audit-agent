// Small inline-SVG icon set — outline style, stroke=currentColor so buttons can tint them.
// Avoids pulling in an icon library for ~20 glyphs.
const PATHS = {
  logo: 'M12 2l3 3-3 3-3-3 3-3zm0 10l3 3-3 3-3-3 3-3zM2 12l3-3 3 3-3 3-3-3zm16 0l3-3 3 3-3 3-3-3z',
  grid: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z',
  folder: 'M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6z',
  mic: 'M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3zm6-3a6 6 0 01-12 0M12 21v-3',
  play: 'M8 5l12 7-12 7V5z',
  chart: 'M4 20V10m6 10V4m6 16v-7m6 7V8',
  shield: 'M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zm11 2l-4.35-4.35',
  bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0',
  chevronDown: 'M6 9l6 6 6-6',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9',
  layers: 'M12 3l9 5-9 5-9-5 9-5zm-9 9l9 5 9-5m-18 5l9 5 9-5',
  zoomIn: 'M11 19a8 8 0 100-16 8 8 0 000 16zm11 2l-4.35-4.35M11 8v6M8 11h6',
  zoomOut: 'M11 19a8 8 0 100-16 8 8 0 000 16zm11 2l-4.35-4.35M8 11h6',
  filter: 'M4 5h16M7 12h10M10 19h4',
  sort: 'M7 4v16m0 0l-3-3m3 3l3-3m7-13v16m0-16l-3 3m3-3l3 3',
  export: 'M12 3v12m0-12l-4 4m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2',
  check: 'M5 13l4 4L19 7',
  alertCircle: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 6v5m0 4h.01',
  arrowRight: 'M5 12h14m0 0l-6-6m6 6l-6 6',
  sparkle: 'M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z',
  clock: 'M12 7v5l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
}

export default function Icon({ name, size = 18, strokeWidth = 1.8, style, ...rest }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      {...rest}
    >
      <path d={d} />
    </svg>
  )
}

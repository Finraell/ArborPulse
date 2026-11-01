import type { Analysis } from "@/lib/arbor/types";

export function SignalChart({ analysis, spectral = false }: { analysis: Analysis | null; spectral?: boolean }) {
  const width = 700, height = 158, pad = 24;
  const rows = analysis ? spectral ? analysis.spectrum.map(s => ({ x: s.hz, y: s.power })) : analysis.samples.map(s => ({ x: s.t, y: s.x })) : [];
  const maxX = Math.max(1, ...rows.map(s => s.x)), maxY = Math.max(spectral ? .01 : 1, ...rows.map(s => Math.abs(s.y)));
  const py = (y: number) => spectral ? height - pad - y / maxY * (height - pad * 2) : height / 2 - y / maxY * (height / 2 - pad);
  const path = rows.map((s, i) => `${i ? "L" : "M"}${(pad + s.x / maxX * (width - pad * 2)).toFixed(2)},${py(s.y).toFixed(2)}`).join(" ");
  return <div className="signal-chart"><svg role="img" aria-label={spectral ? "Power spectrum of measured motion" : "Measured camera-corrected horizontal displacement over time"} viewBox={`0 0 ${width} ${height}`}>
    {[.2, .5, .8].map(p => <line key={p} x1={pad} x2={width - pad} y1={height * p} y2={height * p} stroke="#e4e9e2" strokeDasharray="3 5"/>)}
    {[0, .25, .5, .75, 1].map(p => <g key={p}><line x1={pad + p * (width - pad * 2)} x2={pad + p * (width - pad * 2)} y1={12} y2={height - 20} stroke="#edf0ea"/><text x={pad + p * (width - pad * 2)} y={height - 1} textAnchor="middle" fill="#839087" fontSize="10">{analysis ? (p * maxX).toFixed(spectral ? 1 : 0) : p * 20}{spectral ? " Hz" : "s"}</text></g>)}
    {rows.length ? <><path d={`${path} L${width - pad},${py(0)} L${pad},${py(0)} Z`} fill="#dbe9dd" opacity=".55"/><path d={path} stroke="#3b7150" strokeWidth="2" strokeLinejoin="round" fill="none"/></> : <><path d={`M${pad},79 L${width - pad},79`} fill="none" stroke="#b4c5b7" strokeWidth="1.5" strokeDasharray="5 5"/><text x={width / 2} y={59} textAnchor="middle" fill="#8b958c" fontSize="12">Run a scan to see measured motion</text></>}
  </svg></div>;
}

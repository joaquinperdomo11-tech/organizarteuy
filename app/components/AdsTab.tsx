"use client";
import { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { useAds, type AdRow } from "./AdsContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, LineChart, Line, CartesianGrid, ReferenceLine,
} from "recharts";


function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtN(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}

function acosColor(acos: number) {
  if (acos === 0) return "#555577";
  if (acos < 10) return "#44DDAA";
  if (acos < 20) return "#FFE500";
  if (acos < 35) return "#FF6B35";
  return "#FF4466";
}

function estadoBadge(estado: string) {
  const map: Record<string, string> = {
    "Activo": "bg-green-500/15 text-green-400 border-green-500/20",
    "Pausado": "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    "Deshabilitado": "bg-red-500/15 text-red-400 border-red-500/20",
    "Movido": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  };
  return map[estado] || "bg-brand-dark text-brand-sub border-brand-border";
}

function parseXlsx(file: File): Promise<AdRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets["Reporte por Anuncios"];
        if (!ws) { reject(new Error("No se encontró la hoja 'Reporte por Anuncios'")); return; }
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        const dataRows = rows.slice(2).filter(r => r[3]); // skip 2 header rows, filter empty

        const ads: AdRow[] = dataRows.map(r => ({
          desde: String(r[0] || ""),
          hasta: String(r[1] || ""),
          campana: String(r[2] || ""),
          titulo: String(r[3] || ""),
          itemId: String(r[4] || ""),
          estado: String(r[5] || ""),
          impresiones: Number(r[6]) || 0,
          clics: Number(r[7]) || 0,
          cpc: typeof r[8] === "number" ? r[8] : 0,
          ctr: typeof r[9] === "number" ? r[9] : 0,
          cvr: typeof r[10] === "number" ? r[10] : 0,
          ingresos: Number(r[11]) || 0,
          inversion: Number(r[12]) || 0,
          acos: typeof r[13] === "number" ? r[13] : 0,
          roas: typeof r[14] === "number" ? r[14] : 0,
          ventasDirectas: Number(r[15]) || 0,
          ventasIndirectas: Number(r[16]) || 0,
          ventasPublicidad: Number(r[17]) || 0,
          ingresosDirectos: Number(r[18]) || 0,
          ingresosIndirectos: Number(r[19]) || 0,
        }));
        resolve(ads);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── Uploader ────────────────────────────────────────────────────
function AdsUploader({ onData }: { onData: (ads: AdRow[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const ads = await parseXlsx(file);
      onData(ads);
    } catch (e: any) {
      setError(e.message || "Error al leer el archivo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-12 flex flex-col items-center justify-center text-center">
      <div className="text-4xl mb-4">📊</div>
      <h3 className="font-display font-semibold text-brand-text text-xl mb-2">Cargar reporte de publicidad</h3>
      <p className="text-brand-sub text-sm mb-2 max-w-md">
        Descargá el reporte desde <span className="text-brand-yellow font-mono">ML → Publicidad → Descargar reporte</span> y subilo acá.
      </p>
      <p className="text-brand-muted text-xs font-mono mb-8">Formato: .xlsx · El archivo no sale de tu navegador</p>

      <div
        className={`w-full max-w-sm border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer ${dragging ? "border-brand-yellow bg-brand-yellow/5" : "border-brand-border hover:border-brand-yellow/50"}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {loading ? (
          <p className="text-brand-yellow font-mono text-sm animate-pulse">Procesando...</p>
        ) : (
          <p className="text-brand-sub font-mono text-sm">Arrastrá el .xlsx acá o hacé click</p>
        )}
      </div>

      {error && <p className="text-red-400 font-mono text-xs mt-4">⚠ {error}</p>}
    </div>
  );
}

// ── Main Report ─────────────────────────────────────────────────
function AdsReport({ ads }: { ads: AdRow[] }) {
  const [sortBy, setSortBy] = useState<"ingresos" | "inversion" | "acos" | "impresiones" | "clics">("ingresos");
  const [filterEstado, setFilterEstado] = useState<string>("Todos");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"tabla" | "burbujas">("tabla");

  // Totals
  const totals = useMemo(() => ({
    inversion: ads.reduce((s, a) => s + a.inversion, 0),
    ingresos: ads.reduce((s, a) => s + a.ingresos, 0),
    impresiones: ads.reduce((s, a) => s + a.impresiones, 0),
    clics: ads.reduce((s, a) => s + a.clics, 0),
    ventas: ads.reduce((s, a) => s + a.ventasPublicidad, 0),
    activos: ads.filter(a => a.estado === "Activo").length,
  }), [ads]);

  const acosTotal = totals.ingresos > 0 ? (totals.inversion / totals.ingresos) * 100 : 0;
  const roasTotal = totals.inversion > 0 ? totals.ingresos / totals.inversion : 0;
  const ctrTotal = totals.impresiones > 0 ? (totals.clics / totals.impresiones) * 100 : 0;

  const estados = ["Todos", ...Array.from(new Set(ads.map(a => a.estado).filter(Boolean)))];

  const filtered = useMemo(() => {
    let d = ads;
    if (filterEstado !== "Todos") d = d.filter(a => a.estado === filterEstado);
    if (search) d = d.filter(a => a.titulo.toLowerCase().includes(search.toLowerCase()) || a.itemId.includes(search));
    return [...d].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [ads, filterEstado, search, sortBy]);

  // Top 10 for bar chart
  const top10 = useMemo(() =>
    [...ads].sort((a, b) => b.ingresos - a.ingresos).slice(0, 10).map(a => ({
      name: a.titulo.length > 22 ? a.titulo.slice(0, 22) + "…" : a.titulo,
      ingresos: a.ingresos,
      inversion: a.inversion,
      acos: a.acos,
    })),
    [ads]
  );

  // Scatter: inversión vs ingresos
  const scatterData = useMemo(() =>
    ads.filter(a => a.inversion > 0 || a.ingresos > 0).map(a => ({
      x: a.inversion,
      y: a.ingresos,
      name: a.titulo.slice(0, 30),
      acos: a.acos,
      estado: a.estado,
    })),
    [ads]
  );

  const periodo = ads[0] ? `${ads[0].desde} — ${ads[0].hasta}` : "";

  return (
    <div className="space-y-6">
      {/* Period + reload */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-brand-sub text-xs font-mono uppercase tracking-widest">Publicidad · {periodo}</p>
        </div>
        <p className="text-brand-muted text-xs font-mono">{ads.length} anuncios · {totals.activos} activos</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Inversión total", value: fmt(totals.inversion), sub: "gasto en ads", color: "text-red-400", icon: "💸" },
          { label: "Ingresos por ads", value: fmt(totals.ingresos), sub: `${totals.ventas.toFixed(0)} ventas`, color: "text-brand-yellow", icon: "💰" },
          { label: "ACOS", value: `${acosTotal.toFixed(1)}%`, sub: "inversión/ingresos", color: acosColor(acosTotal).replace("bg-", "text-").replace("/15","").replace("/20",""), icon: "🎯" },
          { label: "ROAS", value: `${roasTotal.toFixed(1)}x`, sub: "ingresos/inversión", color: "text-[#88AAFF]", icon: "📈" },
          { label: "Impresiones", value: fmtN(totals.impresiones), sub: `CTR ${ctrTotal.toFixed(2)}%`, color: "text-[#44DDAA]", icon: "👁" },
        ].map((kpi, i) => (
          <div key={i} className="bg-brand-card border border-brand-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{kpi.icon}</span>
              <p className="text-brand-sub text-xs font-mono">{kpi.label}</p>
            </div>
            <p className={`font-display font-bold text-2xl ${kpi.color}`}>{kpi.value}</p>
            <p className="text-brand-muted text-xs font-mono mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 ingresos vs inversión */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
          <h3 className="font-display font-semibold text-brand-text text-lg mb-1">Top 10 · Ingresos vs Inversión</h3>
          <p className="text-brand-sub text-sm mb-4">Por ingresos generados por publicidad</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 70, left: 0, bottom: 0 }}>
              <XAxis type="number" tickFormatter={v => `$${(v/1000).toFixed(0)}K`} tick={{ fill: "#AAAACC", fontSize: 9, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={145} tick={{ fill: "#E8E8F0", fontSize: 10, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#0A0A0F", border: "1px solid #1E1E2E", borderRadius: 10, fontFamily: "DM Sans", color: "#E8E8F0" }}
                formatter={(v: number, name: string) => [fmt(v), name === "ingresos" ? "Ingresos" : "Inversión"]}
              />
              <Bar dataKey="ingresos" radius={[0, 3, 3, 0]} fill="#FFE500" opacity={0.85} />
              <Bar dataKey="inversion" radius={[0, 3, 3, 0]} fill="#FF4466" opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-brand-yellow" /><span className="text-brand-sub text-xs font-mono">Ingresos</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#FF4466]" /><span className="text-brand-sub text-xs font-mono">Inversión</span></div>
          </div>
        </div>

        {/* Scatter inversión vs ingresos */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
          <h3 className="font-display font-semibold text-brand-text text-lg mb-1">Eficiencia por anuncio</h3>
          <p className="text-brand-sub text-sm mb-4">Inversión vs ingresos · color = ACOS</p>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
              <XAxis dataKey="x" type="number" name="Inversión" tickFormatter={v => fmt(v)} tick={{ fill: "#AAAACC", fontSize: 9, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} label={{ value: "Inversión", position: "insideBottom", offset: -2, fill: "#555577", fontSize: 9 }} />
              <YAxis dataKey="y" type="number" name="Ingresos" tickFormatter={v => fmt(v)} tick={{ fill: "#AAAACC", fontSize: 9, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: "#FFE500", opacity: 0.3 }}
                contentStyle={{ background: "#0A0A0F", border: "1px solid #1E1E2E", borderRadius: 10, fontFamily: "DM Sans", color: "#E8E8F0" }}
                formatter={(v: number, name: string) => [name === "x" || name === "Inversión" ? fmt(v) : fmt(v), name === "x" ? "Inversión" : "Ingresos"]}
              />
              <ReferenceLine stroke="#333355" strokeDasharray="4 4" segment={[{ x: 0, y: 0 }, { x: Math.max(...scatterData.map(d => d.x)), y: Math.max(...scatterData.map(d => d.x)) }]} />
              <Scatter
                data={scatterData}
                fill="#FFE500"
                shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  const color = acosColor(payload.acos);
                  return <circle cx={cx} cy={cy} r={5} fill={color} opacity={0.85} />;
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex gap-3 justify-center mt-2 flex-wrap">
            {[["<10% ACOS", "#44DDAA"], ["10-20%", "#FFE500"], ["20-35%", "#FF6B35"], [">35%", "#FF4466"], ["Sin ventas", "#555577"]].map(([l, c]) => (
              <div key={l} className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} /><span className="text-brand-muted text-xs font-mono">{l}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="font-display font-semibold text-brand-text text-lg mb-0.5">Detalle por anuncio</h3>
            <p className="text-brand-sub text-sm">{filtered.length} anuncios</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {estados.map(e => (
              <button key={e} onClick={() => setFilterEstado(e)}
                className={`px-2.5 py-1 text-xs font-mono border rounded-lg transition-all ${filterEstado === e ? "border-brand-yellow/50 bg-brand-yellow/10 text-brand-yellow" : "border-brand-border text-brand-sub hover:text-brand-text"}`}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mb-4 flex-wrap">
          <input type="text" placeholder="Buscar producto o MLU..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-xs font-mono text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-yellow/50" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-xs font-mono text-brand-sub focus:outline-none">
            <option value="ingresos">Ordenar: Ingresos ↓</option>
            <option value="inversion">Ordenar: Inversión ↓</option>
            <option value="acos">Ordenar: ACOS ↓</option>
            <option value="impresiones">Ordenar: Impresiones ↓</option>
            <option value="clics">Ordenar: Clics ↓</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-brand-border">
                {["Producto", "Estado", "Imp.", "Clics", "CTR", "CPC", "Inversión", "Ingresos", "ACOS", "ROAS", "Ventas"].map(h => (
                  <th key={h} className="text-left text-brand-sub py-2 pr-3 font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ad, i) => (
                <tr key={i} className="border-b border-brand-border/30 hover:bg-brand-dark/50 transition-colors">
                  <td className="py-2.5 pr-3 max-w-[200px]">
                    <p className="text-brand-text truncate" title={ad.titulo}>{ad.titulo.length > 32 ? ad.titulo.slice(0, 32) + "…" : ad.titulo}</p>
                    <p className="text-brand-muted text-xs opacity-60">{ad.itemId}</p>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${estadoBadge(ad.estado)}`}>{ad.estado || "—"}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-brand-sub">{fmtN(ad.impresiones)}</td>
                  <td className="py-2.5 pr-3 text-brand-sub">{fmtN(ad.clics)}</td>
                  <td className="py-2.5 pr-3 text-brand-sub">{ad.ctr > 0 ? `${ad.ctr.toFixed(2)}%` : "—"}</td>
                  <td className="py-2.5 pr-3 text-brand-sub">{ad.cpc > 0 ? `$${ad.cpc.toFixed(2)}` : "—"}</td>
                  <td className="py-2.5 pr-3 text-red-400 font-bold">{ad.inversion > 0 ? fmt(ad.inversion) : "—"}</td>
                  <td className="py-2.5 pr-3 text-brand-yellow font-bold">{ad.ingresos > 0 ? fmt(ad.ingresos) : "—"}</td>
                  <td className="py-2.5 pr-3">
                    {ad.acos > 0 ? (
                      <span className="font-bold" style={{ color: acosColor(ad.acos) }}>{ad.acos.toFixed(1)}%</span>
                    ) : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-[#88AAFF]">{ad.roas > 0 ? `${ad.roas.toFixed(1)}x` : "—"}</td>
                  <td className="py-2.5 pr-3 text-brand-sub">{ad.ventasPublicidad > 0 ? ad.ventasPublicidad.toFixed(0) : "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="text-center text-brand-muted py-8">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────
export default function AdsTab() {
  const { ads, setAds } = useAds();
  const hasAds = ads.length > 0;

  return hasAds ? (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setAds([])}
          className="px-3 py-1.5 text-xs font-mono border border-brand-border rounded-lg text-brand-sub hover:text-brand-yellow hover:border-brand-yellow/50 transition-all">
          ↑ Cargar otro reporte
        </button>
      </div>
      <AdsReport ads={ads} />
    </div>
  ) : (
    <AdsUploader onData={setAds} />
  );
}

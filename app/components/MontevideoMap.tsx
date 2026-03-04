"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import { MONTEVIDEO_GEOJSON } from "@/lib/montevideo-geojson";

interface MapOrder {
  departamentoEntrega: string;
  ciudadEntrega: string;
  totalItem: number;
  fecha: string;
}

interface MontevideoMapProps {
  orders: MapOrder[];
  selectedMonths: string[]; // "YYYY-MM"
}

// Normalize barrio names - improved matching
function normalizeBarrio(raw: string): string {
  if (!raw) return "";
  return raw.toUpperCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Extra aliases for known ML → GeoJSON mismatches
const BARRIO_ALIASES: Record<string, string> = {
  "MALVIN": "MALVIN",
  "MALVÍN": "MALVIN",
  "MALVIN NORTE": "MALVIN NORTE",
  "POCITOS NUEVO": "POCITOS NUEVO",
  "POCITOS": "POCITOS",
  "PUNTA CARRETAS": "PUNTA CARRETAS",
  "PUNTA GORDA": "PUNTA GORDA",
  "PARQUE RODO": "PARQUE RODO",
  "PARQUE RODÓ": "PARQUE RODO",
  "CORDON": "CORDON",
  "CORDÓN": "CORDON",
  "CENTRO": "CIUDAD VIEJA", // ML sometimes sends Centro for Ciudad Vieja area
  "LA BLANQUEADA": "LA BLANQUEADA",
  "UNION": "UNION",
  "UNIÓN": "UNION",
  "PRADO": "PRADO",
  "CARRASCO": "CARRASCO",
  "CARRASCO NORTE": "CARRASCO NORTE",
  "BUCEO": "BUCEO",
  "LARRAÑAGA": "LARRANAGA",
  "LARRANAGA": "LARRANAGA",
  "TRES CRUCES": "TRES CRUCES",
  "BELVEDERE": "BELVEDERE",
  "AGUADA": "AGUADA",
  "PALERMO": "PALERMO",
  "VILLA ESPAÑOLA": "VILLA ESPANOLA",
  "VILLA ESPANOLA": "VILLA ESPANOLA",
  "PEÑAROL": "PENAROL",
  "PENAROL": "PENAROL",
};

function getHeatColor(intensity: number): string {
  if (intensity === 0) return "#1C1C2E";
  if (intensity < 0.10) return "#162844";
  if (intensity < 0.25) return "#1a4470";
  if (intensity < 0.45) return "#1a6fa8";
  if (intensity < 0.65) return "#d48800";
  if (intensity < 0.85) return "#f0b000";
  return "#FFE500";
}

function makeProjection(features: any[], width: number, height: number, padding = 16) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  features.forEach(f => {
    const rings = f.geometry.coordinates as number[][][];
    rings.forEach(ring => ring.forEach(([lon, lat]) => {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }));
  });
  const lonRange = maxLon - minLon;
  const latRange = maxLat - minLat;
  const scaleX = (width - padding * 2) / lonRange;
  const scaleY = (height - padding * 2) / latRange;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = padding + (width - padding * 2 - lonRange * scale) / 2;
  const offsetY = padding + (height - padding * 2 - latRange * scale) / 2;
  return (lon: number, lat: number): [number, number] => [
    offsetX + (lon - minLon) * scale,
    offsetY + (maxLat - lat) * scale,
  ];
}

function ringsToPath(rings: number[][][], project: (lon: number, lat: number) => [number, number]): string {
  return rings.map(ring =>
    ring.map(([lon, lat], i) => {
      const [x, y] = project(lon, lat);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ") + "Z"
  ).join(" ");
}

function ringCentroid(ring: number[][], project: (lon: number, lat: number) => [number, number]): [number, number] {
  const pts = ring.map(([lon, lat]) => project(lon, lat));
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
}

function formatVal(v: number, metric: string) {
  if (metric === "revenue") {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  }
  return v.toLocaleString("es-UY");
}

export default function MontevideoMap({ orders, selectedMonths }: MontevideoMapProps) {
  const [metric, setMetric] = useState<"count" | "revenue">("count");
  const [hovered, setHovered] = useState<string | null>(null);
  const [dims, setDims] = useState({ width: 480, height: 456 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setDims({ width: w, height: Math.round(w * 0.95) });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const filteredOrders = useMemo(() => {
    const mvd = orders.filter(o => o.departamentoEntrega?.toLowerCase().includes("montevideo"));
    if (!selectedMonths.length) return mvd;
    return mvd.filter(o => {
      const d = new Date(o.fecha);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return selectedMonths.includes(key);
    });
  }, [orders, selectedMonths]);

  // Build barrio → data map using improved matching
  const barrioData = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    filteredOrders.forEach(o => {
      if (!o.ciudadEntrega) return;
      const normRaw = normalizeBarrio(o.ciudadEntrega);
      // Try alias first, then direct
      const resolved = BARRIO_ALIASES[normRaw] || BARRIO_ALIASES[o.ciudadEntrega.toUpperCase().trim()] || normRaw;
      if (!resolved) return;
      if (!map[resolved]) map[resolved] = { count: 0, revenue: 0 };
      map[resolved].count += 1;
      map[resolved].revenue += o.totalItem;
    });
    return map;
  }, [filteredOrders]);

  // Match barrio data to GeoJSON features
  const geoLookup = useMemo(() => {
    const lookup: Record<string, { count: number; revenue: number }> = {};
    Object.entries(barrioData).forEach(([barrio, vals]) => {
      const geoFeature = (MONTEVIDEO_GEOJSON.features as any[]).find(f => {
        const geoNorm = normalizeBarrio(f.properties.name);
        return geoNorm === barrio || geoNorm.includes(barrio) || barrio.includes(geoNorm);
      });
      if (geoFeature) {
        const key = geoFeature.properties.name;
        if (!lookup[key]) lookup[key] = { count: 0, revenue: 0 };
        lookup[key].count += vals.count;
        lookup[key].revenue += vals.revenue;
      }
    });
    return lookup;
  }, [barrioData]);

  const maxVal = useMemo(() =>
    Math.max(...Object.values(geoLookup).map(d => d[metric]), 1),
    [geoLookup, metric]
  );

  const project = useMemo(
    () => makeProjection(MONTEVIDEO_GEOJSON.features as any[], dims.width, dims.height),
    [dims]
  );

  const ranking = Object.entries(geoLookup).sort((a, b) => b[1][metric] - a[1][metric]);
  const hoveredData = hovered ? geoLookup[hovered] : null;
  const totalMvd = filteredOrders.length;

  return (
    <div className="flex flex-col">
      {/* Controls */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h4 className="font-display font-semibold text-brand-text text-base">Montevideo</h4>
          <p className="text-brand-sub text-xs font-mono">{totalMvd.toLocaleString("es-UY")} entregas</p>
        </div>
        <div className="flex bg-brand-dark border border-brand-border rounded-lg overflow-hidden">
          {(["count", "revenue"] as const).map(m => (
            <button key={m} onClick={() => setMetric(m)}
              className={`px-2.5 py-1 text-xs font-mono transition-all ${metric === m ? "bg-brand-yellow text-brand-dark font-bold" : "text-brand-sub hover:text-brand-text"}`}>
              {m === "count" ? "# Entregas" : "$ Ingresos"}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="relative" ref={containerRef}>
        <svg width="100%" viewBox={`0 0 ${dims.width} ${dims.height}`}
          style={{ display: "block", borderRadius: 10, background: "#0D0D1A" }}>
          {(MONTEVIDEO_GEOJSON.features as any[]).map((feature: any) => {
            const geoName: string = feature.properties.name;
            const vals = geoLookup[geoName];
            const val = vals?.[metric] || 0;
            const intensity = maxVal > 0 ? val / maxVal : 0;
            const fill = getHeatColor(intensity);
            const isHovered = hovered === geoName;
            const rings = feature.geometry.coordinates as number[][][];
            const pathD = ringsToPath(rings, project);
            return (
              <g key={geoName}
                onMouseEnter={() => setHovered(geoName)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}>
                <path d={pathD} fill={fill}
                  stroke={isHovered ? "#FFE500" : "#0D0D1A"}
                  strokeWidth={isHovered ? 1.5 : 0.5}
                  style={{ transition: "fill 0.2s ease" }} />
                {/* NO text labels on barrios - only color */}
              </g>
            );
          })}
        </svg>

        {hovered && (
          <div className="absolute top-2 left-2 bg-[#0A0A0F]/95 border border-brand-border rounded-xl px-3 py-2 shadow-xl pointer-events-none">
            <p className="text-brand-text font-mono font-bold text-xs capitalize">
              {hovered.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
            </p>
            {hoveredData ? (
              <>
                <p className="text-brand-yellow font-mono text-xs font-bold">{hoveredData.count.toLocaleString("es-UY")} entregas</p>
                <p className="text-brand-sub font-mono text-xs">{formatVal(hoveredData.revenue, "revenue")}</p>
                <p className="text-brand-muted font-mono text-xs">
                  {totalMvd > 0 ? ((hoveredData.count / totalMvd) * 100).toFixed(1) : 0}% del total MVD
                </p>
              </>
            ) : <p className="text-brand-muted font-mono text-xs">Sin entregas registradas</p>}
          </div>
        )}

        <div className="flex items-center gap-1 mt-2 justify-center">
          <span className="text-brand-muted text-xs font-mono">0</span>
          {[0, 0.12, 0.28, 0.48, 0.68, 0.84, 1].map((v, i) => (
            <div key={i} className="w-5 h-2.5 rounded-sm" style={{ background: getHeatColor(v) }} />
          ))}
          <span className="text-brand-muted text-xs font-mono">máx</span>
        </div>
      </div>

      {/* Ranking */}
      <div className="mt-4">
        <p className="text-brand-sub text-xs font-mono uppercase tracking-wider mb-2">
          Barrios — {metric === "count" ? "entregas" : "ingresos"}
        </p>
        {ranking.length === 0 ? (
          <p className="text-brand-muted text-xs font-mono text-center py-4">Sin datos de barrio</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {ranking.map(([barrio, vals], i) => {
              const val = vals[metric];
              const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
              const label = barrio.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
              return (
                <div key={barrio}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all ${hovered === barrio ? "bg-brand-yellow/10" : "hover:bg-brand-dark"}`}
                  onMouseEnter={() => setHovered(barrio)} onMouseLeave={() => setHovered(null)}>
                  <span className="text-brand-muted font-mono text-xs w-4 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-brand-text text-xs font-mono truncate">{label}</span>
                      <span className="text-brand-yellow text-xs font-mono font-bold ml-2 shrink-0">{formatVal(val, metric)}</span>
                    </div>
                    <div className="h-1 bg-brand-dark rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: getHeatColor(pct / 100) }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

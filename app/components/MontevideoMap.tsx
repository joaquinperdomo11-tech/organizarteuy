"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import { MONTEVIDEO_GEOJSON } from "@/lib/montevideo-geojson";

interface MontevideoMapProps {
  orders: {
    departamentoEntrega: string;
    ciudadEntrega: string;
    totalItem: number;
    fecha: string;
  }[];
}

// Normalize barrio names from ML data to match GeoJSON
function normalizeBarrio(raw: string): string {
  if (!raw) return "";
  const upper = raw.toUpperCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return upper;
}

function getHeatColor(intensity: number): string {
  if (intensity === 0) return "#1C1C2E";
  if (intensity < 0.10) return "#162844";
  if (intensity < 0.25) return "#1a4470";
  if (intensity < 0.45) return "#1a6fa8";
  if (intensity < 0.65) return "#d48800";
  if (intensity < 0.85) return "#f0b000";
  return "#FFE500";
}

function getTextColor(intensity: number): string {
  return intensity > 0.55 ? "#0A0A0F" : "#E8E8F0";
}

function makeProjection(features: any[], width: number, height: number, padding = 20) {
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

export default function MontevideoMap({ orders }: MontevideoMapProps) {
  const [metric, setMetric] = useState<"count" | "revenue">("count");
  const [hovered, setHovered] = useState<string | null>(null);
  const [dims, setDims] = useState({ width: 480, height: 460 });
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

  // Only Montevideo orders
  const mvdOrders = useMemo(() =>
    orders.filter(o => o.departamentoEntrega?.toLowerCase().includes("montevideo")),
    [orders]
  );

  // Build barrio → data map
  const barrioData = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    mvdOrders.forEach(o => {
      const barrio = normalizeBarrio(o.ciudadEntrega);
      if (!barrio) return;
      if (!map[barrio]) map[barrio] = { count: 0, revenue: 0 };
      map[barrio].count += 1;
      map[barrio].revenue += o.totalItem;
    });
    return map;
  }, [mvdOrders]);

  // Build lookup: normalized GeoJSON name → data
  const geoLookup = useMemo(() => {
    const lookup: Record<string, { count: number; revenue: number }> = {};
    Object.entries(barrioData).forEach(([barrio, vals]) => {
      // Try exact match first, then partial
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

  const formatVal = (v: number) => {
    if (metric === "revenue") {
      if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
      if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
      return `$${v.toFixed(0)}`;
    }
    return v.toLocaleString("es-UY");
  };

  const ranking = Object.entries(geoLookup).sort((a, b) => b[1][metric] - a[1][metric]);
  const totalMvd = mvdOrders.length;
  const withBarrio = mvdOrders.filter(o => o.ciudadEntrega).length;
  const hoveredData = hovered ? geoLookup[hovered] : null;

  // Short label for small barrios
  const shortLabel = (name: string) => {
    const words = name.split(" ");
    if (words.length > 2) return words.map(w => w[0]).join("");
    return name.length > 10 ? name.slice(0, 9) + "…" : name;
  };

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h3 className="font-display font-semibold text-brand-text text-lg mb-0.5">Mapa de Entregas — Montevideo</h3>
          <p className="text-brand-sub text-sm">
            {totalMvd.toLocaleString("es-UY")} entregas en Montevideo · {withBarrio.toLocaleString("es-UY")} con barrio registrado
          </p>
        </div>
        <div className="flex bg-brand-dark border border-brand-border rounded-lg overflow-hidden">
          {(["count", "revenue"] as const).map(m => (
            <button key={m} onClick={() => setMetric(m)}
              className={`px-3 py-1.5 text-xs font-mono transition-all ${metric === m ? "bg-brand-yellow text-brand-dark font-bold" : "text-brand-sub hover:text-brand-text"}`}>
              {m === "count" ? "# Entregas" : "$ Ingresos"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* SVG Map */}
        <div className="lg:col-span-2 relative" ref={containerRef}>
          <svg
            width="100%"
            viewBox={`0 0 ${dims.width} ${dims.height}`}
            style={{ display: "block", borderRadius: 12, background: "#0D0D1A" }}
          >
            {(MONTEVIDEO_GEOJSON.features as any[]).map((feature: any) => {
              const geoName: string = feature.properties.name;
              const vals = geoLookup[geoName];
              const val = vals?.[metric] || 0;
              const intensity = maxVal > 0 ? val / maxVal : 0;
              const fill = getHeatColor(intensity);
              const textColor = getTextColor(intensity);
              const isHovered = hovered === geoName;
              const rings = feature.geometry.coordinates as number[][][];
              const pathD = ringsToPath(rings, project);
              const [cx, cy] = ringCentroid(rings[0], project);

              return (
                <g key={geoName}
                  onMouseEnter={() => setHovered(geoName)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}
                >
                  <path
                    d={pathD}
                    fill={fill}
                    stroke={isHovered ? "#FFE500" : "#0D0D1A"}
                    strokeWidth={isHovered ? 1.5 : 0.5}
                    style={{ transition: "fill 0.2s ease" }}
                  />
                  {/* Only show label if hovered or has data */}
                  {(isHovered || val > 0) && (
                    <text x={cx} y={cy}
                      textAnchor="middle" dominantBaseline="middle"
                      fill={isHovered ? "#FFE500" : textColor}
                      fontSize={6} fontFamily="DM Sans" fontWeight={isHovered ? "700" : "500"}
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {shortLabel(geoName)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Hover tooltip */}
          {hovered && (
            <div className="absolute top-3 left-3 bg-[#0A0A0F]/95 border border-brand-border rounded-xl px-4 py-3 shadow-xl pointer-events-none min-w-[180px]">
              <p className="text-brand-text font-mono font-bold text-sm capitalize">{hovered.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</p>
              {hoveredData ? (
                <>
                  <p className="text-brand-yellow font-mono text-xs mt-1 font-bold">
                    {hoveredData.count.toLocaleString("es-UY")} entregas
                  </p>
                  <p className="text-brand-sub font-mono text-xs">
                    {formatVal(hoveredData.revenue)} ingresos
                  </p>
                  <div className="mt-2 h-1 bg-brand-dark rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-brand-yellow transition-all"
                      style={{ width: `${maxVal > 0 ? (hoveredData[metric] / maxVal * 100) : 0}%` }} />
                  </div>
                  <p className="text-brand-muted font-mono text-xs mt-1">
                    {totalMvd > 0 ? ((hoveredData.count / totalMvd) * 100).toFixed(1) : 0}% del total MVD
                  </p>
                </>
              ) : (
                <p className="text-brand-muted font-mono text-xs mt-1">Sin entregas registradas</p>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-3 justify-center">
            <span className="text-brand-muted text-xs font-mono">Sin datos</span>
            {[0, 0.12, 0.28, 0.48, 0.68, 0.84, 1].map((v, i) => (
              <div key={i} className="w-7 h-3 rounded-sm" style={{ background: getHeatColor(v) }} />
            ))}
            <span className="text-brand-muted text-xs font-mono">Máximo</span>
          </div>
        </div>

        {/* Ranking */}
        <div>
          <p className="text-brand-sub text-xs font-mono uppercase tracking-wider mb-3">
            Top barrios — {metric === "count" ? "entregas" : "ingresos"}
          </p>
          {ranking.length === 0 ? (
            <div className="bg-brand-dark rounded-xl p-4 text-center">
              <p className="text-brand-muted text-xs font-mono">Sin datos de barrio.</p>
              <p className="text-brand-muted text-xs font-mono mt-1 opacity-60">
                ML registra el barrio en "Ciudad Entrega" para Montevideo.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
              {ranking.map(([barrio, vals], i) => {
                const val = vals[metric];
                const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                const label = barrio.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                return (
                  <div key={barrio}
                    className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all ${hovered === barrio ? "bg-brand-yellow/10" : "hover:bg-brand-dark"}`}
                    onMouseEnter={() => setHovered(barrio)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <span className="text-brand-muted font-mono text-xs w-5 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-brand-text text-xs font-mono truncate">{label}</span>
                        <span className="text-brand-yellow text-xs font-mono font-bold ml-2 shrink-0">{formatVal(val)}</span>
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
    </div>
  );
}

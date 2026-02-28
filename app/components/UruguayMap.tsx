"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import { URUGUAY_GEOJSON } from "@/lib/uruguay-geojson";

interface UruguayMapProps {
  orders: {
    departamentoEntrega: string;
    ciudadEntrega: string;
    totalItem: number;
    fecha: string;
  }[];
}

const DEPT_NORMALIZE: Record<string, string> = {
  "montevideo": "Montevideo", "canelones": "Canelones", "maldonado": "Maldonado",
  "rocha": "Rocha", "treinta y tres": "Treinta y Tres", "cerro largo": "Cerro Largo",
  "rivera": "Rivera", "artigas": "Artigas", "salto": "Salto",
  "paysandu": "Paysandú", "paysandú": "Paysandú", "rio negro": "Río Negro",
  "río negro": "Río Negro", "soriano": "Soriano", "colonia": "Colonia",
  "san jose": "San José", "san josé": "San José", "flores": "Flores",
  "florida": "Florida", "lavalleja": "Lavalleja", "durazno": "Durazno",
  "tacuarembo": "Tacuarembó", "tacuarembó": "Tacuarembó",
};

function normalizeDept(raw: string): string {
  if (!raw) return "";
  return DEPT_NORMALIZE[raw.toLowerCase().trim()] || raw;
}

function getHeatColor(intensity: number): string {
  if (intensity === 0) return "#1C1C2E";
  if (intensity < 0.15) return "#162844";
  if (intensity < 0.30) return "#1a4470";
  if (intensity < 0.50) return "#1a6fa8";
  if (intensity < 0.70) return "#d48800";
  if (intensity < 0.85) return "#f0b000";
  return "#FFE500";
}

function getTextColor(intensity: number): string {
  return intensity > 0.55 ? "#0A0A0F" : "#E8E8F0";
}

function makeProjection(features: any[], width: number, height: number, padding = 24) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  features.forEach(f => {
    const ring = f.geometry.coordinates[0] as [number, number][];
    ring.forEach(([lon, lat]) => {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
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

function ringToPath(ring: number[][], project: (lon: number, lat: number) => [number, number]): string {
  return ring.map(([lon, lat], i) => {
    const [x, y] = project(lon, lat);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ") + "Z";
}

function ringCentroid(ring: number[][], project: (lon: number, lat: number) => [number, number]): [number, number] {
  const pts = ring.map(([lon, lat]) => project(lon, lat));
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
}

export default function UruguayMap({ orders }: UruguayMapProps) {
  const [metric, setMetric] = useState<"count" | "revenue">("count");
  const [hovered, setHovered] = useState<string | null>(null);
  const [dims, setDims] = useState({ width: 480, height: 504 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setDims({ width: w, height: Math.round(w * 1.05) });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const deptData = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    orders.forEach(o => {
      const dept = normalizeDept(o.departamentoEntrega);
      if (!dept) return;
      if (!map[dept]) map[dept] = { count: 0, revenue: 0 };
      map[dept].count += 1;
      map[dept].revenue += o.totalItem;
    });
    return map;
  }, [orders]);

  const maxVal = useMemo(() =>
    Math.max(...Object.values(deptData).map(d => d[metric]), 1),
    [deptData, metric]
  );

  const project = useMemo(
    () => makeProjection(URUGUAY_GEOJSON.features as any[], dims.width, dims.height),
    [dims]
  );

  const totalOrders = orders.filter(o => o.departamentoEntrega).length;

  const formatVal = (v: number) => {
    if (metric === "revenue") {
      if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
      if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
      return `$${v.toFixed(0)}`;
    }
    return v.toLocaleString("es-UY");
  };

  const deptRanking = Object.entries(deptData).sort((a, b) => b[1][metric] - a[1][metric]);
  const hoveredData = hovered ? deptData[hovered] : null;

  const shortLabel = (dept: string) => {
    if (dept === "Treinta y Tres") return "TyT";
    if (dept === "Cerro Largo") return "C.Largo";
    if (dept === "Río Negro") return "R.Negro";
    return dept;
  };

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h3 className="font-display font-semibold text-brand-text text-lg mb-0.5">Mapa de Entregas — Uruguay</h3>
          <p className="text-brand-sub text-sm">{totalOrders.toLocaleString("es-UY")} entregas con departamento registrado</p>
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
            {(URUGUAY_GEOJSON.features as any[]).map((feature: any) => {
              const geoName: string = feature.properties.name;
              const dept = normalizeDept(geoName);
              const val = deptData[dept]?.[metric] || 0;
              const intensity = maxVal > 0 ? val / maxVal : 0;
              const fill = getHeatColor(intensity);
              const textColor = getTextColor(intensity);
              const isHovered = hovered === dept;
              const ring = feature.geometry.coordinates[0] as number[][];
              const pathD = ringToPath(ring, project);
              const [cx, cy] = ringCentroid(ring, project);
              const isSmall = dept === "Montevideo" || dept === "Flores" || dept === "Colonia" || dept === "San José";

              return (
                <g key={dept}
                  onMouseEnter={() => setHovered(dept)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}
                >
                  <path
                    d={pathD}
                    fill={fill}
                    stroke={isHovered ? "#FFE500" : "#0D0D1A"}
                    strokeWidth={isHovered ? 2 : 0.8}
                    style={{ transition: "fill 0.25s ease" }}
                  />
                  <text x={cx} y={cy - (val > 0 && !isSmall ? 5 : 0)}
                    textAnchor="middle" dominantBaseline="middle"
                    fill={textColor} fontSize={isSmall ? 7 : 9}
                    fontFamily="DM Sans" fontWeight="700"
                    style={{ pointerEvents: "none", userSelect: "none" }}>
                    {shortLabel(dept)}
                  </text>
                  {val > 0 && !isSmall && (
                    <text x={cx} y={cy + 7}
                      textAnchor="middle" dominantBaseline="middle"
                      fill={textColor} fontSize={7} fontFamily="DM Mono"
                      style={{ pointerEvents: "none", userSelect: "none", opacity: 0.9 }}>
                      {formatVal(val)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Hover card */}
          {hovered && (
            <div className="absolute top-3 left-3 bg-[#0A0A0F]/95 border border-brand-border rounded-xl px-4 py-3 shadow-xl pointer-events-none min-w-[170px]">
              <p className="text-brand-text font-mono font-bold text-sm">{hovered}</p>
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
                    {maxVal > 0 ? ((hoveredData[metric] / maxVal) * 100).toFixed(1) : 0}% del máximo
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
            Ranking — {metric === "count" ? "entregas" : "ingresos"}
          </p>
          <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
            {deptRanking.length === 0 ? (
              <p className="text-brand-muted text-xs font-mono text-center py-8">
                Sin datos de departamento.
              </p>
            ) : deptRanking.map(([dept, vals], i) => {
              const val = vals[metric];
              const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
              return (
                <div key={dept}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all ${hovered === dept ? "bg-brand-yellow/10" : "hover:bg-brand-dark"}`}
                  onMouseEnter={() => setHovered(dept)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span className="text-brand-muted font-mono text-xs w-5 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-brand-text text-xs font-mono truncate">{dept}</span>
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
        </div>
      </div>
    </div>
  );
}

"use client";
import { useMemo, useState } from "react";

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

// SVG paths para cada departamento de Uruguay (coordenadas en viewBox 0 0 500 600)
const DEPT_PATHS: Record<string, string> = {
  "Artigas":        "M 95,20 L 175,20 L 185,55 L 170,80 L 130,90 L 90,75 L 80,45 Z",
  "Salto":          "M 80,45 L 130,90 L 135,130 L 115,155 L 70,150 L 55,110 L 65,75 Z",
  "Rivera":         "M 175,20 L 260,25 L 270,70 L 240,95 L 185,90 L 170,80 L 185,55 Z",
  "Tacuarembó":     "M 185,90 L 240,95 L 255,140 L 230,175 L 185,170 L 160,145 L 135,130 L 170,95 Z",
  "Paysandú":       "M 55,110 L 115,155 L 120,195 L 95,225 L 55,220 L 40,175 L 45,140 Z",
  "Cerro Largo":    "M 255,140 L 320,145 L 330,185 L 300,215 L 255,210 L 230,175 Z",
  "Río Negro":      "M 40,175 L 95,225 L 100,260 L 75,280 L 40,270 L 25,235 L 30,200 Z",
  "Durazno":        "M 135,130 L 160,145 L 185,170 L 190,210 L 165,240 L 130,235 L 110,205 L 120,170 Z",
  "Soriano":        "M 25,235 L 75,280 L 80,315 L 55,335 L 25,325 L 15,290 Z",
  "Florida":        "M 165,240 L 190,210 L 230,215 L 245,250 L 225,285 L 195,295 L 170,275 Z",
  "Flores":         "M 80,315 L 130,235 L 165,240 L 170,275 L 145,305 L 110,315 Z",
  "Treinta y Tres": "M 255,210 L 300,215 L 320,255 L 300,290 L 265,295 L 245,270 L 245,250 Z",
  "Colonia":        "M 15,290 L 55,335 L 60,370 L 35,385 L 10,365 L 8,330 Z",
  "San José":       "M 60,370 L 110,315 L 145,305 L 150,340 L 130,370 L 95,385 L 70,390 Z",
  "Lavalleja":      "M 245,250 L 265,295 L 255,330 L 225,345 L 200,325 L 195,295 L 225,285 Z",
  "Rocha":          "M 300,290 L 350,295 L 375,335 L 355,375 L 310,385 L 280,355 L 265,320 L 255,330 L 265,295 Z",
  "Canelones":      "M 150,340 L 195,295 L 200,325 L 220,350 L 210,380 L 185,395 L 160,390 L 140,370 Z",
  "Maldonado":      "M 225,345 L 255,330 L 265,320 L 280,355 L 270,390 L 240,400 L 215,385 L 210,365 Z",
  "Montevideo":     "M 140,370 L 160,390 L 185,395 L 190,415 L 165,420 L 140,405 Z",
};

// Centroides para labels
const DEPT_CENTROIDS: Record<string, [number, number]> = {
  "Artigas": [130, 52], "Salto": [95, 108], "Rivera": [220, 58],
  "Tacuarembó": [200, 135], "Paysandú": [78, 185], "Cerro Largo": [282, 178],
  "Río Negro": [58, 228], "Durazno": [155, 200], "Soriano": [48, 285],
  "Florida": [200, 255], "Flores": [125, 280], "Treinta y Tres": [278, 252],
  "Colonia": [32, 340], "San José": [103, 355], "Lavalleja": [228, 310],
  "Rocha": [318, 340], "Canelones": [182, 350], "Maldonado": [248, 370],
  "Montevideo": [160, 395],
};

const DEPT_ABBR: Record<string, string> = {
  "Artigas": "ART", "Salto": "SAL", "Rivera": "RIV", "Tacuarembó": "TAC",
  "Paysandú": "PAY", "Cerro Largo": "CLA", "Río Negro": "RNE", "Durazno": "DUR",
  "Soriano": "SOR", "Florida": "FLA", "Flores": "FLO", "Treinta y Tres": "TYT",
  "Colonia": "COL", "San José": "SJO", "Lavalleja": "LAV", "Rocha": "ROC",
  "Canelones": "CAN", "Maldonado": "MAL", "Montevideo": "MVD",
};

function getHeatColor(intensity: number): string {
  if (intensity === 0) return "#2A2A3E";
  if (intensity < 0.15) return "#1a3a5c";
  if (intensity < 0.30) return "#1e5f8a";
  if (intensity < 0.50) return "#2b8fbd";
  if (intensity < 0.70) return "#f0a500";
  if (intensity < 0.85) return "#f5c518";
  return "#FFE500";
}

function getTextColor(intensity: number): string {
  return intensity > 0.5 ? "#0A0A0F" : "#E8E8F0";
}

export default function UruguayMap({ orders }: UruguayMapProps) {
  const [metric, setMetric] = useState<"count" | "revenue">("count");
  const [hovered, setHovered] = useState<string | null>(null);

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

  const maxVal = useMemo(() => Math.max(...Object.values(deptData).map(d => d[metric]), 1), [deptData, metric]);
  const totalOrders = orders.filter(o => o.departamentoEntrega).length;

  const formatVal = (v: number) => {
    if (metric === "revenue") {
      if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
      if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
      return `$${v.toFixed(0)}`;
    }
    return `${v}`;
  };

  // Sort depts for ranking
  const deptRanking = Object.entries(deptData)
    .sort((a, b) => b[1][metric] - a[1][metric]);

  const hoveredData = hovered ? deptData[hovered] : null;

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h3 className="font-display font-semibold text-brand-text text-lg mb-0.5">Entregas por Departamento</h3>
          <p className="text-brand-sub text-sm">{totalOrders} entregas con ubicación registrada</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Mapa SVG */}
        <div className="lg:col-span-2">
          <div className="relative bg-[#12121E] rounded-xl overflow-hidden" style={{ paddingBottom: "75%" }}>
            <svg
              viewBox="0 0 500 500"
              className="absolute inset-0 w-full h-full"
              style={{ display: "block" }}
            >
              {/* Fondo */}
              <rect width="500" height="500" fill="#0D0D1A" />

              {/* Departamentos */}
              {Object.entries(DEPT_PATHS).map(([dept, path]) => {
                const val = deptData[dept]?.[metric] || 0;
                const intensity = val / maxVal;
                const fill = getHeatColor(intensity);
                const textColor = getTextColor(intensity);
                const isHovered = hovered === dept;
                const [cx, cy] = DEPT_CENTROIDS[dept] || [0, 0];

                return (
                  <g key={dept}
                    onMouseEnter={() => setHovered(dept)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <path
                      d={path}
                      fill={fill}
                      stroke={isHovered ? "#FFE500" : "#0D0D1A"}
                      strokeWidth={isHovered ? 2 : 1}
                      opacity={isHovered ? 1 : 0.9}
                      style={{ transition: "all 0.15s ease" }}
                    />
                    {/* Label */}
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={textColor}
                      fontSize={dept === "Montevideo" ? 7 : 8}
                      fontFamily="DM Mono"
                      fontWeight="600"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {DEPT_ABBR[dept] || dept.slice(0, 3)}
                    </text>
                    {val > 0 && (
                      <text
                        x={cx}
                        y={cy + 10}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={textColor}
                        fontSize={6}
                        fontFamily="DM Mono"
                        style={{ pointerEvents: "none", userSelect: "none", opacity: 0.8 }}
                      >
                        {formatVal(val)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Tooltip hover */}
            {hovered && hoveredData && (
              <div className="absolute top-3 left-3 bg-brand-dark/95 border border-brand-border rounded-xl px-4 py-3 shadow-xl pointer-events-none">
                <p className="text-brand-text font-mono font-bold text-sm">{hovered}</p>
                <p className="text-brand-yellow font-mono text-xs mt-1">
                  {hoveredData.count} entregas
                </p>
                <p className="text-brand-sub font-mono text-xs">
                  ${hoveredData.revenue.toLocaleString("es-UY", { maximumFractionDigits: 0 })} ingresos
                </p>
                <p className="text-brand-muted font-mono text-xs mt-1">
                  {maxVal > 0 ? ((hoveredData[metric] / maxVal) * 100).toFixed(1) : 0}% del máximo
                </p>
              </div>
            )}
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-2 mt-3 justify-center">
            <span className="text-brand-muted text-xs font-mono">Sin datos</span>
            {["#2A2A3E", "#1a3a5c", "#1e5f8a", "#2b8fbd", "#f0a500", "#f5c518", "#FFE500"].map((c, i) => (
              <div key={i} className="w-7 h-3 rounded-sm" style={{ background: c }} />
            ))}
            <span className="text-brand-muted text-xs font-mono">Mayor</span>
          </div>
        </div>

        {/* Ranking */}
        <div>
          <p className="text-brand-sub text-xs font-mono uppercase tracking-wider mb-3">
            Ranking · {metric === "count" ? "entregas" : "ingresos"}
          </p>
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {deptRanking.map(([dept, vals], i) => {
              const val = vals[metric];
              const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
              return (
                <div key={dept}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${hovered === dept ? "bg-brand-yellow/10" : "hover:bg-brand-dark"}`}
                  onMouseEnter={() => setHovered(dept)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span className="text-brand-muted font-mono text-xs w-4 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
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
            {deptRanking.length === 0 && (
              <p className="text-brand-muted text-xs font-mono text-center py-8">
                Sin datos de departamento.<br />Asegurate de haber recargado el histórico con las nuevas columnas.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

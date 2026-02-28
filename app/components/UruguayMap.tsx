"use client";
import { useMemo, useState, useEffect, useRef } from "react";

interface UruguayMapProps {
  orders: {
    departamentoEntrega: string;
    ciudadEntrega: string;
    totalItem: number;
    fecha: string;
  }[];
}

// Departamentos de Uruguay con sus nombres normalizados
const DEPT_NORMALIZE: Record<string, string> = {
  "montevideo": "Montevideo",
  "canelones": "Canelones",
  "maldonado": "Maldonado",
  "rocha": "Rocha",
  "treinta y tres": "Treinta y Tres",
  "cerro largo": "Cerro Largo",
  "rivera": "Rivera",
  "artigas": "Artigas",
  "salto": "Salto",
  "paysandu": "Paysandú",
  "paysandú": "Paysandú",
  "rio negro": "Río Negro",
  "río negro": "Río Negro",
  "soriano": "Soriano",
  "colonia": "Colonia",
  "san jose": "San José",
  "san josé": "San José",
  "flores": "Flores",
  "florida": "Florida",
  "lavalleja": "Lavalleja",
  "durazno": "Durazno",
  "tacuarembo": "Tacuarembó",
  "tacuarembó": "Tacuarembó",
};

function normalizeDept(raw: string): string {
  if (!raw) return "";
  const lower = raw.toLowerCase().trim();
  return DEPT_NORMALIZE[lower] || raw;
}

// GeoJSON simplificado de Uruguay por departamento
// Coordenadas aproximadas del centroide de cada departamento
const DEPT_CENTROIDS: Record<string, [number, number]> = {
  "Montevideo": [-34.9011, -56.1645],
  "Canelones": [-34.5200, -55.9300],
  "Maldonado": [-34.9020, -54.9580],
  "Rocha": [-34.4800, -54.3400],
  "Treinta y Tres": [-33.2300, -54.3800],
  "Cerro Largo": [-32.3700, -54.1700],
  "Rivera": [-31.3800, -55.5500],
  "Artigas": [-30.4000, -56.4700],
  "Salto": [-31.3800, -57.9600],
  "Paysandú": [-32.3200, -58.0800],
  "Río Negro": [-32.8300, -57.9000],
  "Soriano": [-33.4700, -57.8000],
  "Colonia": [-34.0900, -57.8400],
  "San José": [-34.3400, -56.7100],
  "Flores": [-33.5700, -56.8900],
  "Florida": [-33.9800, -56.2100],
  "Lavalleja": [-33.9100, -55.2300],
  "Durazno": [-33.3800, -56.5200],
  "Tacuarembó": [-31.7300, -55.9800],
};

export default function UruguayMap({ orders }: UruguayMapProps) {
  const [metric, setMetric] = useState<"count" | "revenue">("count");
  const svgRef = useRef<SVGSVGElement>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; dept: string; value: number } | null>(null);

  // Fetch GeoJSON de Uruguay
  useEffect(() => {
    fetch("https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/uruguay-departments.geojson")
      .then(r => r.json())
      .then(data => setGeoData(data))
      .catch(() => setGeoData(null));
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

  const maxVal = useMemo(() => Math.max(...Object.values(deptData).map(d => d[metric]), 1), [deptData, metric]);

  const formatVal = (v: number) => {
    if (metric === "revenue") {
      if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
      if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
      return `$${v.toFixed(0)}`;
    }
    return `${v} entregas`;
  };

  const getColor = (dept: string) => {
    const val = deptData[dept]?.[metric] || 0;
    if (val === 0) return "#1A1A2E";
    const intensity = val / maxVal;
    if (intensity < 0.2) return "#2A2A4A";
    if (intensity < 0.4) return "#4A4A8A";
    if (intensity < 0.6) return "#6666BB";
    if (intensity < 0.8) return "#FFB300";
    return "#FFE500";
  };

  // Tabla de departamentos ordenada
  const deptList = Object.entries(deptData)
    .sort((a, b) => b[1][metric] - a[1][metric]);

  const totalOrders = orders.filter(o => o.departamentoEntrega).length;

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="font-display font-semibold text-brand-text text-lg mb-0.5">Entregas por Departamento</h3>
          <p className="text-brand-sub text-sm">{totalOrders} entregas registradas</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tabla ranking */}
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {deptList.map(([dept, vals], i) => {
            const val = vals[metric];
            const pct = (val / maxVal) * 100;
            return (
              <div key={dept} className="flex items-center gap-3">
                <span className="text-brand-muted font-mono text-xs w-5 text-right">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-brand-text text-xs font-mono">{dept}</span>
                    <span className="text-brand-yellow text-xs font-mono font-bold">{formatVal(val)}</span>
                  </div>
                  <div className="h-1.5 bg-brand-dark rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-brand-yellow transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
          {deptList.length === 0 && (
            <p className="text-brand-muted text-sm font-mono text-center py-8">Sin datos de departamento</p>
          )}
        </div>

        {/* Mapa visual con burbujas */}
        <div className="relative bg-brand-dark rounded-xl overflow-hidden" style={{ height: 320 }}>
          <svg width="100%" height="100%" viewBox="0 0 300 320" style={{ display: "block" }}>
            {/* Fondo */}
            <rect width="300" height="320" fill="#0A0A15" rx="8" />

            {/* Burbujas por departamento */}
            {Object.entries(DEPT_CENTROIDS).map(([dept, [lat, lng]]) => {
              const val = deptData[dept]?.[metric] || 0;
              if (val === 0) return null;

              // Proyección simple: convertir lat/lng a px
              const x = ((lng - (-58.5)) / ((-53.0) - (-58.5))) * 260 + 20;
              const y = ((lat - (-34.0)) / ((-30.0) - (-34.0))) * -260 + 300;
              const r = Math.max(6, (val / maxVal) * 35);
              const intensity = val / maxVal;
              const color = intensity > 0.7 ? "#FFE500" : intensity > 0.4 ? "#FFB300" : intensity > 0.2 ? "#8888FF" : "#4444AA";

              return (
                <g key={dept}
                  onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, dept, value: val })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: "pointer" }}>
                  <circle cx={x} cy={y} r={r} fill={color} opacity={0.75} />
                  <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={1} opacity={0.4} />
                  {r > 12 && (
                    <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                      fill="#0A0A0F" fontSize={r > 20 ? 9 : 7} fontFamily="DM Mono" fontWeight="bold">
                      {dept === "Montevideo" ? "MVD" : dept.slice(0, 3).toUpperCase()}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Leyenda */}
            <text x="10" y="315" fill="#555577" fontSize="8" fontFamily="DM Mono">UY · tamaño = {metric === "count" ? "entregas" : "ingresos"}</text>
          </svg>

          {/* Tooltip */}
          {tooltip && (
            <div className="fixed z-50 bg-brand-card border border-brand-border rounded-lg px-3 py-2 shadow-xl pointer-events-none"
              style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}>
              <p className="text-brand-text text-xs font-mono font-bold">{tooltip.dept}</p>
              <p className="text-brand-yellow text-xs font-mono">{formatVal(tooltip.value)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Leyenda de colores */}
      <div className="flex items-center gap-2 mt-4 justify-end">
        <span className="text-brand-muted text-xs font-mono">Menos</span>
        {["#2A2A4A", "#4A4A8A", "#6666BB", "#FFB300", "#FFE500"].map((c, i) => (
          <div key={i} className="w-5 h-3 rounded-sm" style={{ background: c }} />
        ))}
        <span className="text-brand-muted text-xs font-mono">Más</span>
      </div>
    </div>
  );
}

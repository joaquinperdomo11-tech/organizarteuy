"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  LabelList,
} from "recharts";
import { useState, useMemo } from "react";

interface TopProductsProps {
  products: { name: string; sku: string; units: number; revenue: number; margen: number }[];
  allOrders: { fecha: string; producto: string; sku: string; cantidad: number; totalItem: number; margenReal: number }[];
}

interface StatusChartProps {
  data: { tipo: string; count: number; color: string }[];
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function truncate(str: string, n = 22) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

function getAvailableMonths(orders: TopProductsProps["allOrders"]) {
  const months = new Set<string>();
  orders.forEach((o) => {
    const d = new Date(o.fecha);
    if (!isNaN(d.getTime())) {
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  });
  return Array.from(months).sort().reverse();
}

function formatMonthLabel(m: string) {
  const [year, month] = m.split("-");
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${names[parseInt(month) - 1]} ${year.slice(2)}`;
}

export function TopProductsChart({ products, allOrders }: TopProductsProps) {
  const availableMonths = useMemo(() => getAvailableMonths(allOrders), [allOrders]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]); // empty = all time
  const [metric, setMetric] = useState<"revenue" | "units">("revenue");
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const toggleMonth = (m: string) => {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const filteredData = useMemo(() => {
    if (selectedMonths.length === 0) return products;

    // Recalculate from raw orders filtered by selected months
    const map: Record<string, { sku: string; units: number; revenue: number; margen: number }> = {};
    allOrders.forEach((o) => {
      const d = new Date(o.fecha);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!selectedMonths.includes(key)) return;
      const name = o.producto || "Sin título";
      if (!map[name]) map[name] = { sku: o.sku, units: 0, revenue: 0, margen: 0 };
      map[name].units += o.cantidad;
      map[name].revenue += o.totalItem;
      map[name].margen += o.margenReal;
    });

    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, 8);
  }, [selectedMonths, allOrders, products, metric]);

  const data = filteredData
    .slice(0, 8)
    .map((p) => ({ ...p, shortName: truncate(p.name) }))
    .sort((a, b) => a[metric] - b[metric]); // ascending for horizontal chart

  const filterLabel = selectedMonths.length === 0
    ? "Histórico"
    : selectedMonths.length === 1
    ? formatMonthLabel(selectedMonths[0])
    : `${selectedMonths.length} meses`;

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="font-display font-semibold text-brand-text text-lg mb-0.5">Top Productos</h3>
          <p className="text-brand-sub text-sm">Por {metric === "revenue" ? "ingresos" : "unidades"}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Metric toggle */}
          <div className="flex bg-brand-dark border border-brand-border rounded-lg overflow-hidden">
            {(["revenue", "units"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1.5 text-xs font-mono transition-all ${
                  metric === m ? "bg-brand-yellow text-brand-dark font-bold" : "text-brand-sub hover:text-brand-text"
                }`}
              >
                {m === "revenue" ? "$ Ventas" : "# Unidades"}
              </button>
            ))}
          </div>

          {/* Month filter */}
          <div className="relative">
            <button
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className={`px-3 py-1.5 text-xs font-mono border rounded-lg transition-all ${
                selectedMonths.length > 0
                  ? "border-brand-yellow/50 text-brand-yellow bg-brand-yellow/5"
                  : "border-brand-border text-brand-sub hover:text-brand-text"
              }`}
            >
              📅 {filterLabel}
            </button>

            {showMonthPicker && (
              <div className="absolute right-0 top-9 z-20 bg-brand-card border border-brand-border rounded-xl shadow-xl p-3 min-w-[160px]">
                <button
                  onClick={() => { setSelectedMonths([]); setShowMonthPicker(false); }}
                  className={`w-full text-left px-2 py-1.5 text-xs font-mono rounded-lg mb-1 transition-all ${
                    selectedMonths.length === 0 ? "bg-brand-yellow/10 text-brand-yellow" : "text-brand-sub hover:text-brand-text"
                  }`}
                >
                  Histórico completo
                </button>
                <div className="border-t border-brand-border my-1" />
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {availableMonths.map((m) => (
                    <button
                      key={m}
                      onClick={() => toggleMonth(m)}
                      className={`w-full text-left px-2 py-1.5 text-xs font-mono rounded-lg transition-all flex items-center gap-2 ${
                        selectedMonths.includes(m) ? "bg-brand-yellow/10 text-brand-yellow" : "text-brand-sub hover:text-brand-text"
                      }`}
                    >
                      <span>{selectedMonths.includes(m) ? "✓" : "○"}</span>
                      {formatMonthLabel(m)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: metric === "revenue" ? 80 : 60, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            tickFormatter={metric === "revenue" ? formatCurrency : undefined}
            tick={{ fill: "#8888AA", fontSize: 10, fontFamily: "DM Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            width={155}
            tick={{ fill: "#E8E8F0", fontSize: 11, fontFamily: "DM Sans" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v: number) => [metric === "revenue" ? formatCurrency(v) : `${v} uds`, metric === "revenue" ? "Ingresos" : "Unidades"]}
            contentStyle={{ background: "#0A0A0F", border: "1px solid #1E1E2E", borderRadius: "10px", fontFamily: "DM Sans", color: "#E8E8F0" }}
            cursor={{ fill: "rgba(255,229,0,0.04)" }}
          />
          <Bar dataKey={metric} radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === data.length - 1 ? "#FFE500" : `rgba(255,229,0,${0.35 + (i / data.length) * 0.5})`} />
            ))}
            <LabelList
              dataKey={metric}
              position="right"
              formatter={(v: number) => metric === "revenue" ? formatCurrency(v) : `${v}`}
              style={{ fill: "#8888AA", fontSize: 10, fontFamily: "DM Mono" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.06) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#0A0A0F" textAnchor="middle" dominantBaseline="central" fontSize={11} fontFamily="DM Mono" fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function StatusChart({ data }: StatusChartProps) {
  const pieData = data.map((d) => ({
    name: d.tipo,
    value: d.count,
    color: d.color,
  }));

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <h3 className="font-display font-semibold text-brand-text text-lg mb-1">Tipo de Envío</h3>
      <p className="text-brand-sub text-sm mb-4">Distribución por tipo de envío</p>

      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={3}
            dataKey="value"
            labelLine={false}
            label={renderCustomLabel}
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Legend
            formatter={(value) => (
              <span style={{ color: "#8888AA", fontSize: 12, fontFamily: "DM Sans" }}>{value}</span>
            )}
          />
          <Tooltip
            formatter={(v: number, name: string) => [v + " órdenes", name]}
            contentStyle={{ background: "#111118", border: "1px solid #1E1E2E", borderRadius: "10px", fontFamily: "DM Sans", color: "#E8E8F0" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

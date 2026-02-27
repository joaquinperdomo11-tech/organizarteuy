"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { useState } from "react";

interface RevenueChartProps {
  byDay: { date: string; revenue: number; margen: number; orders: number }[];
  byMonth: { month: string; revenue: number; margen: number; orders: number }[];
  currentMonthByDay: { day: number; revenue: number; margen: number; orders: number }[];
  prevMonthByDay: { day: number; revenue: number; margen: number; orders: number }[];
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
}

const ComparisonTooltip = ({ active, payload, label, metric }: any) => {
  if (!active || !payload?.length) return null;
  const cur = payload.find((p: any) => p.dataKey === `cur_${metric}`);
  const prev = payload.find((p: any) => p.dataKey === `prev_${metric}`);
  const pct = prev?.value > 0 ? ((cur?.value - prev?.value) / prev?.value) * 100 : null;

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-3 shadow-xl min-w-[160px]">
      <p className="text-brand-sub text-xs mb-2 font-mono">Día {label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-mono text-brand-yellow">Mes actual</span>
          <span className="text-xs font-mono font-bold text-brand-text">
            {metric === "orders" ? cur?.value : formatCurrency(cur?.value || 0)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-mono text-brand-sub">Mes anterior</span>
          <span className="text-xs font-mono text-brand-sub">
            {metric === "orders" ? prev?.value : formatCurrency(prev?.value || 0)}
          </span>
        </div>
        {pct !== null && (
          <div className={`text-xs font-mono font-bold mt-1 ${pct >= 0 ? "text-green-400" : "text-red-400"}`}>
            {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% vs mes anterior
          </div>
        )}
      </div>
    </div>
  );
};

const MonthTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-3 shadow-xl">
      <p className="text-brand-sub text-xs mb-2 font-mono">{formatMonth(label)}</p>
      <p className="text-brand-yellow font-display font-bold text-lg">
        {formatCurrency(payload[0]?.value || 0)}
      </p>
    </div>
  );
};

export default function RevenueChart({ byDay, byMonth, currentMonthByDay, prevMonthByDay }: RevenueChartProps) {
  const [view, setView] = useState<"day" | "month">("day");
  const [metric, setMetric] = useState<"revenue" | "margen" | "orders">("revenue");

  const now = new Date();
  const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const mesActual = monthNames[now.getMonth()];
  const mesAnterior = monthNames[now.getMonth() === 0 ? 11 : now.getMonth() - 1];

  // Merge current and prev month data by day
  const comparisonData = currentMonthByDay.map((cur) => {
    const prev = prevMonthByDay.find((p) => p.day === cur.day);
    return {
      day: cur.day,
      [`cur_${metric}`]: cur[metric as keyof typeof cur],
      [`prev_${metric}`]: prev ? prev[metric as keyof typeof prev] : 0,
    };
  });

  const monthData = byMonth.map((d) => ({ ...d, label: d.month }));

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h3 className="font-display font-semibold text-brand-text text-lg">
            {view === "day" ? `${mesActual} vs ${mesAnterior}` : "Evolución mensual"}
          </h3>
          <p className="text-brand-sub text-sm mt-0.5">
            {view === "day"
              ? `Día a día · mismo período del mes anterior`
              : "Ingresos acumulados por mes"}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="flex bg-brand-dark border border-brand-border rounded-lg overflow-hidden">
            {(["revenue", "margen", "orders"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1.5 text-xs font-mono transition-all ${
                  metric === m
                    ? "bg-brand-yellow text-brand-dark font-bold"
                    : "text-brand-sub hover:text-brand-text"
                }`}
              >
                {m === "revenue" ? "$ Ingresos" : m === "margen" ? "$ Margen" : "# Órdenes"}
              </button>
            ))}
          </div>

          <div className="flex bg-brand-dark border border-brand-border rounded-lg overflow-hidden">
            {(["day", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-mono transition-all ${
                  view === v
                    ? "bg-brand-yellow text-brand-dark font-bold"
                    : "text-brand-sub hover:text-brand-text"
                }`}
              >
                {v === "day" ? "Diario" : "Mensual"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        {view === "month" ? (
          <BarChart data={monthData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
            <XAxis
              dataKey="label"
              tickFormatter={formatMonth}
              tick={{ fill: "#8888AA", fontSize: 11, fontFamily: "DM Mono" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={metric !== "orders" ? formatCurrency : undefined}
              tick={{ fill: "#8888AA", fontSize: 11, fontFamily: "DM Mono" }}
              axisLine={false}
              tickLine={false}
              width={55}
            />
            <Tooltip content={<MonthTooltip />} />
            <Bar dataKey={metric} fill="#FFE500" radius={[4, 4, 0, 0]} opacity={0.85} />
          </BarChart>
        ) : (
          <AreaChart data={comparisonData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="curGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFE500" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#FFE500" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="prevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8888AA" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#8888AA" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: "#8888AA", fontSize: 11, fontFamily: "DM Mono" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={metric !== "orders" ? formatCurrency : undefined}
              tick={{ fill: "#8888AA", fontSize: 11, fontFamily: "DM Mono" }}
              axisLine={false}
              tickLine={false}
              width={55}
            />
            <Tooltip content={<ComparisonTooltip metric={metric} />} />
            <Area
              type="monotone"
              dataKey={`prev_${metric}`}
              stroke="#555577"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="url(#prevGrad)"
              dot={false}
              name={mesAnterior}
            />
            <Area
              type="monotone"
              dataKey={`cur_${metric}`}
              stroke="#FFE500"
              strokeWidth={2}
              fill="url(#curGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#FFE500" }}
              name={mesActual}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>

      {view === "day" && (
        <div className="flex gap-6 mt-3 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-6 h-px bg-brand-yellow" style={{ height: 2 }} />
            <span className="text-brand-sub text-xs font-mono">{mesActual}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="24" height="2"><line x1="0" y1="1" x2="24" y2="1" stroke="#555577" strokeWidth="1.5" strokeDasharray="4,3"/></svg>
            <span className="text-brand-sub text-xs font-mono">{mesAnterior}</span>
          </div>
        </div>
      )}
    </div>
  );
}

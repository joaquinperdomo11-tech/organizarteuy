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
} from "recharts";
import { useState } from "react";

interface RevenueChartProps {
  byDay: { date: string; revenue: number; margen: number; orders: number }[];
  byMonth: { month: string; revenue: number; margen: number; orders: number }[];
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatDate(dateStr: string) {
  const [, , day] = dateStr.split("-");
  return `${day}`;
}

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
}

const CustomTooltip = ({ active, payload, label, view }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-3 shadow-xl">
      <p className="text-brand-sub text-xs mb-2 font-mono">
        {view === "day" ? label : formatMonth(label)}
      </p>
      <p className="text-brand-yellow font-display font-bold text-lg">
        {formatCurrency(payload[0]?.value || 0)}
      </p>
      {payload[1] && (
        <p className="text-brand-sub text-xs mt-1 font-mono">
          {payload[1].value} órdenes
        </p>
      )}
    </div>
  );
};

export default function RevenueChart({ byDay, byMonth }: RevenueChartProps) {
  const [view, setView] = useState<"day" | "month">("day");
  const [metric, setMetric] = useState<"revenue" | "margen" | "orders">("revenue");

  const data = view === "day"
    ? byDay.map((d) => ({ ...d, label: formatDate(d.date) }))
    : byMonth.map((d) => ({ ...d, label: d.month }));

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h3 className="font-display font-semibold text-brand-text text-lg">
            Ingresos
          </h3>
          <p className="text-brand-sub text-sm mt-0.5">Evolución temporal</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Metric toggle */}
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

          {/* View toggle */}
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

      <ResponsiveContainer width="100%" height={260}>
        {view === "month" ? (
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
            <XAxis
              dataKey="label"
              tickFormatter={formatMonth}
              tick={{ fill: "#8888AA", fontSize: 11, fontFamily: "DM Mono" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fill: "#8888AA", fontSize: 11, fontFamily: "DM Mono" }}
              axisLine={false}
              tickLine={false}
              width={55}
            />
            <Tooltip content={<CustomTooltip view={view} />} />
            <Bar
              dataKey={metric}
              fill="#FFE500"
              radius={[4, 4, 0, 0]}
              opacity={0.85}
            />
          </BarChart>
        ) : (
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFE500" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#FFE500" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#FF6B35" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#8888AA", fontSize: 11, fontFamily: "DM Mono" }}
              axisLine={false}
              tickLine={false}
              interval={Math.floor(data.length / 6)}
            />
            <YAxis
              tickFormatter={metric === "revenue" ? formatCurrency : undefined}
              tick={{ fill: "#8888AA", fontSize: 11, fontFamily: "DM Mono" }}
              axisLine={false}
              tickLine={false}
              width={55}
            />
            <Tooltip content={<CustomTooltip view={view} />} />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={metric === "revenue" ? "#FFE500" : metric === "margen" ? "#44DDAA" : "#FF6B35"}
              strokeWidth={2}
              fill={metric === "revenue" ? "url(#revenueGrad)" : metric === "margen" ? "url(#margenGrad)" : "url(#ordersGrad)"}
              dot={false}
              activeDot={{ r: 4, fill: metric === "revenue" ? "#FFE500" : metric === "margen" ? "#44DDAA" : "#FF6B35" }}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

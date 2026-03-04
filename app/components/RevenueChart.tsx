"use client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, ReferenceLine,
} from "recharts";
import { useState, useMemo } from "react";

interface RevenueChartProps {
  byDay: { date: string; revenue: number; margen: number; orders: number }[];
  byMonth: { month: string; revenue: number; margen: number; orders: number }[];
  currentMonthByDay: { day: number; revenue: number; margen: number; orders: number }[];
  prevMonthByDay: { day: number; revenue: number; margen: number; orders: number }[];
  projection: {
    projectedRevenue: number;
    projectedMargen: number;
    projectedOrders: number;
    daysElapsed: number;
    daysInMonth: number;
    dailyData: { day: number; revenue: number; margen: number; orders: number }[];
  };
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

const ComparisonTooltip = ({ active, payload, label, metric, daysElapsed }: any) => {
  if (!active || !payload?.length) return null;
  const cur  = payload.find((p: any) => p.dataKey === `cur_${metric}`);
  const prev = payload.find((p: any) => p.dataKey === `prev_${metric}`);
  const proj = payload.find((p: any) => p.dataKey === `proj_${metric}`);
  const isProjected = label > daysElapsed;

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-3 shadow-xl min-w-[180px]">
      <p className="text-brand-sub text-xs mb-2 font-mono">
        Día {label} {isProjected ? <span className="text-[#AA88FF]">· proyectado</span> : ""}
      </p>
      <div className="space-y-1">
        {!isProjected && cur && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-mono text-brand-yellow">Mes actual</span>
            <span className="text-xs font-mono font-bold text-brand-text">
              {metric === "orders" ? cur.value?.toFixed(0) : formatCurrency(cur.value || 0)}
            </span>
          </div>
        )}
        {isProjected && proj && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-mono text-[#AA88FF]">Proyectado</span>
            <span className="text-xs font-mono font-bold text-[#AA88FF]">
              {metric === "orders" ? proj.value?.toFixed(0) : formatCurrency(proj.value || 0)}
            </span>
          </div>
        )}
        {prev && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-mono text-brand-sub">Mes anterior</span>
            <span className="text-xs font-mono text-brand-sub">
              {metric === "orders" ? prev.value?.toFixed(0) : formatCurrency(prev.value || 0)}
            </span>
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

export default function RevenueChart({ byDay, byMonth, currentMonthByDay, prevMonthByDay, projection }: RevenueChartProps) {
  const [view, setView]     = useState<"day" | "month">("day");
  const [metric, setMetric] = useState<"revenue" | "margen" | "orders">("revenue");
  const [showProj, setShowProj] = useState(true);

  const now         = new Date();
  const monthNames  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const mesActual   = monthNames[now.getMonth()];
  const mesAnterior = monthNames[now.getMonth() === 0 ? 11 : now.getMonth() - 1];

  const { daysElapsed, daysInMonth } = projection;

  // Merge current, prev and projection by day (full month)
  const comparisonData = useMemo(() => {
    const maxDays = Math.max(daysInMonth, prevMonthByDay.length > 0 ? Math.max(...prevMonthByDay.map(d => d.day)) : daysInMonth);
    const allDays = Array.from({ length: maxDays }, (_, i) => i + 1);
    return allDays.map(d => {
      const cur  = currentMonthByDay.find(x => x.day === d);
      const prev = prevMonthByDay.find(x => x.day === d);
      const proj = projection.dailyData.find(x => x.day === d);
      const isProjected = d > daysElapsed;

      return {
        day: d,
        [`cur_${metric}`]:  !isProjected && cur  ? cur[metric as keyof typeof cur]  : null,
        [`prev_${metric}`]: prev ? prev[metric as keyof typeof prev] : 0,
        [`proj_${metric}`]: isProjected && proj && showProj ? proj[metric as keyof typeof proj] : null,
      };
    });
  }, [currentMonthByDay, prevMonthByDay, projection, metric, daysElapsed, daysInMonth, showProj]);

  const monthData = byMonth.map(d => ({ ...d, label: d.month }));

  // Projected totals
  const projTotal = metric === "revenue"
    ? projection.projectedRevenue
    : metric === "margen"
    ? projection.projectedMargen
    : projection.projectedOrders;

  const curTotal = metric === "revenue"
    ? currentMonthByDay.reduce((s, d) => s + d.revenue, 0)
    : metric === "margen"
    ? currentMonthByDay.reduce((s, d) => s + d.margen, 0)
    : currentMonthByDay.reduce((s, d) => s + d.orders, 0);

  const pctProgress = projTotal > 0 ? (curTotal / projTotal) * 100 : 0;

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="font-display font-semibold text-brand-text text-lg">
            {view === "day" ? `${mesActual} vs ${mesAnterior}` : "Evolución mensual"}
          </h3>
          <p className="text-brand-sub text-sm mt-0.5">
            {view === "day" ? `Día a día · mismo período del mes anterior` : "Ingresos acumulados por mes"}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Metric selector */}
          <div className="flex bg-brand-dark border border-brand-border rounded-lg overflow-hidden">
            {(["revenue", "margen", "orders"] as const).map(m => (
              <button key={m} onClick={() => setMetric(m)}
                className={`px-3 py-1.5 text-xs font-mono transition-all ${metric === m ? "bg-brand-yellow text-brand-dark font-bold" : "text-brand-sub hover:text-brand-text"}`}>
                {m === "revenue" ? "$ Ingresos" : m === "margen" ? "$ Margen" : "# Órdenes"}
              </button>
            ))}
          </div>

          {/* Projection toggle */}
          {view === "day" && (
            <button onClick={() => setShowProj(!showProj)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border rounded-lg transition-all ${
                showProj ? "border-[#AA88FF]/50 bg-[#AA88FF]/10 text-[#AA88FF]" : "border-brand-border text-brand-sub hover:text-brand-text"
              }`}>
              ◌ Proyección
            </button>
          )}

          {/* View selector */}
          <div className="flex bg-brand-dark border border-brand-border rounded-lg overflow-hidden">
            {(["day", "month"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-mono transition-all ${view === v ? "bg-brand-yellow text-brand-dark font-bold" : "text-brand-sub hover:text-brand-text"}`}>
                {v === "day" ? "Diario" : "Mensual"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Projection summary bar */}
      {view === "day" && showProj && daysElapsed < daysInMonth && (
        <div className="flex items-center gap-4 mb-4 px-4 py-3 bg-[#AA88FF]/5 border border-[#AA88FF]/20 rounded-xl flex-wrap">
          <div>
            <p className="text-[#AA88FF] text-xs font-mono font-bold">
              Proyección {mesActual}: {metric === "orders" ? projTotal.toFixed(0) : formatCurrency(projTotal)}
            </p>
            <p className="text-brand-muted text-xs font-mono">
              Día {daysElapsed} de {daysInMonth} · tendencia últimos {Math.min(7, daysElapsed)} días
            </p>
          </div>
          <div className="flex-1 min-w-32">
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-brand-sub">Avance</span>
              <span className="text-[#AA88FF]">{pctProgress.toFixed(0)}%</span>
            </div>
            <div className="bg-brand-dark rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full bg-[#AA88FF] transition-all duration-700"
                style={{ width: `${Math.min(pctProgress, 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={280}>
        {view === "month" ? (
          <BarChart data={monthData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
            <XAxis dataKey="label" tickFormatter={formatMonth}
              tick={{ fill: "#8888AA", fontSize: 11, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={metric !== "orders" ? formatCurrency : undefined}
              tick={{ fill: "#8888AA", fontSize: 11, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} width={55} />
            <Tooltip content={<MonthTooltip />} />
            <Bar dataKey={metric} fill="#FFE500" radius={[4, 4, 0, 0]} opacity={0.85} />
          </BarChart>
        ) : (
          <AreaChart data={comparisonData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="curGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#FFE500" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#FFE500" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="prevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#8888AA" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#8888AA" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#AA88FF" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#AA88FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "#8888AA", fontSize: 11, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={metric !== "orders" ? formatCurrency : undefined}
              tick={{ fill: "#8888AA", fontSize: 11, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} width={55} />
            <Tooltip content={<ComparisonTooltip metric={metric} daysElapsed={daysElapsed} />} cursor={{ stroke: "#333355" }} />

            {/* Línea vertical separando real de proyectado */}
            {showProj && daysElapsed < daysInMonth && (
              <ReferenceLine x={daysElapsed} stroke="#AA88FF" strokeDasharray="4 4" strokeOpacity={0.4}
                label={{ value: "Hoy", fill: "#AA88FF", fontSize: 10, fontFamily: "DM Mono" }} />
            )}

            {/* Mes anterior */}
            <Area type="monotone" dataKey={`prev_${metric}`}
              stroke="#555577" strokeWidth={1.5} strokeDasharray="4 4"
              fill="url(#prevGrad)" dot={false} connectNulls />

            {/* Mes actual - real */}
            <Area type="monotone" dataKey={`cur_${metric}`}
              stroke="#FFE500" strokeWidth={2}
              fill="url(#curGrad)" dot={false} activeDot={{ r: 4, fill: "#FFE500" }} connectNulls />

            {/* Proyección */}
            {showProj && (
              <Area type="monotone" dataKey={`proj_${metric}`}
                stroke="#AA88FF" strokeWidth={2} strokeDasharray="6 3"
                fill="url(#projGrad)" dot={false} activeDot={{ r: 4, fill: "#AA88FF" }} connectNulls />
            )}
          </AreaChart>
        )}
      </ResponsiveContainer>

      {view === "day" && (
        <div className="flex gap-6 mt-3 justify-center flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-6 bg-brand-yellow" style={{ height: 2 }} />
            <span className="text-brand-sub text-xs font-mono">{mesActual}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="24" height="2"><line x1="0" y1="1" x2="24" y2="1" stroke="#555577" strokeWidth="1.5" strokeDasharray="4,3"/></svg>
            <span className="text-brand-sub text-xs font-mono">{mesAnterior}</span>
          </div>
          {showProj && daysElapsed < daysInMonth && (
            <div className="flex items-center gap-2">
              <svg width="24" height="2"><line x1="0" y1="1" x2="24" y2="1" stroke="#AA88FF" strokeWidth="2" strokeDasharray="6,3"/></svg>
              <span className="text-[#AA88FF] text-xs font-mono">Proyección</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

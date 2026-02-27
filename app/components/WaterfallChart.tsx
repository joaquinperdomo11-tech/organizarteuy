"use client";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

interface WaterfallProps {
  data: { name: string; value: number; total: number; color: string; isTotal: boolean }[];
}

function formatCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// Waterfall con Recharts: barra invisible de base + barra de valor encima
function buildBars(data: WaterfallProps["data"]) {
  let running = 0;
  return data.map((d) => {
    if (d.isTotal) {
      return { ...d, base: 0, bar: d.value };
    }
    const base = d.value < 0 ? running + d.value : running;
    const bar = Math.abs(d.value);
    if (!d.isTotal) running = d.value < 0 ? running + d.value : running + d.value;
    return { ...d, base, bar };
  });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-3 shadow-xl">
      <p className="text-brand-sub text-xs mb-1 font-mono">{label}</p>
      <p className="font-display font-bold text-lg" style={{ color: d?.color }}>
        {d?.value >= 0 ? "+" : ""}{formatCurrency(d?.value || 0)}
      </p>
      {!d?.isTotal && (
        <p className="text-brand-sub text-xs mt-1 font-mono">
          Total acumulado: {formatCurrency(d?.total || 0)}
        </p>
      )}
    </div>
  );
};

export default function WaterfallChart({ data }: WaterfallProps) {
  const bars = buildBars(data);
  const maxVal = Math.max(...data.map((d) => d.total));

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <h3 className="font-display font-semibold text-brand-text text-lg mb-1">
        Desglose Financiero
      </h3>
      <p className="text-brand-sub text-sm mb-6">
        De ingresos brutos al margen real
      </p>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={bars} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#8888AA", fontSize: 10, fontFamily: "DM Sans" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fill: "#8888AA", fontSize: 10, fontFamily: "DM Mono" }}
            axisLine={false}
            tickLine={false}
            width={60}
            domain={[0, maxVal * 1.15]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,229,0,0.04)" }} />

          {/* Barra invisible de base */}
          <Bar dataKey="base" stackId="a" fill="transparent" />

          {/* Barra de valor */}
          <Bar dataKey="bar" stackId="a" radius={[4, 4, 0, 0]}>
            {bars.map((entry, i) => (
              <Cell key={i} fill={entry.color} opacity={entry.isTotal ? 1 : 0.85} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v: number) => (v >= 0 ? "+" : "") + formatCurrency(v)}
              style={{ fill: "#E8E8F0", fontSize: 10, fontFamily: "DM Mono" }}
            />
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 mt-4 justify-center">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="text-brand-sub text-xs font-mono">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

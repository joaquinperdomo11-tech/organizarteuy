"use client";
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { useState, useMemo } from "react";

interface WaterfallProps {
  allOrders: {
    fecha: string;
    totalItem: number;
    comisionML: number;
    shippingCostSeller: number;
    bonificacionEnvio: number;
    margenReal: number;
  }[];
}

function formatCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function getAvailableMonths(orders: WaterfallProps["allOrders"]) {
  const months = new Set<string>();
  orders.forEach((o) => {
    const d = new Date(o.fecha);
    if (!isNaN(d.getTime())) months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  });
  return Array.from(months).sort().reverse();
}

function formatMonthLabel(m: string) {
  const [year, month] = m.split("-");
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${names[parseInt(month) - 1]} ${year.slice(2)}`;
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function buildWaterfall(orders: WaterfallProps["allOrders"]) {
  const totalRevenue = orders.reduce((s, o) => s + o.totalItem, 0);
  const totalComisiones = orders.reduce((s, o) => s + o.comisionML, 0);
  const totalEnvios = orders.reduce((s, o) => s + o.shippingCostSeller, 0);
  const totalBonif = orders.reduce((s, o) => s + o.bonificacionEnvio, 0);
  const totalMargen = orders.reduce((s, o) => s + o.margenReal, 0);

  let running = totalRevenue;
  const steps = [
    { name: "Ingreso bruto", value: totalRevenue, color: "#FFE500", isTotal: false, base: 0, bar: totalRevenue },
    { name: "Comisiones ML", value: -totalComisiones, color: "#FF4466", isTotal: false, base: running - totalComisiones, bar: totalComisiones },
    { name: "Costo envíos", value: -totalEnvios, color: "#FF6B35", isTotal: false, base: (running -= totalComisiones) - totalEnvios, bar: totalEnvios },
    { name: "Bonif. envíos", value: totalBonif, color: "#44DDAA", isTotal: false, base: (running -= totalEnvios), bar: totalBonif },
    { name: "Margen real", value: totalMargen, color: "#88AAFF", isTotal: true, base: 0, bar: totalMargen },
  ];

  return { steps, totalRevenue, totalMargen };
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
    </div>
  );
};

export default function WaterfallChart({ allOrders }: WaterfallProps) {
  const availableMonths = useMemo(() => getAvailableMonths(allOrders), [allOrders]);
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const [showPicker, setShowPicker] = useState(false);

  const filteredOrders = useMemo(() => {
    if (selectedMonth === "year") {
      const year = new Date().getFullYear();
      return allOrders.filter((o) => new Date(o.fecha).getFullYear() === year);
    }
    return allOrders.filter((o) => {
      const d = new Date(o.fecha);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === selectedMonth;
    });
  }, [allOrders, selectedMonth]);

  const { steps, totalRevenue, totalMargen } = useMemo(() => buildWaterfall(filteredOrders), [filteredOrders]);
  const margenPct = totalRevenue > 0 ? (totalMargen / totalRevenue) * 100 : 0;
  const maxVal = Math.max(...steps.map((s) => s.base + s.bar));

  const filterLabel = selectedMonth === "year"
    ? `Año ${new Date().getFullYear()}`
    : availableMonths.includes(selectedMonth) ? formatMonthLabel(selectedMonth) : "Mes actual";

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="font-display font-semibold text-brand-text text-lg mb-0.5">Desglose Financiero</h3>
          <p className="text-brand-sub text-sm">De ingresos brutos al margen real</p>
        </div>

        {/* Period picker */}
        <div className="relative">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="px-3 py-1.5 text-xs font-mono border border-brand-border rounded-lg text-brand-sub hover:text-brand-text transition-all"
          >
            📅 {filterLabel}
          </button>
          {showPicker && (
            <div className="absolute right-0 top-9 z-20 bg-brand-card border border-brand-border rounded-xl shadow-xl p-3 min-w-[160px]">
              <button
                onClick={() => { setSelectedMonth(getCurrentMonthKey()); setShowPicker(false); }}
                className={`w-full text-left px-2 py-1.5 text-xs font-mono rounded-lg mb-1 ${selectedMonth === getCurrentMonthKey() ? "bg-brand-yellow/10 text-brand-yellow" : "text-brand-sub hover:text-brand-text"}`}
              >
                Mes actual
              </button>
              <button
                onClick={() => { setSelectedMonth("year"); setShowPicker(false); }}
                className={`w-full text-left px-2 py-1.5 text-xs font-mono rounded-lg mb-1 ${selectedMonth === "year" ? "bg-brand-yellow/10 text-brand-yellow" : "text-brand-sub hover:text-brand-text"}`}
              >
                Año {new Date().getFullYear()}
              </button>
              <div className="border-t border-brand-border my-1" />
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {availableMonths.map((m) => (
                  <button
                    key={m}
                    onClick={() => { setSelectedMonth(m); setShowPicker(false); }}
                    className={`w-full text-left px-2 py-1.5 text-xs font-mono rounded-lg ${selectedMonth === m ? "bg-brand-yellow/10 text-brand-yellow" : "text-brand-sub hover:text-brand-text"}`}
                  >
                    {formatMonthLabel(m)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={steps} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#8888AA", fontSize: 10, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatCurrency} tick={{ fill: "#8888AA", fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} width={60} domain={[0, maxVal * 1.2]} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,229,0,0.04)" }} />
          <Bar dataKey="base" stackId="a" fill="transparent" />
          <Bar dataKey="bar" stackId="a" radius={[4, 4, 0, 0]}>
            {steps.map((entry, i) => <Cell key={i} fill={entry.color} opacity={entry.isTotal ? 1 : 0.85} />)}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v: number) => (v >= 0 ? "+" : "") + formatCurrency(v)}
              style={{ fill: "#E8E8F0", fontSize: 10, fontFamily: "DM Mono" }}
            />
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3 mt-4 justify-center">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-yellow/10 rounded-full">
          <div className="w-2 h-2 rounded-sm bg-brand-yellow" />
          <span className="text-brand-yellow text-xs font-mono font-bold">{formatCurrency(totalRevenue)}</span>
          <span className="text-brand-sub text-xs font-mono">ingresos</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#88AAFF]/10 rounded-full">
          <div className="w-2 h-2 rounded-sm bg-[#88AAFF]" />
          <span className="text-[#88AAFF] text-xs font-mono font-bold">{formatCurrency(totalMargen)}</span>
          <span className="text-brand-sub text-xs font-mono">margen ({margenPct.toFixed(1)}%)</span>
        </div>
      </div>
    </div>
  );
}

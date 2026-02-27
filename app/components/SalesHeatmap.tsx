"use client";
import { useState, useMemo } from "react";

interface HeatmapProps {
  allOrders: { fecha: string; hora: string; totalItem: number }[];
}

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "rgba(30,30,46,0.8)";
  const intensity = value / max;
  if (intensity < 0.25) return `rgba(255,229,0,${0.15 + intensity * 0.4})`;
  if (intensity < 0.5) return `rgba(255,229,0,${0.35 + intensity * 0.4})`;
  if (intensity < 0.75) return `rgba(255,150,0,${0.5 + intensity * 0.3})`;
  return `rgba(255,107,53,${0.7 + intensity * 0.3})`;
}

function parseHora(horaStr: string): number {
  try {
    const d = new Date(horaStr);
    if (!isNaN(d.getTime())) return d.getUTCHours();
  } catch {}
  const parts = horaStr.split(":");
  if (parts.length >= 1) return parseInt(parts[0]) || 0;
  return 0;
}

function getAvailableMonths(orders: HeatmapProps["allOrders"]) {
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

export default function SalesHeatmap({ allOrders }: HeatmapProps) {
  const [metric, setMetric] = useState<"count" | "revenue">("count");
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const [showPicker, setShowPicker] = useState(false);

  const availableMonths = useMemo(() => getAvailableMonths(allOrders), [allOrders]);

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

  const heatmapData = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    filteredOrders.forEach((o) => {
      const d = new Date(o.fecha);
      if (isNaN(d.getTime())) return;
      const day = d.getUTCDay();
      const hour = parseHora(o.hora);
      const key = `${day}-${hour}`;
      if (!map[key]) map[key] = { count: 0, revenue: 0 };
      map[key].count += 1;
      map[key].revenue += o.totalItem;
    });
    return map;
  }, [filteredOrders]);

  const getValue = (day: number, hour: number) => heatmapData[`${day}-${hour}`]?.[metric] || 0;
  const maxVal = Math.max(...Object.values(heatmapData).map((d) => d[metric]), 1);

  const dayTotals = DAYS.map((_, day) =>
    HOURS.reduce((s, hour) => s + (heatmapData[`${day}-${hour}`]?.[metric] || 0), 0)
  );
  const hourTotals = HOURS.map((hour) =>
    DAYS.reduce((s, _, day) => s + (heatmapData[`${day}-${hour}`]?.[metric] || 0), 0)
  );
  const maxDayTotal = Math.max(...dayTotals, 1);
  const maxHourTotal = Math.max(...hourTotals, 1);

  const formatVal = (v: number) => {
    if (metric === "revenue") return v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v.toFixed(0)}`;
    return String(v);
  };

  const filterLabel = selectedMonth === "year"
    ? `Año ${new Date().getFullYear()}`
    : availableMonths.includes(selectedMonth) ? formatMonthLabel(selectedMonth) : "Mes actual";

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="font-display font-semibold text-brand-text text-lg mb-0.5">Mapa de Calor</h3>
          <p className="text-brand-sub text-sm">Actividad por día y hora</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Metric toggle */}
          <div className="flex bg-brand-dark border border-brand-border rounded-lg overflow-hidden">
            {(["count", "revenue"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1.5 text-xs font-mono transition-all ${metric === m ? "bg-brand-yellow text-brand-dark font-bold" : "text-brand-sub hover:text-brand-text"}`}
              >
                {m === "count" ? "# Órdenes" : "$ Ingresos"}
              </button>
            ))}
          </div>

          {/* Month picker */}
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
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 600 }}>
          <div className="flex mb-1 ml-10">
            {HOURS.map((h) => (
              <div key={h} className="flex-1 text-center font-mono text-brand-muted" style={{ fontSize: 9 }}>
                {h % 3 === 0 ? `${h}h` : ""}
              </div>
            ))}
          </div>

          {DAYS.map((day, dayIdx) => (
            <div key={day} className="flex items-center mb-1">
              <div className="w-10 text-right pr-2 font-mono text-brand-sub shrink-0" style={{ fontSize: 11 }}>{day}</div>
              {HOURS.map((hour) => {
                const val = getValue(dayIdx, hour);
                return (
                  <div
                    key={hour}
                    className="flex-1 mx-px rounded-sm transition-all duration-200 hover:ring-1 hover:ring-brand-yellow/50 cursor-default group relative"
                    style={{ height: 28, background: getColor(val, maxVal) }}
                  >
                    {val > 0 && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-brand-dark border border-brand-border rounded px-2 py-1 text-xs font-mono text-brand-text whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                        {day} {hour}:00 · {formatVal(val)}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="w-14 text-right pl-2 font-mono shrink-0" style={{ fontSize: 10 }}>
                <span className="font-bold" style={{ color: dayTotals[dayIdx] === maxDayTotal ? "#FFE500" : "#8888AA" }}>
                  {formatVal(dayTotals[dayIdx])}
                </span>
              </div>
            </div>
          ))}

          <div className="flex mt-2 ml-10">
            {HOURS.map((h) => (
              <div key={h} className="flex-1 text-center font-mono" style={{ fontSize: 9, color: hourTotals[h] === maxHourTotal ? "#FFE500" : "#555577" }}>
                {hourTotals[h] > 0 ? formatVal(hourTotals[h]) : ""}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 justify-end">
        <span className="text-brand-muted text-xs font-mono">Bajo</span>
        <div className="flex gap-0.5">
          {[0.1, 0.25, 0.45, 0.65, 0.85, 1].map((i) => (
            <div key={i} className="w-5 h-3 rounded-sm" style={{ background: getColor(i * maxVal, maxVal) }} />
          ))}
        </div>
        <span className="text-brand-muted text-xs font-mono">Alto</span>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";

interface HeatmapProps {
  data: { day: number; hour: number; count: number; revenue: number }[];
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

export default function SalesHeatmap({ data }: HeatmapProps) {
  const [metric, setMetric] = useState<"count" | "revenue">("count");

  const getValue = (day: number, hour: number) => {
    const cell = data.find((d) => d.day === day && d.hour === hour);
    return cell ? cell[metric] : 0;
  };

  const maxVal = Math.max(...data.map((d) => d[metric]));

  // Totales por día y hora para los labels
  const dayTotals = DAYS.map((_, day) =>
    data.filter((d) => d.day === day).reduce((s, d) => s + d[metric], 0)
  );
  const hourTotals = HOURS.map((hour) =>
    data.filter((d) => d.hour === hour).reduce((s, d) => s + d[metric], 0)
  );
  const maxDayTotal = Math.max(...dayTotals);
  const maxHourTotal = Math.max(...hourTotals);

  const formatVal = (v: number) => {
    if (metric === "revenue") {
      if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
      return `$${v.toFixed(0)}`;
    }
    return String(v);
  };

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="font-display font-semibold text-brand-text text-lg mb-1">
            Mapa de Calor — Ventas
          </h3>
          <p className="text-brand-sub text-sm">Actividad por día y hora</p>
        </div>
        <div className="flex bg-brand-dark border border-brand-border rounded-lg overflow-hidden">
          {(["count", "revenue"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1.5 text-xs font-mono transition-all ${
                metric === m
                  ? "bg-brand-yellow text-brand-dark font-bold"
                  : "text-brand-sub hover:text-brand-text"
              }`}
            >
              {m === "count" ? "# Órdenes" : "$ Ingresos"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 600 }}>
          {/* Hora labels arriba */}
          <div className="flex mb-1 ml-10">
            {HOURS.map((h) => (
              <div
                key={h}
                className="flex-1 text-center font-mono text-brand-muted"
                style={{ fontSize: 9 }}
              >
                {h % 3 === 0 ? `${h}h` : ""}
              </div>
            ))}
          </div>

          {/* Filas por día */}
          {DAYS.map((day, dayIdx) => (
            <div key={day} className="flex items-center mb-1">
              {/* Día label */}
              <div className="w-10 text-right pr-2 font-mono text-brand-sub shrink-0" style={{ fontSize: 11 }}>
                {day}
              </div>

              {/* Celdas */}
              {HOURS.map((hour) => {
                const val = getValue(dayIdx, hour);
                return (
                  <div
                    key={hour}
                    className="flex-1 mx-px rounded-sm transition-all duration-200 hover:ring-1 hover:ring-brand-yellow/50 cursor-default group relative"
                    style={{
                      height: 28,
                      background: getColor(val, maxVal),
                    }}
                    title={`${day} ${hour}:00 — ${formatVal(val)}`}
                  >
                    {/* Tooltip on hover */}
                    {val > 0 && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-brand-dark border border-brand-border rounded px-2 py-1 text-xs font-mono text-brand-text whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                        {day} {hour}:00 · {formatVal(val)}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Total del día */}
              <div className="w-14 text-right pl-2 font-mono shrink-0" style={{ fontSize: 10 }}>
                <span
                  className="font-bold"
                  style={{
                    color: dayTotals[dayIdx] === maxDayTotal ? "#FFE500" : "#8888AA",
                  }}
                >
                  {formatVal(dayTotals[dayIdx])}
                </span>
              </div>
            </div>
          ))}

          {/* Totales por hora abajo */}
          <div className="flex mt-2 ml-10">
            {HOURS.map((h) => (
              <div
                key={h}
                className="flex-1 text-center font-mono"
                style={{
                  fontSize: 9,
                  color: hourTotals[h] === maxHourTotal ? "#FFE500" : "#555577",
                }}
              >
                {hourTotals[h] > 0 ? formatVal(hourTotals[h]) : ""}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Escala */}
      <div className="flex items-center gap-2 mt-4 justify-end">
        <span className="text-brand-muted text-xs font-mono">Bajo</span>
        <div className="flex gap-0.5">
          {[0.1, 0.25, 0.45, 0.65, 0.85, 1].map((i) => (
            <div
              key={i}
              className="w-5 h-3 rounded-sm"
              style={{ background: getColor(i * maxVal, maxVal) }}
            />
          ))}
        </div>
        <span className="text-brand-muted text-xs font-mono">Alto</span>
      </div>
    </div>
  );
}

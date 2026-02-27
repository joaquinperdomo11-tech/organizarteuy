"use client";
import { useState } from "react";
import clsx from "clsx";

interface SkuPerformanceProps {
  data: {
    sku: string;
    name: string;
    units: number;
    revenue: number;
    margen: number;
    comision: number;
    envio: number;
    margenPct: number;
  }[];
}

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function MargenBar({ pct }: { pct: number }) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  const color =
    pct >= 50 ? "#44DDAA" :
    pct >= 30 ? "#FFE500" :
    pct >= 15 ? "#FF6B35" : "#FF4466";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-brand-dark rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
      <span className="font-mono text-xs w-10 text-right" style={{ color }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

type SortKey = "revenue" | "margen" | "margenPct" | "units";

export default function SkuPerformance({ data }: SkuPerformanceProps) {
  const [sortBy, setSortBy] = useState<SortKey>("revenue");
  const [search, setSearch] = useState("");

  const filtered = data
    .filter((d) => {
      const q = search.toLowerCase();
      return !q || d.sku.toLowerCase().includes(q) || d.name.toLowerCase().includes(q);
    })
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-brand-border">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div>
            <h3 className="font-display font-semibold text-brand-text text-lg">
              Performance por SKU
            </h3>
            <p className="text-brand-sub text-sm mt-0.5">
              {filtered.length} SKUs · Ordenado por{" "}
              <span className="text-brand-yellow">{sortBy}</span>
            </p>
          </div>

          {/* Sort buttons */}
          <div className="flex bg-brand-dark border border-brand-border rounded-lg overflow-hidden">
            {(["revenue", "margen", "margenPct", "units"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1.5 text-xs font-mono transition-all ${
                  sortBy === s
                    ? "bg-brand-yellow text-brand-dark font-bold"
                    : "text-brand-sub hover:text-brand-text"
                }`}
              >
                {s === "revenue" ? "Ingresos" : s === "margen" ? "Margen $" : s === "margenPct" ? "Margen %" : "Unidades"}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Buscar SKU o producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-brand-dark border border-brand-border text-brand-text text-sm rounded-lg px-4 py-2 pl-8 focus:outline-none focus:border-brand-yellow/50 font-body placeholder:text-brand-muted transition-colors"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted text-xs">🔍</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="text-left px-6 py-3 text-brand-sub font-mono text-xs uppercase tracking-wider">#</th>
              <th className="text-left px-4 py-3 text-brand-sub font-mono text-xs uppercase tracking-wider">SKU / Producto</th>
              <th className="text-right px-4 py-3 text-brand-sub font-mono text-xs uppercase tracking-wider">Uds.</th>
              <th className="text-right px-4 py-3 text-brand-sub font-mono text-xs uppercase tracking-wider">Ingresos</th>
              <th className="text-right px-4 py-3 text-brand-sub font-mono text-xs uppercase tracking-wider">Comisión</th>
              <th className="text-right px-4 py-3 text-brand-sub font-mono text-xs uppercase tracking-wider">Envío</th>
              <th className="text-right px-4 py-3 text-brand-sub font-mono text-xs uppercase tracking-wider">Margen $</th>
              <th className="px-4 py-3 text-brand-sub font-mono text-xs uppercase tracking-wider" style={{ minWidth: 160 }}>Margen %</th>
              <th className="text-right px-4 py-3 text-brand-sub font-mono text-xs uppercase tracking-wider">% del total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => {
              const sharePct = totalRevenue > 0 ? (d.revenue / totalRevenue) * 100 : 0;
              const margenColor =
                d.margenPct >= 50 ? "text-emerald-400" :
                d.margenPct >= 30 ? "text-yellow-400" :
                d.margenPct >= 15 ? "text-orange-400" : "text-red-400";

              return (
                <tr
                  key={d.sku}
                  className="border-b border-brand-border/40 hover:bg-brand-dark/50 transition-colors"
                >
                  <td className="px-6 py-3 text-brand-muted font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-brand-yellow text-xs font-bold">{d.sku}</p>
                    <p className="text-brand-sub text-xs mt-0.5 max-w-[220px] truncate" title={d.name}>
                      {d.name}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-brand-text text-xs">{d.units}</td>
                  <td className="px-4 py-3 text-right font-mono text-brand-text text-xs font-medium">
                    {formatCurrency(d.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-400/70 text-xs">
                    -{formatCurrency(d.comision)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-orange-400/70 text-xs">
                    {d.envio > 0 ? `-${formatCurrency(d.envio)}` : <span className="text-brand-muted">—</span>}
                  </td>
                  <td className={clsx("px-4 py-3 text-right font-mono text-xs font-bold", margenColor)}>
                    {formatCurrency(d.margen)}
                  </td>
                  <td className="px-4 py-3" style={{ minWidth: 160 }}>
                    <MargenBar pct={d.margenPct} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-brand-dark rounded-full h-1 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-yellow/50"
                          style={{ width: `${Math.min(sharePct, 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-brand-sub text-xs w-10 text-right">
                        {sharePct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Leyenda margen */}
      <div className="px-6 py-3 border-t border-brand-border flex flex-wrap gap-4">
        <span className="text-brand-muted text-xs font-mono">Margen %:</span>
        {[
          { label: "≥50% Excelente", color: "text-emerald-400" },
          { label: "≥30% Bueno", color: "text-yellow-400" },
          { label: "≥15% Regular", color: "text-orange-400" },
          { label: "<15% Bajo", color: "text-red-400" },
        ].map((l) => (
          <span key={l.label} className={`text-xs font-mono ${l.color}`}>{l.label}</span>
        ))}
      </div>
    </div>
  );
}

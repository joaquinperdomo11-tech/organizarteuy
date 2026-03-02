"use client";
import { useState, useMemo } from "react";
import clsx from "clsx";
import { useAds, monthKeyToLabel } from "./AdsContext";

interface SkuPerformanceProps {
  data: {
    sku: string;
    name: string;
    itemIdML: string;
    units: number;
    revenue: number;
    margen: number;
    comision: number;
    envio: number;
    margenPct: number;
  }[];
}

function formatCurrency(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function MargenBar({ pct, pctAds }: { pct: number; pctAds?: number }) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  const color =
    pct >= 50 ? "#44DDAA" :
    pct >= 30 ? "#FFE500" :
    pct >= 15 ? "#FF6B35" : "#FF4466";

  const clampedAds = pctAds !== undefined ? Math.min(Math.max(pctAds, 0), 100) : null;
  const colorAds =
    pctAds === undefined ? "" :
    pctAds >= 50 ? "#44DDAA" :
    pctAds >= 30 ? "#FFE500" :
    pctAds >= 15 ? "#FF6B35" : "#FF4466";

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-brand-dark rounded-full h-1.5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${clamped}%`, background: color }} />
        </div>
        <span className="font-mono text-xs w-10 text-right" style={{ color }}>{pct.toFixed(1)}%</span>
      </div>
      {clampedAds !== null && pctAds !== undefined && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-brand-dark rounded-full h-1 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700 opacity-70" style={{ width: `${clampedAds}%`, background: colorAds }} />
          </div>
          <span className="font-mono text-xs w-10 text-right opacity-70" style={{ color: colorAds }}>{pctAds.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

type SortKey = "revenue" | "margen" | "margenPct" | "units" | "margenConAds" | "inversion";

export default function SkuPerformance({ data }: SkuPerformanceProps) {
  const [sortBy, setSortBy] = useState<SortKey>("revenue");
  const [search, setSearch] = useState("");
  const [showAds, setShowAds] = useState(true);

  const { getInversionForMonth, getTotalInversionForMonth, months } = useAds();

  // Use the most recent loaded month for SKU performance
  // (SKU performance is all-time, so we use the latest ads month as reference)
  const latestAdsMonth = months[months.length - 1];
  const hasAds = !!latestAdsMonth;
  const totalInversion = latestAdsMonth ? latestAdsMonth.totalInversion : 0;
  const periodo = latestAdsMonth ? `${latestAdsMonth.desde} — ${latestAdsMonth.hasta}` : "";

  // Enrich data with ads
  const enriched = useMemo(() => {
    if (!latestAdsMonth) return data.map(d => ({ ...d, inversion: 0, margenConAds: d.margen, margenConAdsPct: d.margenPct }));
    return data.map(d => {
      const inversion = getInversionForMonth(latestAdsMonth.monthKey, d.itemIdML);
      const margenConAds = d.margen - inversion;
      const margenConAdsPct = d.revenue > 0 ? (margenConAds / d.revenue) * 100 : 0;
      return { ...d, inversion, margenConAds, margenConAdsPct };
    });
  }, [data, latestAdsMonth, getInversionForMonth]);

  const filtered = useMemo(() => {
    return enriched
      .filter(d => {
        const q = search.toLowerCase();
        return !q || d.sku.toLowerCase().includes(q) || d.name.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sortBy === "margenConAds") return b.margenConAds - a.margenConAds;
        if (sortBy === "inversion") return b.inversion - a.inversion;
        return b[sortBy as keyof typeof a] as number - (a[sortBy as keyof typeof a] as number);
      });
  }, [enriched, search, sortBy]);

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalMargen = data.reduce((s, d) => s + d.margen, 0);
  const totalMargenConAds = totalMargen - totalInversion;

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-brand-border">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div>
            <h3 className="font-display font-semibold text-brand-text text-lg">Performance por SKU</h3>
            <p className="text-brand-sub text-sm mt-0.5">
              {filtered.length} SKUs · Ordenado por <span className="text-brand-yellow">{sortBy}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {hasAds && (
              <button onClick={() => setShowAds(!showAds)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border rounded-lg transition-all ${
                  showAds ? "border-[#CC44FF]/50 bg-[#CC44FF]/10 text-[#CC44FF]" : "border-brand-border text-brand-sub hover:text-brand-text"
                }`}>
                📣 {showAds ? "Mostrando ads" : "Sin ads"}
              </button>
            )}
            <div className="flex bg-brand-dark border border-brand-border rounded-lg overflow-hidden">
              {(["revenue", "margen", "margenPct", "units"] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-3 py-1.5 text-xs font-mono transition-all ${sortBy === s ? "bg-brand-yellow text-brand-dark font-bold" : "text-brand-sub hover:text-brand-text"}`}>
                  {s === "revenue" ? "Ingresos" : s === "margen" ? "Margen $" : s === "margenPct" ? "Margen %" : "Unidades"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ads summary bar */}
        {hasAds && showAds && (
          <div className="flex items-center gap-4 mb-4 px-4 py-3 bg-[#CC44FF]/5 border border-[#CC44FF]/20 rounded-xl flex-wrap">
            <span className="text-[#CC44FF] text-xs font-mono">📣 {periodo}</span>
            <span className="text-brand-sub text-xs font-mono">Inversión total: <span className="text-[#CC44FF] font-bold">{formatCurrency(totalInversion)}</span></span>
            <span className="text-brand-sub text-xs font-mono">Margen s/ads: <span className="text-[#88AAFF] font-bold">{formatCurrency(totalMargen)}</span></span>
            <span className="text-brand-sub text-xs font-mono">Margen c/ads: <span className="text-[#5599FF] font-bold">{formatCurrency(totalMargenConAds)}</span></span>
          </div>
        )}

        <div className="relative">
          <input type="text" placeholder="Buscar SKU o producto..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-brand-dark border border-brand-border text-brand-text text-sm rounded-lg px-4 py-2 pl-8 focus:outline-none focus:border-brand-yellow/50 font-body placeholder:text-brand-muted transition-colors" />
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
              {hasAds && showAds && (
                <>
                  <th className="text-right px-4 py-3 text-[#CC44FF] font-mono text-xs uppercase tracking-wider">Publicidad</th>
                  <th className="text-right px-4 py-3 text-[#5599FF] font-mono text-xs uppercase tracking-wider">Margen c/ads</th>
                </>
              )}
              <th className="px-4 py-3 text-brand-sub font-mono text-xs uppercase tracking-wider" style={{ minWidth: 160 }}>
                {hasAds && showAds ? "Margen % (s/ads · c/ads)" : "Margen %"}
              </th>
              <th className="text-right px-4 py-3 text-brand-sub font-mono text-xs uppercase tracking-wider">% total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => {
              const sharePct = totalRevenue > 0 ? (d.revenue / totalRevenue) * 100 : 0;
              const margenColor =
                d.margenPct >= 50 ? "text-emerald-400" :
                d.margenPct >= 30 ? "text-yellow-400" :
                d.margenPct >= 15 ? "text-orange-400" : "text-red-400";
              const margenAdsColor =
                d.margenConAdsPct >= 50 ? "text-emerald-400" :
                d.margenConAdsPct >= 30 ? "text-yellow-400" :
                d.margenConAdsPct >= 15 ? "text-orange-400" : "text-red-400";

              return (
                <tr key={d.sku} className="border-b border-brand-border/40 hover:bg-brand-dark/50 transition-colors">
                  <td className="px-6 py-3 text-brand-muted font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-brand-yellow text-xs font-bold">{d.sku}</p>
                    <p className="text-brand-sub text-xs mt-0.5 max-w-[220px] truncate" title={d.name}>{d.name}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-brand-text text-xs">{d.units}</td>
                  <td className="px-4 py-3 text-right font-mono text-brand-text text-xs font-medium">{formatCurrency(d.revenue)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-400/70 text-xs">-{formatCurrency(d.comision)}</td>
                  <td className="px-4 py-3 text-right font-mono text-orange-400/70 text-xs">
                    {d.envio > 0 ? `-${formatCurrency(d.envio)}` : <span className="text-brand-muted">—</span>}
                  </td>
                  <td className={clsx("px-4 py-3 text-right font-mono text-xs font-bold", margenColor)}>{formatCurrency(d.margen)}</td>
                  {hasAds && showAds && (
                    <>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {d.inversion > 0
                          ? <span className="text-[#CC44FF]">-{formatCurrency(d.inversion)}</span>
                          : <span className="text-brand-muted">—</span>}
                      </td>
                      <td className={clsx("px-4 py-3 text-right font-mono text-xs font-bold", margenAdsColor)}>
                        {d.inversion > 0 ? formatCurrency(d.margenConAds) : <span className="text-brand-muted">—</span>}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3" style={{ minWidth: 160 }}>
                    <MargenBar
                      pct={d.margenPct}
                      pctAds={hasAds && showAds && d.inversion > 0 ? d.margenConAdsPct : undefined}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-brand-dark rounded-full h-1 overflow-hidden">
                        <div className="h-full rounded-full bg-brand-yellow/50" style={{ width: `${Math.min(sharePct, 100)}%` }} />
                      </div>
                      <span className="font-mono text-brand-sub text-xs w-10 text-right">{sharePct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t border-brand-border flex flex-wrap gap-4">
        <span className="text-brand-muted text-xs font-mono">Margen %:</span>
        {[
          { label: "≥50% Excelente", color: "text-emerald-400" },
          { label: "≥30% Bueno", color: "text-yellow-400" },
          { label: "≥15% Regular", color: "text-orange-400" },
          { label: "<15% Bajo", color: "text-red-400" },
        ].map(l => (
          <span key={l.label} className={`text-xs font-mono ${l.color}`}>{l.label}</span>
        ))}
        {hasAds && showAds && <span className="text-xs font-mono text-[#CC44FF]">· Barra inferior = margen c/ads</span>}
      </div>
    </div>
  );
}

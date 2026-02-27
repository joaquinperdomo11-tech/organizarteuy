"use client";
import { useEffect, useState, useCallback } from "react";
import type { DashboardData } from "@/lib/sheets";
import StatCard from "./StatCard";
import RevenueChart from "./RevenueChart";
import { TopProductsChart, StatusChart } from "./Charts";
import OrdersTable from "./OrdersTable";
import WaterfallChart from "./WaterfallChart";
import SalesHeatmap from "./SalesHeatmap";
import SkuPerformance from "./SkuPerformance";

function Skeleton({ className }: { className: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || `Error ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const { summary, currentMonth, prevMonth } = data || {};

  function pct(cur?: number, prev?: number) {
    if (!prev || prev === 0) return undefined;
    return ((( cur || 0) - prev) / prev) * 100;
  }

  return (
    <div className="min-h-screen">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-brand-border bg-brand-dark/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-yellow rounded-lg flex items-center justify-center text-brand-dark font-bold text-sm font-display">
              ML
            </div>
            <div>
              <h1 className="font-display font-bold text-brand-text text-lg leading-none">
                Dashboard Ventas
              </h1>
              <p className="text-brand-sub text-xs mt-0.5 font-mono">
                MercadoLibre · Datos en tiempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {lastUpdated && (
              <p className="text-brand-muted text-xs font-mono hidden sm:block">
                ↻ {lastUpdated.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-brand-border rounded-lg text-brand-sub hover:border-brand-yellow/50 hover:text-brand-yellow transition-all disabled:opacity-50"
            >
              <span className={loading ? "animate-spin inline-block" : "inline-block"}>↻</span>
              Actualizar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-8">

        {/* ── Error ──────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
            <p className="text-red-400 font-mono text-sm font-bold">⚠ Error al cargar datos</p>
            <p className="text-red-400/70 text-xs mt-1 font-mono">{error}</p>
            <p className="text-brand-sub text-xs mt-3">
              Verificá que la variable <code className="text-brand-yellow bg-brand-dark px-1 rounded">APPS_SCRIPT_URL</code> esté configurada correctamente.
            </p>
          </div>
        )}

        {/* ── KPIs fila 1: financieros ───────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-brand-sub text-xs font-mono uppercase tracking-widest">
              Resumen financiero — Mes actual
            </p>
            <p className="text-brand-muted text-xs font-mono">vs mismo período mes anterior</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-2xl" />
              ))
            ) : (
              <>
                <div className="col-span-2 sm:col-span-1">
                  <StatCard
                    label="Ingresos brutos"
                    value={currentMonth?.revenue || 0}
                    prefix="$"
                    accent
                    delay={0}
                    icon="💰"
                    trend={pct(currentMonth?.revenue, prevMonth?.revenue)}
                  />
                </div>
                <StatCard
                  label="Margen real"
                  value={currentMonth?.margen || 0}
                  prefix="$"
                  delay={80}
                  icon="📈"
                  sub={`${currentMonth?.margenPct.toFixed(1) || 0}% del total`}
                  trend={pct(currentMonth?.margen, prevMonth?.margen)}
                />
                <StatCard
                  label="Comisiones ML"
                  value={currentMonth?.comisiones || 0}
                  prefix="$"
                  delay={160}
                  icon="🏦"
                  trend={pct(currentMonth?.comisiones, prevMonth?.comisiones)}
                />
                <StatCard
                  label="Costo envíos neto"
                  value={currentMonth?.envios || 0}
                  prefix="$"
                  delay={240}
                  icon="📦"
                  trend={pct(currentMonth?.envios, prevMonth?.envios)}
                />
                <StatCard
                  label="Ticket promedio"
                  value={currentMonth?.avgOrderValue || 0}
                  prefix="$"
                  delay={320}
                  icon="🎯"
                  sub={`Margen prom. $${currentMonth?.avgMargen.toFixed(0) || 0}`}
                  trend={pct(currentMonth?.avgOrderValue, prevMonth?.avgOrderValue)}
                />
              </>
            )}
          </div>
        </section>

        {/* ── KPIs fila 2: operativos ────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-brand-sub text-xs font-mono uppercase tracking-widest">
              Operaciones — Mes actual
            </p>
            <p className="text-brand-muted text-xs font-mono">vs mismo período mes anterior</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))
            ) : (
              <>
                <StatCard
                  label="Total órdenes"
                  value={currentMonth?.orders || 0}
                  delay={0}
                  icon="🛒"
                  trend={pct(currentMonth?.orders, prevMonth?.orders)}
                />
                <StatCard
                  label="Unidades vendidas"
                  value={currentMonth?.units || 0}
                  delay={80}
                  icon="📊"
                  trend={pct(currentMonth?.units, prevMonth?.units)}
                />
                <StatCard
                  label="Margen %"
                  value={currentMonth?.margenPct || 0}
                  suffix="%"
                  decimals={1}
                  delay={160}
                  icon="💹"
                  trend={pct(currentMonth?.margenPct, prevMonth?.margenPct)}
                />
                <StatCard
                  label="Margen por orden"
                  value={currentMonth?.avgMargen || 0}
                  prefix="$"
                  delay={240}
                  icon="⚡"
                  trend={pct(currentMonth?.avgMargen, prevMonth?.avgMargen)}
                />
              </>
            )}
          </div>
        </section>

        {/* ── Gráfico ingresos ───────────────────────────────────── */}
        <section>
          {loading ? (
            <Skeleton className="h-80 rounded-2xl" />
          ) : (
            <RevenueChart
              byDay={data?.revenueByDay || []}
              byMonth={data?.revenueByMonth || []}
              currentMonthByDay={data?.revenueCurrentMonth || []}
              prevMonthByDay={data?.revenuePrevMonth || []}
            />
          )}
        </section>

        {/* ── Top productos + Tipo envío ──────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loading ? (
            <>
              <Skeleton className="h-80 rounded-2xl" />
              <Skeleton className="h-80 rounded-2xl" />
            </>
          ) : (
            <>
              <TopProductsChart products={data?.topProducts || []} allOrders={data?.orders || []} />
              <StatusChart data={data?.tipoEnvioBreakdown || []} />
            </>
          )}
        </section>

        {/* ── Medio de pago + Cuotas ─────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loading ? (
            <>
              <Skeleton className="h-72 rounded-2xl" />
              <Skeleton className="h-72 rounded-2xl" />
            </>
          ) : (
            <>
              <MedioPagoChart data={data?.medioPagoBreakdown || []} />
              <CuotasChart data={data?.cuotasBreakdown || []} />
            </>
          )}
        </section>

        {/* ── Waterfall + Heatmap ────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loading ? (
            <>
              <Skeleton className="h-80 rounded-2xl" />
              <Skeleton className="h-80 rounded-2xl" />
            </>
          ) : (
            <>
              <WaterfallChart allOrders={data?.orders || []} />
              <SalesHeatmap allOrders={data?.orders || []} />
            </>
          )}
        </section>

        {/* ── SKU Performance ────────────────────────────────────── */}
        <section>
          {loading ? (
            <Skeleton className="h-96 rounded-2xl" />
          ) : (
            <SkuPerformance data={data?.skuPerformance || []} />
          )}
        </section>

        {/* ── Tabla de órdenes ───────────────────────────────────── */}
        <section>
          {loading ? (
            <Skeleton className="h-96 rounded-2xl" />
          ) : (
            <OrdersTable orders={data?.orders || []} />
          )}
        </section>
      </main>

      <footer className="border-t border-brand-border mt-16 py-6 px-6">
        <p className="text-center text-brand-muted text-xs font-mono">
          Datos obtenidos en tiempo real desde MercadoLibre vía Google Apps Script · Auto-refresh 5 min
        </p>
      </footer>
    </div>
  );
}

// ── Inline mini-charts ──────────────────────────────────────────

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";

function MedioPagoChart({ data }: { data: { medio: string; count: number; revenue: number }[] }) {
  const colors = ["#FFE500", "#FF6B35", "#88AAFF", "#AA88FF", "#44DDAA", "#FF4466", "#88CCFF"];
  const sorted = [...data].sort((a, b) => a.count - b.count);
  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <h3 className="font-display font-semibold text-brand-text text-lg mb-1">Medios de Pago</h3>
      <p className="text-brand-sub text-sm mb-5">Cantidad de órdenes por método</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 55, left: 0, bottom: 0 }}>
          <XAxis type="number" tick={false} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="medio" width={110} tick={{ fill: "#E8E8F0", fontSize: 11, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v: number) => [`${v} órdenes`, "Órdenes"]}
            contentStyle={{ background: "#0A0A0F", border: "1px solid #1E1E2E", borderRadius: "10px", fontFamily: "DM Sans", color: "#E8E8F0" }}
            cursor={{ fill: "rgba(255,229,0,0.04)" }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {sorted.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            <LabelList dataKey="count" position="right" formatter={(v: number) => `${v}`} style={{ fill: "#8888AA", fontSize: 10, fontFamily: "DM Mono" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CuotasChart({ data }: { data: { cuotas: string; count: number }[] }) {
  const colors = ["#FFE500", "#FF6B35", "#88AAFF", "#AA88FF", "#44DDAA", "#FF4466", "#FFB347", "#88CCFF"];
  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <h3 className="font-display font-semibold text-brand-text text-lg mb-1">Cuotas</h3>
      <p className="text-brand-sub text-sm mb-5">Distribución de financiamiento</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
          <XAxis dataKey="cuotas" tick={{ fill: "#8888AA", fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#8888AA", fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v: number) => [`${v} órdenes`, "Órdenes"]}
            contentStyle={{ background: "#0A0A0F", border: "1px solid #1E1E2E", borderRadius: "10px", fontFamily: "DM Sans", color: "#E8E8F0" }}
            cursor={{ fill: "rgba(255,229,0,0.04)" }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

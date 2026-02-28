"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import type { DashboardData } from "@/lib/sheets";
import StatCard from "./StatCard";
import RevenueChart from "./RevenueChart";
import { TopProductsChart, StatusChart } from "./Charts";
import OrdersTable from "./OrdersTable";
import WaterfallChart from "./WaterfallChart";
import SalesHeatmap from "./SalesHeatmap";
import SkuPerformance from "./SkuPerformance";
import UruguayMap from "./UruguayMap";
import MontevideoMap from "./MontevideoMap";
import StockDashboard from "./StockDashboard";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";

function Skeleton({ className }: { className: string }) {
  return <div className={`skeleton ${className}`} />;
}

type Tab = "resumen" | "productos" | "geografico" | "stock" | "ordenes";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "resumen", label: "Resumen", icon: "📊" },
  { key: "productos", label: "Productos & SKU", icon: "📦" },
  { key: "geografico", label: "Geográfico", icon: "🗺️" },
  { key: "stock", label: "Stock", icon: "📋" },
  { key: "ordenes", label: "Órdenes", icon: "🛒" },
];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("resumen");

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

  const { currentMonth, prevMonth } = data || {};

  function pct(cur?: number, prev?: number) {
    if (!prev || prev === 0) return undefined;
    return (((cur || 0) - prev) / prev) * 100;
  }

  return (
    <div className="min-h-screen">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-brand-border bg-brand-dark/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-yellow rounded-lg flex items-center justify-center text-brand-dark font-bold text-sm font-display">
              ML
            </div>
            <div>
              <h1 className="font-display font-bold text-brand-text text-lg leading-none">Dashboard Ventas</h1>
              <p className="text-brand-sub text-xs mt-0.5 font-mono">MercadoLibre · Datos en tiempo real</p>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="hidden md:flex items-center gap-1 bg-brand-dark border border-brand-border rounded-xl p-1">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  activeTab === tab.key
                    ? "bg-brand-yellow text-brand-dark font-bold"
                    : "text-brand-sub hover:text-brand-text"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <p className="text-brand-muted text-xs font-mono hidden lg:block">
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

        {/* Mobile tabs */}
        <div className="md:hidden flex overflow-x-auto px-4 pb-2 gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                activeTab === tab.key
                  ? "bg-brand-yellow text-brand-dark font-bold"
                  : "bg-brand-dark border border-brand-border text-brand-sub"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-8">

        {/* ── Error ──────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
            <p className="text-red-400 font-mono text-sm font-bold">⚠ Error al cargar datos</p>
            <p className="text-red-400/70 text-xs mt-1 font-mono">{error}</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: RESUMEN
        ══════════════════════════════════════════════════════════ */}
        {activeTab === "resumen" && (
          <>
            {/* KPIs financieros */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-brand-sub text-xs font-mono uppercase tracking-widest">Resumen financiero — Mes actual</p>
                <p className="text-brand-muted text-xs font-mono">vs mismo período mes anterior</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />) : (
                  <>
                    <div className="col-span-2 sm:col-span-1">
                      <StatCard label="Ingresos brutos" value={currentMonth?.revenue || 0} prefix="$" accent delay={0} icon="💰" trend={pct(currentMonth?.revenue, prevMonth?.revenue)} invertTrend={false} />
                    </div>
                    <StatCard label="Comisiones MELI" value={currentMonth?.comisiones || 0} prefix="$" delay={80} icon="🏦" trend={pct(currentMonth?.comisiones, prevMonth?.comisiones)} invertTrend={true} />
                    <StatCard label="Costo envíos neto" value={currentMonth?.envios || 0} prefix="$" delay={160} icon="📦" trend={pct(currentMonth?.envios, prevMonth?.envios)} invertTrend={true} />
                    <StatCard label="Margen real" value={currentMonth?.margen || 0} prefix="$" delay={240} icon="📈" sub={`${currentMonth?.margenPct.toFixed(1) || 0}% del total`} trend={pct(currentMonth?.margen, prevMonth?.margen)} invertTrend={false} />
                    <StatCard label="Ticket promedio" value={currentMonth?.avgOrderValue || 0} prefix="$" delay={320} icon="🎯" sub={`Margen prom. $${currentMonth?.avgMargen.toFixed(0) || 0}`} trend={pct(currentMonth?.avgOrderValue, prevMonth?.avgOrderValue)} invertTrend={false} />
                  </>
                )}
              </div>
            </section>

            {/* KPIs operativos */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-brand-sub text-xs font-mono uppercase tracking-widest">Operaciones — Mes actual</p>
                <p className="text-brand-muted text-xs font-mono">vs mismo período mes anterior</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />) : (
                  <>
                    <StatCard label="Total órdenes" value={currentMonth?.orders || 0} delay={0} icon="🛒" trend={pct(currentMonth?.orders, prevMonth?.orders)} />
                    <StatCard label="Unidades vendidas" value={currentMonth?.units || 0} delay={80} icon="📊" trend={pct(currentMonth?.units, prevMonth?.units)} />
                    <StatCard label="Margen %" value={currentMonth?.margenPct || 0} suffix="%" decimals={1} delay={160} icon="💹" trend={pct(currentMonth?.margenPct, prevMonth?.margenPct)} />
                    <StatCard label="Margen por orden" value={currentMonth?.avgMargen || 0} prefix="$" delay={240} icon="⚡" trend={pct(currentMonth?.avgMargen, prevMonth?.avgMargen)} />
                  </>
                )}
              </div>
            </section>

            {/* Gráfico */}
            <section>
              {loading ? <Skeleton className="h-80 rounded-2xl" /> : (
                <RevenueChart byDay={data?.revenueByDay || []} byMonth={data?.revenueByMonth || []} currentMonthByDay={data?.revenueCurrentMonth || []} prevMonthByDay={data?.revenuePrevMonth || []} />
              )}
            </section>

            {/* Tipo envío + Pagos + Cuotas */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {loading ? (
                <>
                  <Skeleton className="h-72 rounded-2xl" />
                  <Skeleton className="h-72 rounded-2xl" />
                  <Skeleton className="h-72 rounded-2xl" />
                </>
              ) : (
                <>
                  <StatusChart data={data?.tipoEnvioBreakdown || []} />
                  <MedioPagoChart allOrders={data?.orders || []} />
                  <CuotasChart allOrders={data?.orders || []} />
                </>
              )}
            </section>

            {/* Waterfall + Heatmap */}
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
          </>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: PRODUCTOS & SKU
        ══════════════════════════════════════════════════════════ */}
        {activeTab === "productos" && (
          <>
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
            <section>
              {loading ? <Skeleton className="h-96 rounded-2xl" /> : (
                <SkuPerformance data={data?.skuPerformance || []} />
              )}
            </section>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: GEOGRÁFICO
        ══════════════════════════════════════════════════════════ */}
        {activeTab === "geografico" && (
          <div className="space-y-8">
            <section>
              {loading ? <Skeleton className="h-[600px] rounded-2xl" /> : (
                <UruguayMap orders={(data?.orders || []).map(o => ({
                  departamentoEntrega: o.departamentoEntrega || "",
                  ciudadEntrega: o.ciudadEntrega || "",
                  totalItem: o.totalItem,
                  fecha: o.fecha,
                }))} />
              )}
            </section>
            <section>
              {loading ? <Skeleton className="h-[600px] rounded-2xl" /> : (
                <MontevideoMap orders={(data?.orders || []).map(o => ({
                  departamentoEntrega: o.departamentoEntrega || "",
                  ciudadEntrega: o.ciudadEntrega || "",
                  totalItem: o.totalItem,
                  fecha: o.fecha,
                }))} />
              )}
            </section>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: STOCK
        ══════════════════════════════════════════════════════════ */}
        {activeTab === "stock" && (
          <section>
            {loading ? <Skeleton className="h-96 rounded-2xl" /> : (
              (data?.stock?.length || 0) > 0 ? (
                <StockDashboard
                  stock={data?.stock || []}
                  orders={(data?.orders || []).map(o => ({
                    sku: o.sku,
                    itemIdML: o.itemIdML || "",
                    cantidad: o.cantidad,
                    fecha: o.fecha,
                  }))}
                />
              ) : (
                <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center">
                  <p className="text-brand-sub font-mono text-sm">Sin datos de stock.</p>
                  <p className="text-brand-muted font-mono text-xs mt-2">Ejecutá <code className="text-brand-yellow">traerStock()</code> en Apps Script para cargar el stock.</p>
                </div>
              )
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB: ÓRDENES
        ══════════════════════════════════════════════════════════ */}
        {activeTab === "ordenes" && (
          <section>
            {loading ? <Skeleton className="h-96 rounded-2xl" /> : (
              <OrdersTable orders={data?.orders || []} />
            )}
          </section>
        )}

      </main>

      <footer className="border-t border-brand-border mt-16 py-6 px-6">
        <p className="text-center text-brand-muted text-xs font-mono">
          Datos en tiempo real desde MercadoLibre vía Google Apps Script · Auto-refresh 5 min
        </p>
      </footer>
    </div>
  );
}

// ── Inline mini-charts ──────────────────────────────────────────

const PAGO_LABELS: Record<string, string> = {
  account_money: "Cuenta ML", visa: "Visa", master: "Mastercard",
  oca: "OCA", debvisa: "Déb. Visa", debmaster: "Déb. Master",
  abitab: "Abitab", redpagos: "Redpagos", amex: "Amex",
};

function getMonthKey(fecha: string) {
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  return ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][parseInt(mo)-1] + " " + y.slice(2);
}

function curMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;
}

function MonthPicker({ selected, onChange, available }: { selected: string; onChange: (m: string) => void; available: string[] }) {
  const [open, setOpen] = useState(false);
  const label = selected === "all" ? "Histórico" : available.includes(selected) ? fmtMonth(selected) : "Mes actual";
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="px-3 py-1.5 text-xs font-mono border border-brand-border rounded-lg text-brand-sub hover:text-brand-text transition-all">
        📅 {label}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 bg-brand-card border border-brand-border rounded-xl shadow-xl p-3 min-w-[150px]">
          <button onClick={() => { onChange(curMonth()); setOpen(false); }} className={`w-full text-left px-2 py-1.5 text-xs font-mono rounded-lg mb-1 ${selected === curMonth() ? "bg-brand-yellow/10 text-brand-yellow" : "text-brand-sub hover:text-brand-text"}`}>Mes actual</button>
          <button onClick={() => { onChange("all"); setOpen(false); }} className={`w-full text-left px-2 py-1.5 text-xs font-mono rounded-lg mb-1 ${selected === "all" ? "bg-brand-yellow/10 text-brand-yellow" : "text-brand-sub hover:text-brand-text"}`}>Histórico</button>
          <div className="border-t border-brand-border my-1" />
          <div className="max-h-44 overflow-y-auto space-y-0.5">
            {available.map(m => (
              <button key={m} onClick={() => { onChange(m); setOpen(false); }} className={`w-full text-left px-2 py-1.5 text-xs font-mono rounded-lg ${selected === m ? "bg-brand-yellow/10 text-brand-yellow" : "text-brand-sub hover:text-brand-text"}`}>{fmtMonth(m)}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MedioPagoChart({ allOrders }: { allOrders: { fecha: string; medioPago: string; totalItem: number }[] }) {
  const colors = ["#FFE500", "#88AAFF", "#FF6B35", "#44DDAA", "#AA88FF", "#FF4466", "#88CCFF"];
  const [selectedMonth, setSelectedMonth] = useState<string>(curMonth());

  const availableMonths = useMemo(() => {
    const s = new Set<string>();
    allOrders.forEach(o => { const k = getMonthKey(o.fecha); if (k) s.add(k); });
    return Array.from(s).sort().reverse();
  }, [allOrders]);

  const chartData = useMemo(() => {
    const filtered = selectedMonth === "all" ? allOrders : allOrders.filter(o => getMonthKey(o.fecha) === selectedMonth);
    const map: Record<string, { count: number; revenue: number }> = {};
    filtered.forEach(o => {
      const k = PAGO_LABELS[o.medioPago] || o.medioPago || "Otro";
      if (!map[k]) map[k] = { count: 0, revenue: 0 };
      map[k].count += 1;
      map[k].revenue += o.totalItem;
    });
    const entries = Object.entries(map).map(([medio, v]) => ({ medio, ...v })).sort((a,b) => b.count - a.count);
    const total = entries.reduce((s,e) => s + e.count, 0);
    const main: typeof entries = [];
    let otroCount = 0, otroRev = 0;
    entries.forEach(e => {
      if (e.count / total >= 0.04) main.push(e);
      else { otroCount += e.count; otroRev += e.revenue; }
    });
    if (otroCount > 0) main.push({ medio: "Otros", count: otroCount, revenue: otroRev });
    return main.sort((a,b) => a.count - b.count);
  }, [allOrders, selectedMonth]);

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold text-brand-text text-lg mb-0.5">Medios de Pago</h3>
          <p className="text-brand-sub text-sm">Órdenes por método</p>
        </div>
        <MonthPicker selected={selectedMonth} onChange={setSelectedMonth} available={availableMonths} />
      </div>
      <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 36)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 45, left: 0, bottom: 0 }}>
          <XAxis type="number" tick={false} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="medio" width={110} tick={{ fill: "#E8E8F0", fontSize: 11, fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v: number) => [`${v} órdenes`, "Órdenes"]} contentStyle={{ background: "#0A0A0F", border: "1px solid #1E1E2E", borderRadius: "10px", fontFamily: "DM Sans", color: "#E8E8F0" }} cursor={{ fill: "rgba(255,229,0,0.04)" }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            <LabelList dataKey="count" position="right" formatter={(v: number) => `${v}`} style={{ fill: "#AAAACC", fontSize: 10, fontFamily: "DM Mono" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CuotasChart({ allOrders }: { allOrders: { fecha: string; cuotas: number }[] }) {
  const colors = ["#FFE500", "#FF6B35", "#88AAFF", "#AA88FF", "#44DDAA", "#FF4466", "#FFB347", "#88CCFF"];
  const [selectedMonth, setSelectedMonth] = useState<string>(curMonth());

  const availableMonths = useMemo(() => {
    const s = new Set<string>();
    allOrders.forEach(o => { const k = getMonthKey(o.fecha); if (k) s.add(k); });
    return Array.from(s).sort().reverse();
  }, [allOrders]);

  const chartData = useMemo(() => {
    const filtered = selectedMonth === "all" ? allOrders : allOrders.filter(o => getMonthKey(o.fecha) === selectedMonth);
    const map: Record<string, number> = {};
    filtered.forEach(o => {
      const k = o.cuotas === 1 ? "Contado" : `${o.cuotas}c`;
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map)
      .map(([cuotas, count]) => ({ cuotas, count }))
      .sort((a, b) => a.cuotas === "Contado" ? -1 : b.cuotas === "Contado" ? 1 : parseInt(a.cuotas) - parseInt(b.cuotas));
  }, [allOrders, selectedMonth]);

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold text-brand-text text-lg mb-0.5">Cuotas</h3>
          <p className="text-brand-sub text-sm">Distribución de financiamiento</p>
        </div>
        <MonthPicker selected={selectedMonth} onChange={setSelectedMonth} available={availableMonths} />
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
          <XAxis dataKey="cuotas" tick={{ fill: "#AAAACC", fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#AAAACC", fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v: number) => [`${v} órdenes`, "Órdenes"]} contentStyle={{ background: "#0A0A0F", border: "1px solid #1E1E2E", borderRadius: "10px", fontFamily: "DM Sans", color: "#E8E8F0" }} cursor={{ fill: "rgba(255,229,0,0.04)" }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            <LabelList dataKey="count" position="top" formatter={(v: number) => `${v}`} style={{ fill: "#AAAACC", fontSize: 10, fontFamily: "DM Mono" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

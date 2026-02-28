"use client";
import { useMemo, useState } from "react";

interface StockItem {
  "Item ID ML": string;
  "SKU": string;
  "Título": string;
  "Stock Disponible": number;
  "Precio": number;
  "Estado": string;
}

interface StockDashboardProps {
  stock: StockItem[];
  orders: {
    sku: string;
    itemIdML: string;
    cantidad: number;
    fecha: string;
  }[];
}

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

const ALERT_DAYS = 15;
const VELOCITY_DAYS = 90;

export default function StockDashboard({ stock, orders }: StockDashboardProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"dias" | "stock" | "velocidad" | "nombre">("dias");
  const [showOnly, setShowOnly] = useState<"all" | "alert" | "ok" | "zero">("all");

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - VELOCITY_DAYS);
    return d;
  }, []);

  const stockData = useMemo(() => {
    return stock.map(item => {
      const itemId = item["Item ID ML"];
      const sku = item["SKU"];

      // Filtrar órdenes de los últimos 90 días para este item
      const recentOrders = orders.filter(o => {
        const fecha = new Date(o.fecha);
        if (isNaN(fecha.getTime()) || fecha < cutoff) return false;
        return o.itemIdML === itemId || (sku && o.sku === sku);
      });

      // Calcular días con ventas (excluir días sin actividad para no subestimar velocidad)
      const diasConVentas = new Set(
        recentOrders.map(o => new Date(o.fecha).toISOString().split("T")[0])
      ).size;

      const unidadesVendidas = recentOrders.reduce((s, o) => s + o.cantidad, 0);

      // Velocidad: unidades / días con ventas (no días totales)
      // Esto evita penalizar por días sin stock o sin demanda
      const velocidadDiaria = diasConVentas > 0 ? unidadesVendidas / diasConVentas : 0;

      const stockActual = Number(item["Stock Disponible"]) || 0;
      const diasCobertura = velocidadDiaria > 0 ? Math.round(stockActual / velocidadDiaria) : stockActual > 0 ? 999 : 0;

      return {
        itemId,
        sku: sku || "—",
        titulo: item["Título"] || "Sin título",
        stockActual,
        precio: Number(item["Precio"]) || 0,
        estado: item["Estado"] || "",
        velocidadDiaria,
        unidadesVendidas,
        diasConVentas,
        diasCobertura,
        valorStock: stockActual * (Number(item["Precio"]) || 0),
      };
    });
  }, [stock, orders, cutoff]);

  const filtered = useMemo(() => {
    let data = stockData;

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(d => d.titulo.toLowerCase().includes(q) || d.sku.toLowerCase().includes(q));
    }

    if (showOnly === "alert") data = data.filter(d => d.diasCobertura < ALERT_DAYS && d.diasCobertura > 0);
    if (showOnly === "zero") data = data.filter(d => d.stockActual === 0);
    if (showOnly === "ok") data = data.filter(d => d.diasCobertura >= ALERT_DAYS);

    return [...data].sort((a, b) => {
      if (sortBy === "dias") return a.diasCobertura - b.diasCobertura;
      if (sortBy === "stock") return b.stockActual - a.stockActual;
      if (sortBy === "velocidad") return b.velocidadDiaria - a.velocidadDiaria;
      return a.titulo.localeCompare(b.titulo);
    });
  }, [stockData, search, showOnly, sortBy]);

  // KPIs
  const totalSkus = stockData.length;
  const alertaSkus = stockData.filter(d => d.diasCobertura < ALERT_DAYS && d.diasCobertura > 0).length;
  const sinStock = stockData.filter(d => d.stockActual === 0).length;
  const valorTotalStock = stockData.reduce((s, d) => s + d.valorStock, 0);

  const getDiasColor = (dias: number, stock: number) => {
    if (stock === 0) return "text-red-400";
    if (dias < ALERT_DAYS) return "text-orange-400";
    if (dias < 30) return "text-yellow-400";
    return "text-green-400";
  };

  const getDiasBg = (dias: number, stock: number) => {
    if (stock === 0) return "bg-red-500/10 border-red-500/20";
    if (dias < ALERT_DAYS) return "bg-orange-500/10 border-orange-500/20";
    if (dias < 30) return "bg-yellow-500/10 border-yellow-500/20";
    return "bg-green-500/10 border-green-500/20";
  };

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5">
          <p className="text-brand-sub text-xs font-mono uppercase tracking-wider mb-2">SKUs totales</p>
          <p className="text-brand-text font-display font-bold text-3xl">{totalSkus}</p>
        </div>
        <div className="bg-brand-card border border-orange-500/20 rounded-2xl p-5">
          <p className="text-orange-400 text-xs font-mono uppercase tracking-wider mb-2">⚠ Alerta &lt;{ALERT_DAYS}d</p>
          <p className="text-orange-400 font-display font-bold text-3xl">{alertaSkus}</p>
          <p className="text-brand-sub text-xs font-mono mt-1">requieren reposición</p>
        </div>
        <div className="bg-brand-card border border-red-500/20 rounded-2xl p-5">
          <p className="text-red-400 text-xs font-mono uppercase tracking-wider mb-2">🔴 Sin stock</p>
          <p className="text-red-400 font-display font-bold text-3xl">{sinStock}</p>
          <p className="text-brand-sub text-xs font-mono mt-1">sin unidades</p>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5">
          <p className="text-brand-sub text-xs font-mono uppercase tracking-wider mb-2">💰 Valor stock</p>
          <p className="text-brand-yellow font-display font-bold text-3xl">{formatCurrency(valorTotalStock)}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <div>
            <h3 className="font-display font-semibold text-brand-text text-lg mb-0.5">Cobertura de Stock</h3>
            <p className="text-brand-sub text-sm">Velocidad calculada sobre días con ventas · últimos {VELOCITY_DAYS} días</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Filter buttons */}
            {([
              { key: "all", label: "Todos" },
              { key: "alert", label: `⚠ <${ALERT_DAYS}d` },
              { key: "zero", label: "🔴 Sin stock" },
              { key: "ok", label: "✅ OK" },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setShowOnly(f.key)}
                className={`px-3 py-1.5 text-xs font-mono border rounded-lg transition-all ${showOnly === f.key ? "border-brand-yellow/50 bg-brand-yellow/10 text-brand-yellow" : "border-brand-border text-brand-sub hover:text-brand-text"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search + sort */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <input
            type="text"
            placeholder="Buscar SKU o producto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-xs font-mono text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-yellow/50"
          />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-xs font-mono text-brand-sub focus:outline-none"
          >
            <option value="dias">Ordenar: Días ↑</option>
            <option value="stock">Ordenar: Stock ↓</option>
            <option value="velocidad">Ordenar: Velocidad ↓</option>
            <option value="nombre">Ordenar: Nombre</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="text-left text-brand-sub py-2 pr-4 font-normal">SKU</th>
                <th className="text-left text-brand-sub py-2 pr-4 font-normal">Producto</th>
                <th className="text-right text-brand-sub py-2 pr-4 font-normal">Stock</th>
                <th className="text-right text-brand-sub py-2 pr-4 font-normal">Vel./día</th>
                <th className="text-right text-brand-sub py-2 pr-4 font-normal">Uds 90d</th>
                <th className="text-right text-brand-sub py-2 font-normal">Días cobertura</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.itemId || i} className="border-b border-brand-border/30 hover:bg-brand-dark/50 transition-colors">
                  <td className="py-2.5 pr-4 text-brand-muted">{item.sku}</td>
                  <td className="py-2.5 pr-4 text-brand-text max-w-[200px] truncate" title={item.titulo}>
                    {item.titulo.length > 35 ? item.titulo.slice(0, 35) + "…" : item.titulo}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-brand-text font-bold">{item.stockActual}</td>
                  <td className="py-2.5 pr-4 text-right text-brand-sub">
                    {item.velocidadDiaria > 0 ? item.velocidadDiaria.toFixed(2) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-brand-sub">{item.unidadesVendidas}</td>
                  <td className="py-2.5 text-right">
                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full border text-xs font-bold ${getDiasBg(item.diasCobertura, item.stockActual)}`}>
                      <span className={getDiasColor(item.diasCobertura, item.stockActual)}>
                        {item.stockActual === 0 ? "SIN STOCK" : item.diasCobertura === 999 ? "∞" : `${item.diasCobertura}d`}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-brand-muted py-8">Sin resultados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-brand-muted text-xs font-mono mt-3 text-right">{filtered.length} de {totalSkus} productos</p>
      </div>
    </div>
  );
}

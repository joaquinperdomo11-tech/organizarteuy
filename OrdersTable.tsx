"use client";
import { useState } from "react";
import clsx from "clsx";
import type { Order } from "@/lib/sheets";

const PAGO_LABELS: Record<string, string> = {
  account_money: "Cuenta ML",
  visa: "Visa",
  master: "Mastercard",
  oca: "OCA",
  debvisa: "Débito Visa",
  debmaster: "Débito Master",
  abitab: "Abitab",
  redpagos: "Redpagos",
  amex: "Amex",
};

const ENVIO_COLORS: Record<string, string> = {
  "FULL": "text-yellow-400 bg-yellow-400/10",
  "FLEX": "text-orange-400 bg-orange-400/10",
  "MERCADO ENVIOS": "text-blue-400 bg-blue-400/10",
  "ENVIO POR FUERA": "text-purple-400 bg-purple-400/10",
  "RETIRO": "text-green-400 bg-green-400/10",
  "SIN ENVÍO": "text-brand-muted bg-brand-muted/10",
};

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "short" });
}

function formatAmount(n: number) {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  }).format(n);
}

const PAGE_SIZE = 12;

export default function OrdersTable({ orders }: { orders: Order[] }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [envioFilter, setEnvioFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"fecha" | "margen" | "total">("fecha");

  const tiposEnvio = Array.from(new Set(orders.map((o) => o.tipoEnvio)));

  const filtered = orders
    .filter((o) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        String(o.orderId).includes(q) ||
        o.producto.toLowerCase().includes(q) ||
        o.buyer.toLowerCase().includes(q) ||
        o.sku.toLowerCase().includes(q);
      const matchEnvio = envioFilter === "all" || o.tipoEnvio === envioFilter;
      return matchSearch && matchEnvio;
    })
    .sort((a, b) => {
      if (sortBy === "fecha") return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      if (sortBy === "margen") return b.margenReal - a.margenReal;
      return b.totalItem - a.totalItem;
    });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageOrders = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalFiltered = filtered.reduce((s, o) => s + o.totalItem, 0);
  const margenFiltered = filtered.reduce((s, o) => s + o.margenReal, 0);

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-brand-border">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div>
            <h3 className="font-display font-semibold text-brand-text text-lg">Órdenes</h3>
            <p className="text-brand-sub text-sm mt-0.5">
              {filtered.length} resultados ·{" "}
              <span className="text-brand-yellow font-mono">{formatAmount(totalFiltered)}</span>
              {" "}·{" "}
              <span className="text-green-400 font-mono">margen {formatAmount(margenFiltered)}</span>
            </p>
          </div>

          {/* Sort */}
          <div className="flex bg-brand-dark border border-brand-border rounded-lg overflow-hidden">
            {(["fecha", "total", "margen"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setSortBy(s); setPage(0); }}
                className={`px-3 py-1.5 text-xs font-mono transition-all capitalize ${
                  sortBy === s
                    ? "bg-brand-yellow text-brand-dark font-bold"
                    : "text-brand-sub hover:text-brand-text"
                }`}
              >
                {s === "fecha" ? "↓ Fecha" : s === "total" ? "↓ Total" : "↓ Margen"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Buscar por orden, producto, SKU, comprador..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full bg-brand-dark border border-brand-border text-brand-text text-sm rounded-lg px-4 py-2 pl-8 focus:outline-none focus:border-brand-yellow/50 font-body placeholder:text-brand-muted transition-colors"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted text-xs">🔍</span>
          </div>
          <select
            value={envioFilter}
            onChange={(e) => { setEnvioFilter(e.target.value); setPage(0); }}
            className="bg-brand-dark border border-brand-border text-brand-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-yellow/50 font-mono transition-colors"
          >
            <option value="all">Todos los envíos</option>
            {tiposEnvio.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border">
              {["Fecha", "Orden", "Producto / SKU", "Comprador", "Cant.", "Total", "Comisión", "Envío", "Margen", "Pago", "Tipo Envío"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-brand-sub font-mono text-xs uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageOrders.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-12 text-brand-muted font-body">
                  No hay órdenes que coincidan
                </td>
              </tr>
            ) : (
              pageOrders.map((o, i) => {
                const margenColor = o.margenReal > 0 ? "text-green-400" : "text-red-400";
                return (
                  <tr key={`${o.orderId}-${i}`} className="border-b border-brand-border/40 hover:bg-brand-dark/50 transition-colors group">
                    <td className="px-4 py-3 text-brand-sub text-xs font-mono whitespace-nowrap">
                      {formatDate(o.fecha)}
                    </td>
                    <td className="px-4 py-3 font-mono text-brand-sub text-xs group-hover:text-brand-yellow transition-colors">
                      #{String(o.orderId).slice(-8)}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-brand-text truncate text-xs" title={o.producto}>{o.producto || "-"}</p>
                      {o.sku && <p className="text-brand-muted text-xs font-mono mt-0.5">{o.sku}</p>}
                    </td>
                    <td className="px-4 py-3 text-brand-sub text-xs">{o.buyer || "-"}</td>
                    <td className="px-4 py-3 text-brand-text font-mono text-center text-xs">{o.cantidad}</td>
                    <td className="px-4 py-3 font-mono font-medium text-brand-text text-xs whitespace-nowrap">
                      {formatAmount(o.totalItem)}
                    </td>
                    <td className="px-4 py-3 font-mono text-red-400/70 text-xs whitespace-nowrap">
                      -{formatAmount(o.comisionML)}
                    </td>
                    <td className="px-4 py-3 font-mono text-brand-sub text-xs whitespace-nowrap">
                      {o.shippingCostSeller > 0 ? (
                        <span>
                          -{formatAmount(o.shippingCostSeller)}
                          {o.bonificacionEnvio > 0 && (
                            <span className="text-green-400/70 ml-1">
                              +{formatAmount(o.bonificacionEnvio)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-brand-muted">—</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 font-mono font-bold text-xs whitespace-nowrap ${margenColor}`}>
                      {formatAmount(o.margenReal)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-brand-sub font-mono text-xs">
                          {PAGO_LABELS[o.medioPago] || o.medioPago}
                        </span>
                        {o.cuotas > 1 && (
                          <span className="text-brand-muted font-mono text-xs">{o.cuotas}c</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        "px-2 py-0.5 rounded-full text-xs font-mono whitespace-nowrap",
                        ENVIO_COLORS[o.tipoEnvio] || "text-brand-sub bg-brand-muted/10"
                      )}>
                        {o.tipoEnvio}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-brand-border flex items-center justify-between">
          <span className="text-brand-sub text-xs font-mono">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs font-mono border border-brand-border rounded-lg text-brand-sub hover:border-brand-yellow/50 hover:text-brand-yellow disabled:opacity-30 transition-all"
            >
              ← Ant.
            </button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const pageNum = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-1.5 text-xs font-mono border rounded-lg transition-all ${
                    pageNum === page
                      ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow"
                      : "border-brand-border text-brand-sub hover:border-brand-yellow/50 hover:text-brand-yellow"
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs font-mono border border-brand-border rounded-lg text-brand-sub hover:border-brand-yellow/50 hover:text-brand-yellow disabled:opacity-30 transition-all"
            >
              Sig. →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

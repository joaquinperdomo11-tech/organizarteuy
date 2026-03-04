"use client";
import { useMemo, useState } from "react";
import UruguayMap from "./UruguayMap";
import MontevideoMap from "./MontevideoMap";
import { Order } from "@/lib/sheets";

interface GeoTabProps {
  orders: Order[];
  loading: boolean;
  revenueByMonth: { month: string; revenue: number; margen: number; orders: number }[];
}

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year.slice(2)}`;
}

export default function GeoTab({ orders, loading, revenueByMonth }: GeoTabProps) {
  const now = new Date();
  const curYear = now.getFullYear();

  // All available months from data
  const availableMonths = useMemo(() =>
    revenueByMonth.map(m => m.month).sort(),
    [revenueByMonth]
  );

  // Default: all months of current year
  const defaultSelected = useMemo(() =>
    availableMonths.filter(m => m.startsWith(String(curYear))),
    [availableMonths, curYear]
  );

  const [selectedMonths, setSelectedMonths] = useState<string[]>(defaultSelected);

  // Keep default in sync if data loads after mount
  useMemo(() => {
    if (selectedMonths.length === 0 && defaultSelected.length > 0) {
      setSelectedMonths(defaultSelected);
    }
  }, [defaultSelected]);

  const toggleMonth = (month: string) => {
    setSelectedMonths(prev =>
      prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
    );
  };

  const selectAll = () => setSelectedMonths([...availableMonths]);
  const selectYear = (year: number) => setSelectedMonths(availableMonths.filter(m => m.startsWith(String(year))));
  const clearAll = () => setSelectedMonths([]);

  const availableYears = [...new Set(availableMonths.map(m => m.split("-")[0]))].sort();

  const mapOrders = useMemo(() =>
    orders.map(o => ({
      departamentoEntrega: o.departamentoEntrega || "",
      ciudadEntrega: o.ciudadEntrega || "",
      totalItem: o.totalItem,
      fecha: o.fecha,
    })),
    [orders]
  );

  if (loading) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
        <div className="h-96 animate-pulse bg-brand-dark rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month filter */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-brand-sub text-xs font-mono uppercase tracking-wider">Filtrar por mes</span>
          <div className="flex gap-1.5 flex-wrap">
            {availableYears.map(year => (
              <button key={year} onClick={() => selectYear(parseInt(year))}
                className="px-2 py-0.5 text-xs font-mono border border-brand-border rounded hover:border-brand-yellow/50 hover:text-brand-yellow text-brand-sub transition-all">
                {year}
              </button>
            ))}
            <button onClick={selectAll}
              className="px-2 py-0.5 text-xs font-mono border border-brand-border rounded hover:border-brand-yellow/50 hover:text-brand-yellow text-brand-sub transition-all">
              Todo
            </button>
            <button onClick={clearAll}
              className="px-2 py-0.5 text-xs font-mono border border-brand-border rounded hover:border-red-400/50 hover:text-red-400 text-brand-sub transition-all">
              Ninguno
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {availableMonths.map(month => {
            const selected = selectedMonths.includes(month);
            return (
              <button key={month} onClick={() => toggleMonth(month)}
                className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-all ${
                  selected
                    ? "bg-brand-yellow text-brand-dark border-brand-yellow font-bold"
                    : "border-brand-border text-brand-sub hover:border-brand-yellow/40 hover:text-brand-text"
                }`}>
                {monthLabel(month)}
              </button>
            );
          })}
        </div>
        {selectedMonths.length > 0 && (
          <p className="text-brand-muted text-xs font-mono mt-2">
            {selectedMonths.length} {selectedMonths.length === 1 ? "mes seleccionado" : "meses seleccionados"}
          </p>
        )}
      </div>

      {/* Maps side by side */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-6">
        <h3 className="font-display font-semibold text-brand-text text-lg mb-5">Mapa de Entregas</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <UruguayMap orders={mapOrders} selectedMonths={selectedMonths} />
          <MontevideoMap orders={mapOrders} selectedMonths={selectedMonths} />
        </div>
      </div>
    </div>
  );
}

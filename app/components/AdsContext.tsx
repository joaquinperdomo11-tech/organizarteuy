"use client";
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

export interface AdRow {
  desde: string;
  hasta: string;
  campana: string;
  titulo: string;
  itemId: string;
  estado: string;
  impresiones: number;
  clics: number;
  cpc: number;
  ctr: number;
  cvr: number;
  ingresos: number;
  inversion: number;
  acos: number;
  roas: number;
  ventasDirectas: number;
  ventasIndirectas: number;
  ventasPublicidad: number;
  ingresosDirectos: number;
  ingresosIndirectos: number;
}

export interface AdsMonth {
  monthKey: string;   // "2026-02"
  label: string;      // "Feb 26"
  desde: string;
  hasta: string;
  rows: AdRow[];
  totalInversion: number;
  totalIngresos: number;
  uploadedAt: string;
}

interface AdsContextType {
  // All loaded months
  months: AdsMonth[];
  // Add a new month's data (replaces if same monthKey)
  addMonth: (rows: AdRow[]) => void;
  // Remove a month
  removeMonth: (monthKey: string) => void;
  // Get inversion for a specific month and itemId
  getInversionForMonth: (monthKey: string, itemId: string) => number;
  // Get total inversion for a month
  getTotalInversionForMonth: (monthKey: string) => number;
  // Get all rows for a month
  getRowsForMonth: (monthKey: string) => AdRow[];
  // Loading state
  loading: boolean;
}

const AdsContext = createContext<AdsContextType>({
  months: [],
  addMonth: () => {},
  removeMonth: () => {},
  getInversionForMonth: () => 0,
  getTotalInversionForMonth: () => 0,
  getRowsForMonth: () => [],
  loading: false,
});

const MONTH_NAMES: Record<string, string> = {
  "ene":"01","feb":"02","mar":"03","abr":"04","may":"05","jun":"06",
  "jul":"07","ago":"08","sep":"09","oct":"10","nov":"11","dic":"12",
};

export function parseMonthKey(desde: string): string {
  // Input: "01-feb-2026" -> "2026-02"
  const parts = desde.toLowerCase().split("-");
  if (parts.length === 3) {
    const month = MONTH_NAMES[parts[1]] || "01";
    return `${parts[2]}-${month}`;
  }
  return "";
}

export function monthKeyToLabel(key: string): string {
  const [year, month] = key.split("-");
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${names[parseInt(month) - 1]} ${year.slice(2)}`;
}

const STORAGE_KEY = "ads-months-v1";

export function AdsProvider({ children }: { children: ReactNode }) {
  const [months, setMonths] = useState<AdsMonth[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AdsMonth[];
        setMonths(parsed);
      }
    } catch (e) {
      console.warn("Could not load ads from storage:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Persist to localStorage whenever months change
  const persist = useCallback((newMonths: AdsMonth[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newMonths));
    } catch (e) {
      console.warn("Could not save ads to storage:", e);
    }
    setMonths(newMonths);
  }, []);

  const addMonth = useCallback((rows: AdRow[]) => {
    if (!rows.length) return;
    const monthKey = parseMonthKey(rows[0].desde);
    if (!monthKey) return;

    const totalInversion = rows.reduce((s, r) => s + r.inversion, 0);
    const totalIngresos = rows.reduce((s, r) => s + r.ingresos, 0);

    const newMonth: AdsMonth = {
      monthKey,
      label: monthKeyToLabel(monthKey),
      desde: rows[0].desde,
      hasta: rows[0].hasta,
      rows,
      totalInversion,
      totalIngresos,
      uploadedAt: new Date().toISOString(),
    };

    setMonths(prev => {
      const filtered = prev.filter(m => m.monthKey !== monthKey);
      const updated = [...filtered, newMonth].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
      persist(updated);
      return updated;
    });
  }, [persist]);

  const removeMonth = useCallback((monthKey: string) => {
    setMonths(prev => {
      const updated = prev.filter(m => m.monthKey !== monthKey);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const getRowsForMonth = useCallback((monthKey: string): AdRow[] => {
    return months.find(m => m.monthKey === monthKey)?.rows || [];
  }, [months]);

  const getInversionForMonth = useCallback((monthKey: string, itemId: string): number => {
    const monthData = months.find(m => m.monthKey === monthKey);
    if (!monthData) return 0;
    return monthData.rows
      .filter(r => r.itemId === itemId)
      .reduce((s, r) => s + r.inversion, 0);
  }, [months]);

  const getTotalInversionForMonth = useCallback((monthKey: string): number => {
    return months.find(m => m.monthKey === monthKey)?.totalInversion || 0;
  }, [months]);

  return (
    <AdsContext.Provider value={{
      months,
      addMonth,
      removeMonth,
      getInversionForMonth,
      getTotalInversionForMonth,
      getRowsForMonth,
      loading,
    }}>
      {children}
    </AdsContext.Provider>
  );
}

export function useAds() {
  return useContext(AdsContext);
}

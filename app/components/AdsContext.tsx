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
  months: AdsMonth[];
  addMonth: (rows: AdRow[]) => Promise<{ ok: boolean; error?: string }>;
  removeMonth: (monthKey: string) => Promise<void>;
  getInversionForMonth: (monthKey: string, itemId: string) => number;
  getTotalInversionForMonth: (monthKey: string) => number;
  getRowsForMonth: (monthKey: string) => AdRow[];
  loading: boolean;
  saving: boolean;
}

const AdsContext = createContext<AdsContextType>({
  months: [],
  addMonth: async () => ({ ok: false }),
  removeMonth: async () => {},
  getInversionForMonth: () => 0,
  getTotalInversionForMonth: () => 0,
  getRowsForMonth: () => [],
  loading: false,
  saving: false,
});

const MONTH_NAMES: Record<string, string> = {
  "ene":"01","feb":"02","mar":"03","abr":"04","may":"05","jun":"06",
  "jul":"07","ago":"08","sep":"09","oct":"10","nov":"11","dic":"12",
};

export function parseMonthKey(desde: string): string {
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

const WEBAPP_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";

async function callScript(action: string, data?: any) {
  const res = await fetch(WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" }, // Apps Script requires text/plain for doPost
    body: JSON.stringify({ action, ...data }),
  });
  return res.json();
}

function buildAdsMonth(monthKey: string, desde: string, hasta: string, rows: AdRow[]): AdsMonth {
  return {
    monthKey,
    label: monthKeyToLabel(monthKey),
    desde,
    hasta,
    rows,
    totalInversion: rows.reduce((s, r) => s + r.inversion, 0),
    totalIngresos: rows.reduce((s, r) => s + r.ingresos, 0),
    uploadedAt: new Date().toISOString(),
  };
}

export function AdsProvider({ children }: { children: ReactNode }) {
  const [months, setMonths] = useState<AdsMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load from Sheets on mount (same fetch as dashboard data)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(WEBAPP_URL);
        const json = await res.json();
        const publicidad: any[] = json.publicidad || [];

        const loaded: AdsMonth[] = publicidad.map((m: any) => {
          const rows: AdRow[] = (m.rows || []).map((r: any) => ({
            desde: r.desde || m.desde || "",
            hasta: r.hasta || m.hasta || "",
            campana: r.campana || "",
            titulo: r.titulo || "",
            itemId: r.itemId || "",
            estado: r.estado || "",
            impresiones: Number(r.impresiones) || 0,
            clics: Number(r.clics) || 0,
            cpc: Number(r.cpc) || 0,
            ctr: Number(r.ctr) || 0,
            cvr: Number(r.cvr) || 0,
            ingresos: Number(r.ingresos) || 0,
            inversion: Number(r.inversion) || 0,
            acos: Number(r.acos) || 0,
            roas: Number(r.roas) || 0,
            ventasDirectas: Number(r.ventasDirectas) || 0,
            ventasIndirectas: Number(r.ventasIndirectas) || 0,
            ventasPublicidad: Number(r.ventasPublicidad) || 0,
            ingresosDirectos: Number(r.ingresosDirectos) || 0,
            ingresosIndirectos: Number(r.ingresosIndirectos) || 0,
          }));
          return buildAdsMonth(m.monthKey, m.desde, m.hasta, rows);
        });

        setMonths(loaded.sort((a, b) => a.monthKey.localeCompare(b.monthKey)));
      } catch (e) {
        console.warn("Error loading publicidad:", e);
      } finally {
        setLoading(false);
      }
    };
    if (WEBAPP_URL) load();
    else setLoading(false);
  }, []);

  const addMonth = useCallback(async (rows: AdRow[]): Promise<{ ok: boolean; error?: string }> => {
    if (!rows.length) return { ok: false, error: "Sin datos" };
    const monthKey = parseMonthKey(rows[0].desde);
    if (!monthKey) return { ok: false, error: "No se pudo detectar el mes" };

    setSaving(true);
    try {
      const result = await callScript("guardarPublicidad", {
        data: {
          monthKey,
          desde: rows[0].desde,
          hasta: rows[0].hasta,
          rows: rows.map(r => ({
            itemId: r.itemId, titulo: r.titulo, estado: r.estado,
            campana: r.campana, impresiones: r.impresiones, clics: r.clics,
            cpc: r.cpc, ctr: r.ctr, cvr: r.cvr, ingresos: r.ingresos,
            inversion: r.inversion, acos: r.acos, roas: r.roas,
            ventasDirectas: r.ventasDirectas, ventasIndirectas: r.ventasIndirectas,
            ventasPublicidad: r.ventasPublicidad, ingresosDirectos: r.ingresosDirectos,
            ingresosIndirectos: r.ingresosIndirectos,
          })),
        },
      });

      if (!result.ok) return { ok: false, error: result.error || "Error al guardar" };

      const newMonth = buildAdsMonth(monthKey, rows[0].desde, rows[0].hasta, rows);
      setMonths(prev => {
        const filtered = prev.filter(m => m.monthKey !== monthKey);
        return [...filtered, newMonth].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
      });

      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message || "Error de red" };
    } finally {
      setSaving(false);
    }
  }, []);

  const removeMonth = useCallback(async (monthKey: string) => {
    setSaving(true);
    try {
      await callScript("eliminarPublicidad", { monthKey });
      setMonths(prev => prev.filter(m => m.monthKey !== monthKey));
    } finally {
      setSaving(false);
    }
  }, []);

  const getRowsForMonth = useCallback((monthKey: string) =>
    months.find(m => m.monthKey === monthKey)?.rows || [], [months]);

  const getInversionForMonth = useCallback((monthKey: string, itemId: string) =>
    (months.find(m => m.monthKey === monthKey)?.rows || [])
      .filter(r => r.itemId === itemId)
      .reduce((s, r) => s + r.inversion, 0), [months]);

  const getTotalInversionForMonth = useCallback((monthKey: string) =>
    months.find(m => m.monthKey === monthKey)?.totalInversion || 0, [months]);

  return (
    <AdsContext.Provider value={{
      months, addMonth, removeMonth,
      getInversionForMonth, getTotalInversionForMonth, getRowsForMonth,
      loading, saving,
    }}>
      {children}
    </AdsContext.Provider>
  );
}

export function useAds() {
  return useContext(AdsContext);
}

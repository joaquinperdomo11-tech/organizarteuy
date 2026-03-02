"use client";
import { createContext, useContext, useState, ReactNode } from "react";

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

interface AdsContextType {
  ads: AdRow[];
  setAds: (ads: AdRow[]) => void;
  // Helper: get ad spend for a given itemId
  getInversionByItemId: (itemId: string) => number;
  // Total inversion for the loaded period
  totalInversion: number;
  // Period label
  periodo: string;
}

const AdsContext = createContext<AdsContextType>({
  ads: [],
  setAds: () => {},
  getInversionByItemId: () => 0,
  totalInversion: 0,
  periodo: "",
});

export function AdsProvider({ children }: { children: ReactNode }) {
  const [ads, setAds] = useState<AdRow[]>([]);

  // Build a lookup map: itemId → inversion
  const inversionByItemId: Record<string, number> = {};
  ads.forEach(a => {
    if (!inversionByItemId[a.itemId]) inversionByItemId[a.itemId] = 0;
    inversionByItemId[a.itemId] += a.inversion;
  });

  const totalInversion = ads.reduce((s, a) => s + a.inversion, 0);
  const periodo = ads[0] ? `${ads[0].desde} — ${ads[0].hasta}` : "";

  return (
    <AdsContext.Provider value={{
      ads,
      setAds,
      getInversionByItemId: (itemId: string) => inversionByItemId[itemId] || 0,
      totalInversion,
      periodo,
    }}>
      {children}
    </AdsContext.Provider>
  );
}

export function useAds() {
  return useContext(AdsContext);
}

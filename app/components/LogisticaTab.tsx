"use client";
import { useState, useMemo, useCallback } from "react";
import type { Order } from "@/lib/sheets";
import UruguayMap from "./UruguayMap";
import MontevideoMap from "./MontevideoMap";

const WEBAPP_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || "";

// ── Types ────────────────────────────────────────────────────────
interface ProveedorRow {
  numProveedor: string;
  idMeli: string;
  fechaEntrega: string;
  zona: string;
  precioProveedor: number;
  estadoProveedor: string;
  repartidor: string;
  direccion: string;
  tipo: string;
}

interface LogisticaMonth {
  monthKey: string;
  rows: ProveedorRow[];
}

interface ReconciliationRow {
  idMeli: string;
  numProveedor: string;
  fechaEntrega: string;
  zona: string;
  precioProveedor: number;
  repartidor: string;
  direccion: string;
  tipo: string;
  estadoProveedor: string;
  // from ML orders
  orderId?: string;
  producto?: string;
  shippingCostSeller?: number;
  tipoEnvio?: string;
  // result
  status: "ok" | "diff" | "not_found" | "not_billed";
  diff?: number;
}

interface LogisticaTabProps {
  orders: Order[];
  logisticaMonths: LogisticaMonth[];
  onSave: (month: LogisticaMonth) => Promise<void>;
  onDelete: (monthKey: string) => Promise<void>;
}

// ── PDF Parser ───────────────────────────────────────────────────
function parsePDF(text: string): { rows: ProveedorRow[]; monthKey: string } {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const rows: ProveedorRow[] = [];

  // Detect period from header line: "01/01/2026, 00:00 -> 31/01/2026"
  let monthKey = "";
  for (const line of lines) {
    const m = line.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) {
      monthKey = `${m[3]}-${m[2]}`;
      break;
    }
  }

  // Each data row pattern: starts with a number (Número), then ID Meli (long number), then date, etc.
  // Pattern: "1550303 46181981555 02/01/2026 - (30/12) MELI Montevideo 169 Repartidor Entregado Dirección"
  const rowRegex = /^(\d{5,8})\s+([\d]{8,}|)\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*\([^)]+\)\s*(MELI|Común|Common)?\s*(\w[\w\s]+?)\s+(\d{2,4})\s+(.*?)\s+(Entregado|Pendiente|En\scamino)\s*(.*)?$/i;

  for (const line of lines) {
    // Skip header lines
    if (line.startsWith("Número") || line.startsWith("Empresa") || line.startsWith("OrganizarteUY")) continue;
    if (line.match(/^(Número|ID Meli|Promesa|Tipo|Zona|Precio|Repartidor|Estado|Dirección)/i)) continue;

    // Try to parse data row
    const parts = line.split(/\s+/);
    if (parts.length < 6) continue;

    // First token should be numeric (Número)
    if (!/^\d{5,8}$/.test(parts[0])) continue;

    const numProveedor = parts[0];

    // Second token: ID Meli (long number) or date if no ID
    let idMeli = "";
    let dateIdx = 1;
    if (/^\d{10,}$/.test(parts[1])) {
      idMeli = parts[1];
      dateIdx = 2;
    }

    // Find date
    const dateMatch = parts.slice(dateIdx).join(" ").match(/(\d{2}\/\d{2}\/\d{4})/);
    const fechaEntrega = dateMatch ? dateMatch[1] : "";

    // Find tipo (MELI or Común)
    const tipo = line.includes("Común") ? "Común" : "MELI";

    // Find zona (Montevideo, Canelones, etc.)
    const zonaMatch = line.match(/\b(Montevideo|Canelones|Maldonado|Rocha|Rivera|Salto|Artigas|Paysandú|Soriano|Colonia|San José|Flores|Florida|Lavalleja|Durazno|Tacuarembó|Treinta y Tres|Cerro Largo|Río Negro)\b/i);
    const zona = zonaMatch ? zonaMatch[1] : "";

    // Find precio (2-3 digit number after zona)
    const precioMatch = line.match(/\b(169|180|200|290|310|350)\b/);
    const precioProveedor = precioMatch ? parseInt(precioMatch[1]) : 0;

    // Find estado
    const estadoMatch = line.match(/\b(Entregado|Pendiente|En camino)\b/i);
    const estadoProveedor = estadoMatch ? estadoMatch[1] : "";

    // Dirección: everything after "Entregado"
    const entregadoIdx = line.toLowerCase().indexOf("entregado");
    const direccion = entregadoIdx > -1 ? line.slice(entregadoIdx + "entregado".length).trim() : "";

    // Repartidor: text between precio and estado, excluding zona
    let repartidor = "";
    if (precioMatch && estadoMatch) {
      const precioPos = line.indexOf(precioMatch[0]);
      const estadoPos = line.indexOf(estadoMatch[0]);
      if (estadoPos > precioPos) {
        repartidor = line.slice(precioPos + precioMatch[0].length, estadoPos).trim();
      }
    }

    if (numProveedor && (fechaEntrega || idMeli)) {
      rows.push({ numProveedor, idMeli, fechaEntrega, zona, precioProveedor, estadoProveedor, repartidor, direccion, tipo });
    }
  }

  return { rows, monthKey };
}

// ── Reconciliation ───────────────────────────────────────────────
function reconcile(provRows: ProveedorRow[], orders: Order[], monthKey: string): ReconciliationRow[] {
  // Only FLEX orders for that month
  const flexOrders = orders.filter(o => {
    const d = new Date(o.fecha);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return key === monthKey && o.tipoEnvio === "FLEX";
  });

  const orderById = new Map(flexOrders.map(o => [String(o.orderId), o]));
  const billedIds = new Set<string>();
  const result: ReconciliationRow[] = [];

  // Process provider rows (only MELI type)
  for (const row of provRows.filter(r => r.tipo === "MELI" || !r.tipo)) {
    const order = orderById.get(row.idMeli);
    billedIds.add(row.idMeli);

    if (!order) {
      result.push({ ...row, status: "not_found" });
    } else {
      const diff = row.precioProveedor - (order.shippingCostSeller || 0);
      result.push({
        ...row,
        orderId: String(order.orderId),
        producto: order.producto,
        shippingCostSeller: order.shippingCostSeller,
        tipoEnvio: order.tipoEnvio,
        status: Math.abs(diff) < 1 ? "ok" : "diff",
        diff,
      });
    }
  }

  // Find FLEX orders not billed
  for (const order of flexOrders) {
    if (!billedIds.has(String(order.orderId))) {
      result.push({
        idMeli: String(order.orderId),
        numProveedor: "",
        fechaEntrega: order.fecha,
        zona: order.departamentoEntrega,
        precioProveedor: 0,
        repartidor: "",
        direccion: order.ciudadEntrega,
        tipo: "MELI",
        estadoProveedor: "",
        orderId: String(order.orderId),
        producto: order.producto,
        shippingCostSeller: order.shippingCostSeller,
        tipoEnvio: order.tipoEnvio,
        status: "not_billed",
      });
    }
  }

  return result;
}

// ── Helpers ──────────────────────────────────────────────────────
function fmt(n: number) {
  return `$${n.toLocaleString("es-UY")}`;
}

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y.slice(2)}`;
}

// ── Main Component ───────────────────────────────────────────────
export default function LogisticaTab({ orders, logisticaMonths, onSave, onDelete }: LogisticaTabProps) {
  const [activeSection, setActiveSection] = useState<"kpis" | "mapas" | "reconciliacion">("kpis");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(
    logisticaMonths.length > 0 ? logisticaMonths[logisticaMonths.length - 1].monthKey : null
  );
  const [uploading, setUploading]     = useState(false);
  const [parseError, setParseError]   = useState("");
  const [parsedPreview, setParsedPreview] = useState<{ rows: ProveedorRow[]; monthKey: string } | null>(null);
  const [saving, setSaving]           = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [mapMonths, setMapMonths]     = useState<string[]>([]);

  // KPI data
  const flexOrders = useMemo(() => orders.filter(o => o.tipoEnvio === "FLEX"), [orders]);
  const fullOrders = useMemo(() => orders.filter(o => o.tipoEnvio === "FULL"), [orders]);
  const meOrders   = useMemo(() => orders.filter(o => o.tipoEnvio === "MERCADO ENVIOS"), [orders]);

  const totalEnviosCost = useMemo(() =>
    orders.reduce((s, o) => s + o.shippingCostSeller - o.bonificacionEnvio, 0), [orders]);
  const totalBonif = useMemo(() =>
    orders.reduce((s, o) => s + o.bonificacionEnvio, 0), [orders]);
  const flexCost = useMemo(() =>
    flexOrders.reduce((s, o) => s + o.shippingCostSeller, 0), [flexOrders]);
  const avgFlex = flexOrders.length > 0 ? flexCost / flexOrders.length : 0;

  // Reconciliation
  const currentMonthData = useMemo(() =>
    logisticaMonths.find(m => m.monthKey === selectedMonth),
    [logisticaMonths, selectedMonth]
  );

  const reconciliation = useMemo(() => {
    if (!currentMonthData || !selectedMonth) return [];
    return reconcile(currentMonthData.rows, orders, selectedMonth);
  }, [currentMonthData, orders, selectedMonth]);

  const reconStats = useMemo(() => {
    const ok        = reconciliation.filter(r => r.status === "ok").length;
    const diff      = reconciliation.filter(r => r.status === "diff");
    const notFound  = reconciliation.filter(r => r.status === "not_found").length;
    const notBilled = reconciliation.filter(r => r.status === "not_billed").length;
    const totalDiff = diff.reduce((s, r) => s + (r.diff || 0), 0);
    return { ok, diff: diff.length, notFound, notBilled, totalDiff };
  }, [reconciliation]);

  // PDF upload
  const handlePDF = useCallback(async (file: File) => {
    setParseError("");
    setParsedPreview(null);
    setUploading(true);

    try {
      // Load pdf.js from CDN
      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) {
        // Dynamically load
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          script.onload = () => resolve();
          script.onerror = reject;
          document.head.appendChild(script);
        });
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        const lines: Record<number, string[]> = {};
        content.items.forEach((item: any) => {
          const y = Math.round(item.transform[5]);
          if (!lines[y]) lines[y] = [];
          lines[y].push(item.str);
        });
        const sorted = Object.keys(lines).map(Number).sort((a, b) => b - a);
        sorted.forEach(y => { fullText += lines[y].join(" ") + "\n"; });
      }

      const parsed = parsePDF(fullText);

      if (parsed.rows.length === 0) {
        setParseError("No se pudieron parsear filas del PDF. Verificá el formato.");
      } else {
        setParsedPreview(parsed);
      }
    } catch (e: any) {
      setParseError("Error al leer el PDF: " + e.message);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleSave = async () => {
    if (!parsedPreview) return;
    setSaving(true);
    try {
      await onSave({ monthKey: parsedPreview.monthKey, rows: parsedPreview.rows });
      setSelectedMonth(parsedPreview.monthKey);
      setParsedPreview(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } finally {
      setSaving(false);
    }
  };

  const mapOrders = useMemo(() => orders.map(o => ({
    departamentoEntrega: o.departamentoEntrega || "",
    ciudadEntrega: o.ciudadEntrega || "",
    totalItem: o.totalItem,
    fecha: o.fecha,
  })), [orders]);

  const availableMonths = useMemo(() => {
    const s = new Set(orders.map(o => {
      const d = new Date(o.fecha);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }));
    return Array.from(s).sort();
  }, [orders]);

  const now = new Date();
  const defaultMapMonths = useMemo(() =>
    availableMonths.filter(m => m.startsWith(String(now.getFullYear()))),
    [availableMonths]
  );
  const activeMapMonths = mapMonths.length > 0 ? mapMonths : defaultMapMonths;

  return (
    <div className="space-y-4">
      {/* Section nav */}
      <div className="flex gap-2">
        {(["kpis", "mapas", "reconciliacion"] as const).map(s => (
          <button key={s} onClick={() => setActiveSection(s)}
            className={`px-4 py-2 text-sm font-mono rounded-xl border transition-all ${
              activeSection === s
                ? "bg-brand-yellow text-brand-dark border-brand-yellow font-bold"
                : "border-brand-border text-brand-sub hover:border-brand-yellow/40 hover:text-brand-text"
            }`}>
            {s === "kpis" ? "📊 KPIs" : s === "mapas" ? "🗺️ Mapas" : "🔍 Reconciliación"}
          </button>
        ))}
      </div>

      {/* ── KPIs ── */}
      {activeSection === "kpis" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: "Órdenes FLEX",    value: flexOrders.length,  suffix: "", color: "text-orange-400" },
              { label: "Órdenes FULL",    value: fullOrders.length,  suffix: "", color: "text-yellow-400" },
              { label: "Mercado Envíos",  value: meOrders.length,    suffix: "", color: "text-blue-400" },
              { label: "Costo neto envíos", value: totalEnviosCost,  suffix: "", prefix: "$", color: "text-brand-text" },
              { label: "Bonificaciones",  value: totalBonif,         suffix: "", prefix: "$", color: "text-green-400" },
            ].map(kpi => (
              <div key={kpi.label} className="bg-brand-card border border-brand-border rounded-2xl p-4">
                <p className="text-brand-sub text-xs font-mono uppercase tracking-wider mb-2">{kpi.label}</p>
                <p className={`font-display font-bold text-2xl sm:text-3xl ${kpi.color}`}>
                  {kpi.prefix}{kpi.value.toLocaleString("es-UY")}
                </p>
              </div>
            ))}
          </div>

          {/* Breakdown por tipo */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
            <h4 className="font-display font-semibold text-brand-text mb-4">Costo promedio por tipo de envío</h4>
            <div className="space-y-3">
              {[
                { label: "FLEX",           orders: flexOrders, color: "#FF6B35" },
                { label: "FULL",           orders: fullOrders, color: "#FFE500" },
                { label: "Mercado Envíos", orders: meOrders,   color: "#88AAFF" },
              ].map(item => {
                const cost = item.orders.reduce((s, o) => s + o.shippingCostSeller - o.bonificacionEnvio, 0);
                const avg  = item.orders.length > 0 ? cost / item.orders.length : 0;
                const pct  = orders.length > 0 ? (item.orders.length / orders.filter(o => o.tipoEnvio !== "SIN ENVÍO").length) * 100 : 0;
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-brand-sub text-xs font-mono w-28 shrink-0">{item.label}</span>
                    <div className="flex-1 h-2 bg-brand-dark rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color }} />
                    </div>
                    <span className="text-brand-text text-xs font-mono w-20 text-right">{item.orders.length} envíos</span>
                    <span className="text-brand-yellow text-xs font-mono w-20 text-right">{fmt(Math.round(avg))} avg</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Mapas ── */}
      {activeSection === "mapas" && (
        <div className="space-y-4">
          {/* Month filter */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span className="text-brand-sub text-xs font-mono uppercase tracking-wider">Filtrar por mes</span>
              <button onClick={() => setMapMonths([])}
                className="px-2 py-0.5 text-xs font-mono border border-brand-border rounded hover:border-brand-yellow/50 hover:text-brand-yellow text-brand-sub transition-all">
                {String(now.getFullYear())}
              </button>
              <button onClick={() => setMapMonths([...availableMonths])}
                className="px-2 py-0.5 text-xs font-mono border border-brand-border rounded hover:border-brand-yellow/50 hover:text-brand-yellow text-brand-sub transition-all">
                Todo
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availableMonths.map(month => {
                const selected = activeMapMonths.includes(month);
                return (
                  <button key={month} onClick={() => {
                    const base = mapMonths.length > 0 ? mapMonths : defaultMapMonths;
                    setMapMonths(base.includes(month) ? base.filter(m => m !== month) : [...base, month]);
                  }}
                    className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-all ${
                      selected
                        ? "bg-brand-yellow text-brand-dark border-brand-yellow font-bold"
                        : "border-brand-border text-brand-sub hover:border-brand-yellow/40"
                    }`}>
                    {monthLabel(month)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-6">
            <h3 className="font-display font-semibold text-brand-text text-lg mb-5">Mapa de Entregas</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              <UruguayMap orders={mapOrders} selectedMonths={activeMapMonths} />
              <MontevideoMap orders={mapOrders} selectedMonths={activeMapMonths} />
            </div>
          </div>
        </div>
      )}

      {/* ── Reconciliación ── */}
      {activeSection === "reconciliacion" && (
        <div className="space-y-4">
          {/* Upload */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
            <h4 className="font-display font-semibold text-brand-text mb-1">Cargar estado de cuenta</h4>
            <p className="text-brand-sub text-sm mb-4">Subí el PDF del proveedor para reconciliar los envíos FLEX del mes</p>

            <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${
              uploading ? "border-brand-yellow/50 bg-brand-yellow/5" : "border-brand-border hover:border-brand-yellow/40 hover:bg-brand-dark"
            }`}>
              <input type="file" accept=".pdf" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handlePDF(e.target.files[0]); }} />
              <span className="text-3xl mb-2">{uploading ? "⏳" : "📄"}</span>
              <span className="text-brand-text font-mono text-sm">
                {uploading ? "Leyendo PDF..." : "Arrastrá o hacé click para subir el PDF"}
              </span>
              <span className="text-brand-muted text-xs font-mono mt-1">Estado_de_Cuenta_*.pdf</span>
            </label>

            {saveSuccess && (
              <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
                <p className="text-green-400 text-sm font-mono">✅ Guardado correctamente en Sheets. Seleccioná el mes abajo para ver la reconciliación.</p>
              </div>
            )}
              <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm font-mono">{parseError}</p>
              </div>
            )}

            {parsedPreview && (
              <div className="mt-4 bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-green-400 font-mono font-bold text-sm">
                      ✅ {parsedPreview.rows.length} filas parseadas — {monthLabel(parsedPreview.monthKey)}
                    </p>
                    <p className="text-brand-sub text-xs font-mono mt-1">
                      MELI: {parsedPreview.rows.filter(r => r.tipo === "MELI" || !r.tipo).length} ·
                      Común: {parsedPreview.rows.filter(r => r.tipo === "Común").length} ·
                      Zonas: {Array.from(new Set(parsedPreview.rows.map(r => r.zona))).filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <button onClick={handleSave} disabled={saving}
                    className="px-4 py-2 bg-brand-yellow text-brand-dark font-mono font-bold text-sm rounded-xl hover:bg-brand-yellow/90 transition-all disabled:opacity-50">
                    {saving ? "Guardando..." : "Guardar en Sheets"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Month selector */}
          {logisticaMonths.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {logisticaMonths.map(m => (
                <button key={m.monthKey} onClick={() => setSelectedMonth(m.monthKey)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-xl border transition-all ${
                    selectedMonth === m.monthKey
                      ? "bg-brand-yellow text-brand-dark border-brand-yellow font-bold"
                      : "border-brand-border text-brand-sub hover:border-brand-yellow/40"
                  }`}>
                  {monthLabel(m.monthKey)} ({m.rows.length} envíos)
                </button>
              ))}
            </div>
          )}

          {/* Reconciliation results */}
          {selectedMonth && currentMonthData && reconciliation.length > 0 && (
            <div className="space-y-4">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "✅ Coinciden",      value: reconStats.ok,        color: "text-green-400" },
                  { label: "⚠️ Diferencia",     value: reconStats.diff,      color: "text-yellow-400" },
                  { label: "❌ No encontrado",  value: reconStats.notFound,  color: "text-red-400" },
                  { label: "🔍 Sin cobrar",     value: reconStats.notBilled, color: "text-blue-400" },
                ].map(k => (
                  <div key={k.label} className="bg-brand-card border border-brand-border rounded-2xl p-4">
                    <p className="text-brand-sub text-xs font-mono mb-1">{k.label}</p>
                    <p className={`font-display font-bold text-2xl ${k.color}`}>{k.value}</p>
                  </div>
                ))}
              </div>

              {reconStats.totalDiff !== 0 && (
                <div className={`rounded-xl px-4 py-3 border ${reconStats.totalDiff > 0 ? "bg-red-500/10 border-red-500/30" : "bg-green-500/10 border-green-500/30"}`}>
                  <p className={`font-mono font-bold text-sm ${reconStats.totalDiff > 0 ? "text-red-400" : "text-green-400"}`}>
                    {reconStats.totalDiff > 0
                      ? `⚠️ Te cobraron ${fmt(Math.abs(reconStats.totalDiff))} de más en total`
                      : `✅ Te cobraron ${fmt(Math.abs(reconStats.totalDiff))} de menos en total`}
                  </p>
                </div>
              )}

              {/* Table */}
              <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-brand-border">
                        {["", "ID Meli", "Fecha", "Zona", "Precio Prov.", "Precio ML", "Diferencia", "Producto", "Repartidor"].map(h => (
                          <th key={h} className="text-left px-3 py-3 text-brand-sub font-mono uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliation.map((row, i) => {
                        const statusIcon = row.status === "ok" ? "✅" : row.status === "diff" ? "⚠️" : row.status === "not_found" ? "❌" : "🔍";
                        const rowClass = row.status === "ok" ? "" :
                          row.status === "diff" ? "bg-yellow-500/5" :
                          row.status === "not_found" ? "bg-red-500/5" : "bg-blue-500/5";
                        return (
                          <tr key={i} className={`border-b border-brand-border/40 ${rowClass}`}>
                            <td className="px-3 py-2 text-center">{statusIcon}</td>
                            <td className="px-3 py-2 font-mono text-brand-sub">{row.idMeli || "—"}</td>
                            <td className="px-3 py-2 font-mono text-brand-sub whitespace-nowrap">{row.fechaEntrega}</td>
                            <td className="px-3 py-2 font-mono text-brand-sub">{row.zona}</td>
                            <td className="px-3 py-2 font-mono text-brand-text font-bold">
                              {row.precioProveedor > 0 ? fmt(row.precioProveedor) : "—"}
                            </td>
                            <td className="px-3 py-2 font-mono text-brand-sub">
                              {row.shippingCostSeller !== undefined ? fmt(row.shippingCostSeller) : "—"}
                            </td>
                            <td className={`px-3 py-2 font-mono font-bold ${row.diff && row.diff > 0 ? "text-red-400" : row.diff && row.diff < 0 ? "text-green-400" : "text-brand-muted"}`}>
                              {row.diff !== undefined && row.diff !== 0 ? (row.diff > 0 ? `+${fmt(row.diff)}` : fmt(row.diff)) : "—"}
                            </td>
                            <td className="px-3 py-2 text-brand-sub max-w-[180px] truncate">{row.producto || "—"}</td>
                            <td className="px-3 py-2 text-brand-muted max-w-[140px] truncate">{row.repartidor || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Delete button */}
              <div className="flex justify-end">
                <button onClick={() => onDelete(selectedMonth)}
                  className="px-3 py-1.5 text-xs font-mono border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-all">
                  🗑 Eliminar {monthLabel(selectedMonth)}
                </button>
              </div>
            </div>
          )}

          {selectedMonth && !currentMonthData && (
            <div className="bg-brand-card border border-brand-border rounded-2xl p-8 text-center">
              <p className="text-brand-sub font-mono text-sm">No hay estado de cuenta cargado para este mes.</p>
              <p className="text-brand-muted font-mono text-xs mt-1">Subí el PDF del proveedor arriba.</p>
            </div>
          )}

          {logisticaMonths.length === 0 && !parsedPreview && (
            <div className="bg-brand-card border border-brand-border rounded-2xl p-8 text-center">
              <p className="text-brand-sub font-mono text-sm">Aún no cargaste ningún estado de cuenta.</p>
              <p className="text-brand-muted font-mono text-xs mt-1">Subí el PDF del mes anterior para empezar.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

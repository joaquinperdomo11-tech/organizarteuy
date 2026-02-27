// ─────────────────────────────────────────────────────────────────
// Fuente de datos: Google Apps Script Webapp
// No requiere Google Cloud ni Service Account.
// Solo configurá APPS_SCRIPT_URL en tus variables de entorno.
// ─────────────────────────────────────────────────────────────────

export interface Order {
  orderId: string;
  fecha: string;
  hora: string;
  producto: string;
  sku: string;
  cantidad: number;
  precioUnitario: number;
  totalItem: number;
  comisionML: number;
  netoSinEnvio: number;
  logisticMode: string;
  logisticType: string;
  tipoEnvio: string;
  shipmentId: string;
  shippingCostSeller: number;
  bonificacionEnvio: number;
  margenReal: number;
  medioPago: string;
  cuotas: number;
  estado: string;
  buyer: string;
}

export interface DashboardData {
  orders: Order[];
  summary: {
    totalRevenue: number;
    totalMargen: number;
    totalComisiones: number;
    totalEnvios: number;
    totalOrders: number;
    totalUnits: number;
    avgOrderValue: number;
    avgMargen: number;
    margenPct: number;
  };
  revenueByDay: { date: string; revenue: number; margen: number; orders: number }[];
  revenueByMonth: { month: string; revenue: number; margen: number; orders: number }[];
  topProducts: { name: string; sku: string; units: number; revenue: number; margen: number }[];
  tipoEnvioBreakdown: { tipo: string; count: number; color: string }[];
  medioPagoBreakdown: { medio: string; count: number; revenue: number }[];
  cuotasBreakdown: { cuotas: string; count: number }[];
}

const ENVIO_COLORS: Record<string, string> = {
  "FULL": "#FFE500",
  "FLEX": "#FF6B35",
  "MERCADO ENVIOS": "#88AAFF",
  "ENVIO POR FUERA": "#AA88FF",
  "RETIRO": "#44DDAA",
  "SIN ENVÍO": "#555577",
  "OTRO TIPO": "#888899",
};

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

export async function fetchDashboardData(): Promise<DashboardData> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) throw new Error("APPS_SCRIPT_URL no está configurada en las variables de entorno.");

  const res = await fetch(url, {
    next: { revalidate: parseInt(process.env.REVALIDATE_SECONDS || "300") },
  });
  if (!res.ok) throw new Error(`Error al llamar al Apps Script: ${res.status} ${res.statusText}`);

  const raw: Record<string, unknown>[] = await res.json();
  if (!Array.isArray(raw)) throw new Error("El Apps Script no devolvió un array JSON válido.");

  const orders: Order[] = raw.map((r) => ({
    orderId: String(r["Order ID"] ?? ""),
    fecha: String(r["Fecha"] ?? ""),
    hora: String(r["Hora"] ?? ""),
    producto: String(r["Producto"] ?? ""),
    sku: String(r["SKU"] ?? ""),
    cantidad: Number(r["Cantidad"]) || 1,
    precioUnitario: Number(r["Precio Unitario"]) || 0,
    totalItem: Number(r["Total Item"]) || 0,
    comisionML: Number(r["Comisión Total ML"]) || 0,
    netoSinEnvio: Number(r["Neto Sin Envío"]) || 0,
    logisticMode: String(r["Logistic Mode"] ?? ""),
    logisticType: String(r["Logistic Type (API)"] ?? ""),
    tipoEnvio: String(r["Tipo Envío (Clasificado)"] ?? "SIN ENVÍO"),
    shipmentId: String(r["Shipment ID"] ?? ""),
    shippingCostSeller: Number(r["Shipping Cost Seller"]) || 0,
    bonificacionEnvio: Number(r["Bonificación Envío"]) || 0,
    margenReal: Number(r["Margen Real Final"]) || 0,
    medioPago: String(r["Medio de Pago"] ?? ""),
    cuotas: Number(r["Cuotas"]) || 1,
    estado: String(r["Estado"] ?? ""),
    buyer: String(r["Buyer"] ?? ""),
  }));

  return processData(orders);
}

function processData(orders: Order[]): DashboardData {
  const totalRevenue = orders.reduce((s, o) => s + o.totalItem, 0);
  const totalMargen = orders.reduce((s, o) => s + o.margenReal, 0);
  const totalComisiones = orders.reduce((s, o) => s + o.comisionML, 0);
  const totalEnviosBruto = orders.reduce((s, o) => s + o.shippingCostSeller, 0);
  const totalBonif = orders.reduce((s, o) => s + o.bonificacionEnvio, 0);
  const totalEnvios = totalEnviosBruto - totalBonif;
  const totalUnits = orders.reduce((s, o) => s + o.cantidad, 0);

  // Revenue por día
  const dayMap: Record<string, { revenue: number; margen: number; orders: number }> = {};
  orders.forEach((o) => {
    const d = new Date(o.fecha);
    if (isNaN(d.getTime())) return;
    const key = d.toISOString().split("T")[0];
    if (!dayMap[key]) dayMap[key] = { revenue: 0, margen: 0, orders: 0 };
    dayMap[key].revenue += o.totalItem;
    dayMap[key].margen += o.margenReal;
    dayMap[key].orders += 1;
  });

  const revenueByDay = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // Revenue por mes
  const monthMap: Record<string, { revenue: number; margen: number; orders: number }> = {};
  orders.forEach((o) => {
    const d = new Date(o.fecha);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { revenue: 0, margen: 0, orders: 0 };
    monthMap[key].revenue += o.totalItem;
    monthMap[key].margen += o.margenReal;
    monthMap[key].orders += 1;
  });

  const revenueByMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  // Top productos
  const productMap: Record<string, { sku: string; units: number; revenue: number; margen: number }> = {};
  orders.forEach((o) => {
    const key = o.producto || "Sin título";
    if (!productMap[key]) productMap[key] = { sku: o.sku, units: 0, revenue: 0, margen: 0 };
    productMap[key].units += o.cantidad;
    productMap[key].revenue += o.totalItem;
    productMap[key].margen += o.margenReal;
  });

  const topProducts = Object.entries(productMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Tipo de envío
  const envioMap: Record<string, number> = {};
  orders.forEach((o) => {
    envioMap[o.tipoEnvio] = (envioMap[o.tipoEnvio] || 0) + 1;
  });

  const tipoEnvioBreakdown = Object.entries(envioMap)
    .map(([tipo, count]) => ({ tipo, count, color: ENVIO_COLORS[tipo] || "#555577" }))
    .sort((a, b) => b.count - a.count);

  // Medio de pago
  const pagoMap: Record<string, { count: number; revenue: number }> = {};
  orders.forEach((o) => {
    const key = o.medioPago;
    if (!pagoMap[key]) pagoMap[key] = { count: 0, revenue: 0 };
    pagoMap[key].count += 1;
    pagoMap[key].revenue += o.totalItem;
  });

  const medioPagoBreakdown = Object.entries(pagoMap)
    .map(([medio, v]) => ({ medio: PAGO_LABELS[medio] || medio, ...v }))
    .sort((a, b) => b.count - a.count);

  // Cuotas
  const cuotasMap: Record<string, number> = {};
  orders.forEach((o) => {
    const key = o.cuotas === 1 ? "Contado" : `${o.cuotas} cuotas`;
    cuotasMap[key] = (cuotasMap[key] || 0) + 1;
  });

  const cuotasBreakdown = Object.entries(cuotasMap)
    .map(([cuotas, count]) => ({ cuotas, count }))
    .sort((a, b) => {
      if (a.cuotas === "Contado") return -1;
      if (b.cuotas === "Contado") return 1;
      return parseInt(a.cuotas) - parseInt(b.cuotas);
    });

  return {
    orders,
    summary: {
      totalRevenue,
      totalMargen,
      totalComisiones,
      totalEnvios,
      totalOrders: orders.length,
      totalUnits,
      avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
      avgMargen: orders.length > 0 ? totalMargen / orders.length : 0,
      margenPct: totalRevenue > 0 ? (totalMargen / totalRevenue) * 100 : 0,
    },
    revenueByDay,
    revenueByMonth,
    topProducts,
    tipoEnvioBreakdown,
    medioPagoBreakdown,
    cuotasBreakdown,
  };
}

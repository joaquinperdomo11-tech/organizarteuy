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
  itemIdML: string;
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
  estadoEnvio: string;
  ciudadEntrega: string;
  departamentoEntrega: string;
}

export interface StockItem {
  "Item ID ML": string;
  "SKU": string;
  "Título": string;
  "Stock Disponible": number;
  "Precio": number;
  "Estado": string;
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
  waterfallData: { name: string; value: number; total: number; color: string; isTotal: boolean }[];
  heatmap: { day: number; hour: number; count: number; revenue: number }[];
  skuPerformance: {
    sku: string;
    name: string;
    itemIdML: string;
    units: number;
    revenue: number;
    margen: number;
    comision: number;
    envio: number;
    margenPct: number;
  }[];
  currentMonth: {
    revenue: number;
    margen: number;
    comisiones: number;
    envios: number;
    orders: number;
    units: number;
    margenPct: number;
    avgMargen: number;
    avgOrderValue: number;
  };
  prevMonth: {
    revenue: number;
    margen: number;
    comisiones: number;
    envios: number;
    orders: number;
    units: number;
    margenPct: number;
    avgMargen: number;
    avgOrderValue: number;
  };
  revenueCurrentMonth: { day: number; revenue: number; margen: number; orders: number }[];
  revenuePrevMonth: { day: number; revenue: number; margen: number; orders: number }[];
  projection: {
    projectedRevenue: number;
    projectedMargen: number;
    projectedOrders: number;
    daysElapsed: number;
    daysInMonth: number;
    dailyData: { day: number; revenue: number; margen: number; orders: number }[];
  };
  stock: StockItem[];
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

  const json = await res.json();
  
  // Handle both old format (array) and new format ({orders, stock})
  const rawOrders: Record<string, unknown>[] = Array.isArray(json) ? json : (json.orders || []);
  const rawStock: StockItem[] = Array.isArray(json) ? [] : (json.stock || []);

  if (!Array.isArray(rawOrders)) throw new Error("El Apps Script no devolvió un array JSON válido.");

  const orders: Order[] = rawOrders
  .filter((r) => String(r["Estado"] ?? "") !== "cancelled")
  .map((r) => ({
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
    itemIdML: String(r["Item ID ML"] ?? ""),
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
    estadoEnvio: String(r["Estado Envío"] ?? ""),
    ciudadEntrega: String(r["Ciudad Entrega"] ?? ""),
    departamentoEntrega: String(r["Departamento Entrega"] ?? ""),
  }));

  return processData(orders, rawStock);
}

function parseHora(horaStr: string): number {
  // Formato ISO: "1899-12-30T23:26:25.000Z" → extraer hora UTC
  try {
    const d = new Date(horaStr);
    if (!isNaN(d.getTime())) return d.getUTCHours();
  } catch {}
  // Formato HH:mm:ss
  const parts = horaStr.split(":");
  if (parts.length >= 1) return parseInt(parts[0]) || 0;
  return 0;
}

function processData(orders: Order[], stock: StockItem[] = []): DashboardData {
  const totalRevenue = orders.reduce((s, o) => s + o.totalItem, 0);
  const totalMargen = orders.reduce((s, o) => s + o.margenReal, 0);
  const totalComisiones = orders.reduce((s, o) => s + o.comisionML, 0);
  const totalEnviosBruto = orders.reduce((s, o) => s + o.shippingCostSeller, 0);
  const totalBonif = orders.reduce((s, o) => s + o.bonificacionEnvio, 0);
  const totalEnvios = totalEnviosBruto - totalBonif;
  const totalUnits = orders.reduce((s, o) => s + o.cantidad, 0);

  // ── Revenue por día ──────────────────────────────────────────
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

  // ── Revenue por mes ──────────────────────────────────────────
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

  // ── Top productos ────────────────────────────────────────────
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

  // ── Tipo de envío ────────────────────────────────────────────
  const envioMap: Record<string, number> = {};
  orders.forEach((o) => {
    envioMap[o.tipoEnvio] = (envioMap[o.tipoEnvio] || 0) + 1;
  });

  const tipoEnvioBreakdown = Object.entries(envioMap)
    .map(([tipo, count]) => ({ tipo, count, color: ENVIO_COLORS[tipo] || "#555577" }))
    .sort((a, b) => b.count - a.count);

  // ── Medio de pago ────────────────────────────────────────────
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

  // ── Cuotas ───────────────────────────────────────────────────
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

  // ── Waterfall: Ingreso → Margen ──────────────────────────────
  // Recharts waterfall trick: each bar = [start, end]
  // We use a composed bar with invisible base + colored bar
  const waterfallData = [
    {
      name: "Ingreso bruto",
      value: totalRevenue,
      total: totalRevenue,
      color: "#FFE500",
      isTotal: false,
    },
    {
      name: "Comisiones ML",
      value: -totalComisiones,
      total: totalRevenue - totalComisiones,
      color: "#FF4466",
      isTotal: false,
    },
    {
      name: "Costo envíos",
      value: -totalEnviosBruto,
      total: totalRevenue - totalComisiones - totalEnviosBruto,
      color: "#FF6B35",
      isTotal: false,
    },
    {
      name: "Bonif. envíos",
      value: totalBonif,
      total: totalRevenue - totalComisiones - totalEnviosBruto + totalBonif,
      color: "#44DDAA",
      isTotal: false,
    },
    {
      name: "Margen real",
      value: totalMargen,
      total: totalMargen,
      color: "#88AAFF",
      isTotal: true,
    },
  ];

  // ── Heatmap día × hora ───────────────────────────────────────
  // day: 0=Dom, 1=Lun ... 6=Sab | hour: 0-23
  const heatmapMap: Record<string, { count: number; revenue: number }> = {};

  orders.forEach((o) => {
    const d = new Date(o.fecha);
    if (isNaN(d.getTime())) return;
    const day = d.getUTCDay(); // 0-6
    const hour = parseHora(o.hora);
    const key = `${day}-${hour}`;
    if (!heatmapMap[key]) heatmapMap[key] = { count: 0, revenue: 0 };
    heatmapMap[key].count += 1;
    heatmapMap[key].revenue += o.totalItem;
  });

  const heatmap: { day: number; hour: number; count: number; revenue: number }[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const key = `${day}-${hour}`;
      heatmap.push({
        day,
        hour,
        count: heatmapMap[key]?.count || 0,
        revenue: heatmapMap[key]?.revenue || 0,
      });
    }
  }

  // ── SKU Performance ──────────────────────────────────────────
  const skuMap: Record<string, {
    name: string; itemIdML: string; units: number; revenue: number;
    margen: number; comision: number; envio: number;
  }> = {};

  orders.forEach((o) => {
    const key = o.sku || o.producto?.slice(0, 20) || "SIN SKU";
    if (!skuMap[key]) {
      skuMap[key] = { name: o.producto, itemIdML: o.itemIdML || '', units: 0, revenue: 0, margen: 0, comision: 0, envio: 0 };
    }
    skuMap[key].units += o.cantidad;
    skuMap[key].revenue += o.totalItem;
    skuMap[key].margen += o.margenReal;
    skuMap[key].comision += o.comisionML;
    skuMap[key].envio += (o.shippingCostSeller - o.bonificacionEnvio);
  });

  const skuPerformance = Object.entries(skuMap)
    .map(([sku, v]) => ({
      sku,
      ...v,
      margenPct: v.revenue > 0 ? (v.margen / v.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── Mes actual vs mes anterior ──────────────────────────────
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth(); // 0-indexed
  const curDay = now.getDate();

  const prevMonthDate = new Date(curYear, curMonth - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth();

  const currentMonthOrders = orders.filter((o) => {
    const d = new Date(o.fecha);
    return d.getFullYear() === curYear && d.getMonth() === curMonth;
  });

  // Same day range in previous month (e.g. if today is Feb 27, compare Jan 1-27)
  const prevMonthOrders = orders.filter((o) => {
    const d = new Date(o.fecha);
    return d.getFullYear() === prevYear && d.getMonth() === prevMonth && d.getDate() <= curDay;
  });

  function calcPeriodSummary(ords: typeof orders) {
    const rev = ords.reduce((s, o) => s + o.totalItem, 0);
    const mar = ords.reduce((s, o) => s + o.margenReal, 0);
    const com = ords.reduce((s, o) => s + o.comisionML, 0);
    const env = ords.reduce((s, o) => s + o.shippingCostSeller - o.bonificacionEnvio, 0);
    const uni = ords.reduce((s, o) => s + o.cantidad, 0);
    return {
      revenue: rev,
      margen: mar,
      comisiones: com,
      envios: env,
      orders: ords.length,
      units: uni,
      margenPct: rev > 0 ? (mar / rev) * 100 : 0,
      avgMargen: ords.length > 0 ? mar / ords.length : 0,
      avgOrderValue: ords.length > 0 ? rev / ords.length : 0,
    };
  }

  const currentMonth = calcPeriodSummary(currentMonthOrders);
  const prevMonthData = calcPeriodSummary(prevMonthOrders);

  // Day-by-day for current month and prev month
  const revenueCurrentMonth: { day: number; revenue: number; margen: number; orders: number }[] = [];
  const revenuePrevMonth: { day: number; revenue: number; margen: number; orders: number }[] = [];

  // Current month: fill all days 1..curDay
  for (let d = 1; d <= curDay; d++) {
    const dayOrders = currentMonthOrders.filter((o) => new Date(o.fecha).getDate() === d);
    revenueCurrentMonth.push({
      day: d,
      revenue: dayOrders.reduce((s, o) => s + o.totalItem, 0),
      margen: dayOrders.reduce((s, o) => s + o.margenReal, 0),
      orders: dayOrders.length,
    });
  }

  // Prev month: same days 1..curDay
  for (let d = 1; d <= curDay; d++) {
    const dayOrders = prevMonthOrders.filter((o) => new Date(o.fecha).getDate() === d);
    revenuePrevMonth.push({
      day: d,
      revenue: dayOrders.reduce((s, o) => s + o.totalItem, 0),
      margen: dayOrders.reduce((s, o) => s + o.margenReal, 0),
      orders: dayOrders.length,
    });
  }

  // ── Proyección ajustada con mes anterior ─────────────────────
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const daysElapsed = curDay;
  const daysRemaining = daysInMonth - daysElapsed;

  // Revenue acumulado mes anterior completo (todos los días del mes)
  const prevMonthAllOrders = orders.filter((o) => {
    const d = new Date(o.fecha);
    return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
  });
  const prevMonthDays = new Date(prevYear, prevMonth + 1, 0).getDate();

  // Peso relativo de cada día en el mes anterior
  // peso[d] = revenue del día d del mes anterior / revenue total del mes anterior
  const prevDayRevenue: Record<number, number> = {};
  const prevDayMargen: Record<number, number> = {};
  const prevDayOrders: Record<number, number> = {};
  for (let d = 1; d <= prevMonthDays; d++) {
    const dayOrds = prevMonthAllOrders.filter(o => new Date(o.fecha).getDate() === d);
    prevDayRevenue[d] = dayOrds.reduce((s, o) => s + o.totalItem, 0);
    prevDayMargen[d]  = dayOrds.reduce((s, o) => s + o.margenReal, 0);
    prevDayOrders[d]  = dayOrds.length;
  }
  const prevTotalRevenue = Object.values(prevDayRevenue).reduce((s, v) => s + v, 0);
  const prevTotalMargen  = Object.values(prevDayMargen).reduce((s, v) => s + v, 0);
  const prevTotalOrders  = Object.values(prevDayOrders).reduce((s, v) => s + v, 0);

  // Revenue actual acumulado en los días transcurridos
  const curTotalRevenue = currentMonthOrders.reduce((s, o) => s + o.totalItem, 0);
  const curTotalMargen  = currentMonthOrders.reduce((s, o) => s + o.margenReal, 0);
  const curTotalOrders  = currentMonthOrders.length;

  // Factor de ajuste: qué % del mes anterior se hizo en los días transcurridos
  const prevWeightElapsed = prevTotalRevenue > 0
    ? Object.entries(prevDayRevenue)
        .filter(([d]) => parseInt(d) <= daysElapsed)
        .reduce((s, [, v]) => s + v, 0) / prevTotalRevenue
    : daysElapsed / prevMonthDays;

  const prevWeightRemaining = 1 - prevWeightElapsed;

  // Proyección: si el ritmo actual se mantiene proporcional al patrón del mes anterior
  // projected = curActual / prevWeightElapsed * 1 (escalar al mes completo)
  const projectedRevenue = prevWeightElapsed > 0 ? curTotalRevenue / prevWeightElapsed : curTotalRevenue;
  const projectedMargen  = prevWeightElapsed > 0 ? curTotalMargen  / prevWeightElapsed : curTotalMargen;
  const projectedOrders  = prevWeightElapsed > 0 ? curTotalOrders  / prevWeightElapsed : curTotalOrders;

  // Day-by-day projection data (real hasta hoy, proyectado para los días restantes)
  const projectionDailyData: { day: number; revenue: number; margen: number; orders: number }[] = [];

  // Days already elapsed: use real data
  for (let d = 1; d <= daysElapsed; d++) {
    const dayOrds = currentMonthOrders.filter(o => new Date(o.fecha).getDate() === d);
    projectionDailyData.push({
      day: d,
      revenue: dayOrds.reduce((s, o) => s + o.totalItem, 0),
      margen:  dayOrds.reduce((s, o) => s + o.margenReal, 0),
      orders:  dayOrds.length,
    });
  }

  // Remaining days: distribute remaining projected revenue using prev month weights
  const prevWeightRemainingDays = Object.entries(prevDayRevenue)
    .filter(([d]) => parseInt(d) > daysElapsed)
    .reduce((s, [, v]) => s + v, 0);

  const remainingRevenue = projectedRevenue - curTotalRevenue;
  const remainingMargen  = projectedMargen  - curTotalMargen;
  const remainingOrders  = projectedOrders  - curTotalOrders;

  for (let d = daysElapsed + 1; d <= daysInMonth; d++) {
    const dayWeight = prevWeightRemainingDays > 0 ? (prevDayRevenue[d] || 0) / prevWeightRemainingDays : 1 / daysRemaining;
    projectionDailyData.push({
      day: d,
      revenue: Math.max(0, remainingRevenue * dayWeight),
      margen:  Math.max(0, remainingMargen  * dayWeight),
      orders:  Math.max(0, remainingOrders  * dayWeight),
    });
  }

  const projection = {
    projectedRevenue,
    projectedMargen,
    projectedOrders,
    daysElapsed,
    daysInMonth,
    dailyData: projectionDailyData,
  };

    return {
    orders,
      stock,
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
    waterfallData,
    heatmap,
    skuPerformance,
    currentMonth,
    prevMonth: prevMonthData,
    revenueCurrentMonth,
    revenuePrevMonth,
    projection,
  };
}

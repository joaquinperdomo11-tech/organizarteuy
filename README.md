# 🛒 ML Dashboard — MercadoLibre Analytics

Dashboard interactivo que consume datos en tiempo real desde tu Google Apps Script.

## Stack
- **Next.js 14** (App Router + API Routes)
- **Google Apps Script** como backend/API (sin Google Cloud)
- **Recharts** para gráficos
- **Tailwind CSS**
- **Vercel** para hosting

---

## Setup en 4 pasos

### 1. Instalá dependencias
```bash
npm install
```

### 2. Configurá la variable de entorno
```bash
cp .env.local.example .env.local
```

Editá `.env.local` y pegá la URL de tu Apps Script:
```env
APPS_SCRIPT_URL=https://script.google.com/macros/s/TU_ID/exec
```

### 3. Corré en local
```bash
npm run dev
```
Abrí http://localhost:3000

### 4. Deploy en Vercel
1. Push a GitHub
2. Importar en https://vercel.com/new
3. Agregar variable de entorno `APPS_SCRIPT_URL`
4. Deploy ✅

---

## Estructura
```
app/
  api/dashboard/route.ts   → llama a tu Apps Script
  components/
    Dashboard.tsx           → layout principal
    StatCard.tsx            → KPIs animados
    RevenueChart.tsx        → gráfico ingresos/margen/órdenes
    Charts.tsx              → top productos + tipo envío
    OrdersTable.tsx         → tabla con filtros
lib/
  sheets.ts                 → fetch + procesamiento de datos
```

## Métricas incluidas
- Ingresos brutos, Margen real, Comisiones ML, Costo de envíos
- Ticket promedio, margen promedio, margen %
- Evolución diaria y mensual (con toggle ingresos/margen/órdenes)
- Top 10 productos por ingresos
- Distribución por tipo de envío (FULL, FLEX, Mercado Envíos, etc.)
- Medios de pago y cuotas
- Tabla completa con búsqueda, filtros y ordenamiento

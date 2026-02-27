"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

interface TopProductsProps {
  products: { name: string; units: number; revenue: number }[];
}

interface StatusChartProps {
  data: { tipo: string; count: number; color: string }[];
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function truncate(str: string, n = 25) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

export function TopProductsChart({ products }: TopProductsProps) {
  const data = products
    .slice(0, 8)
    .map((p) => ({ ...p, name: truncate(p.name) }));

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <h3 className="font-display font-semibold text-brand-text text-lg mb-1">
        Top Productos
      </h3>
      <p className="text-brand-sub text-sm mb-6">Por ingresos generados</p>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            tickFormatter={formatCurrency}
            tick={{ fill: "#8888AA", fontSize: 10, fontFamily: "DM Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={160}
            tick={{ fill: "#E8E8F0", fontSize: 11, fontFamily: "DM Sans" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v: number) => [formatCurrency(v), "Ingresos"]}
            contentStyle={{
              background: "#0A0A0F",
              border: "1px solid #1E1E2E",
              borderRadius: "10px",
              fontFamily: "DM Sans",
              color: "#E8E8F0",
            }}
            cursor={{ fill: "rgba(255,229,0,0.04)" }}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={i === 0 ? "#FFE500" : `rgba(255,229,0,${0.7 - i * 0.07})`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({
  cx, cy, midAngle, innerRadius, outerRadius, percent,
}: any) => {
  if (percent < 0.06) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#0A0A0F"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontFamily="DM Mono"
      fontWeight="bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function StatusChart({ data }: StatusChartProps) {
  const pieData = data.map((d) => ({
    name: StatusLabel[d.status] || d.tipo,
    value: d.count,
    color: d.color,
  }));

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <h3 className="font-display font-semibold text-brand-text text-lg mb-1">
        Estado de Órdenes
      </h3>
      <p className="text-brand-sub text-sm mb-4">Distribución por tipo de envio</p>

      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={3}
            dataKey="value"
            labelLine={false}
            label={renderCustomLabel}
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Legend
            formatter={(value) => (
              <span style={{ color: "#8888AA", fontSize: 12, fontFamily: "DM Sans" }}>
                {value}
              </span>
            )}
          />
          <Tooltip
            formatter={(v: number, name: string) => [v + " órdenes", name]}
            contentStyle={{
              background: "#111118",
              border: "1px solid #1E1E2E",
              borderRadius: "10px",
              fontFamily: "DM Sans",
              color: "#E8E8F0",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

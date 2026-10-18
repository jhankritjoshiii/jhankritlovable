import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, PageHeader, Panel, axisProps, tooltipStyle } from "@/components/AppShell";
import { useDataset } from "@/lib/dataset-context";
import { DAYS, MONTHS, dailySeries, inr } from "@/lib/data";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/stores")({
  head: () => pageMeta("Stores & demand patterns", "Store comparison, category mix by store, and weekday × month demand heatmap."),
  component: Stores,
});

function Stores() {
  const { rows, category, categories } = useDataset();
  const scoped = useMemo(() => rows.filter((r) => category === "ALL" || r.category === category), [rows, category]);
  const d = useMemo(() => {
    const m = new Map<string, Record<string, number | string>>();
    scoped.forEach((r) => {
      const k = `${r.store_id} · ${r.store_location}`;
      const o = m.get(k) ?? { store: k, revenue: 0, quantity: 0 };
      o["revenue"] = (o["revenue"] as number) + r.revenue; o["quantity"] = (o["quantity"] as number) + r.quantity_sold;
      o[r.category] = ((o[r.category] as number) ?? 0) + r.revenue; m.set(k, o);
    });
    const stores = [...m.values()].sort((a, b) => String(a["store"]).localeCompare(String(b["store"])));
    // Heatmap: average daily revenue by weekday × month
    const daily = dailySeries(scoped);
    const grid = DAYS.map(() => MONTHS.map(() => ({ s: 0, n: 0 })));
    daily.forEach((p) => { const dt = new Date(p.date + "T00:00:00Z"); const c = grid[dt.getUTCDay()][dt.getUTCMonth()]; c.s += p.value; c.n++; });
    const cells = grid.map((r) => r.map((c) => (c.n ? c.s / c.n : 0)));
    const flat = cells.flat().filter((x) => x > 0);
    return { stores, cells, min: Math.min(...flat), max: Math.max(...flat) };
  }, [scoped]);
  const cats = category === "ALL" ? categories : [category];

  return (
    <>
      <PageHeader title="Stores & demand patterns" subtitle="Compare simulated store performance and see when demand peaks. Store filter is ignored here so all stores can be compared." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Revenue by store" note="₹ after discounts, stacked by category">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={d.stores}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="store" {...axisProps} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis {...axisProps} tickFormatter={inr} width={70} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => inr(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {cats.map((c, i) => <Bar key={c} dataKey={c} stackId="a" fill={CHART_COLORS[i % 7]} />)}
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Units sold by store" note="Total units">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={d.stores}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="store" {...axisProps} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis {...axisProps} width={70} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => Math.round(v).toLocaleString("en-IN")} />
              <Bar dataKey="quantity" name="Units" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <Panel title="Demand heatmap: weekday × month" note="Average daily revenue across all stores (darker = higher). Weekend and festive-season peaks are part of the simulation." className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-xs">
            <thead><tr><th />{MONTHS.map((m) => <th key={m} className="font-medium text-muted-foreground">{m}</th>)}</tr></thead>
            <tbody>
              {DAYS.map((day, r) => (
                <tr key={day}>
                  <td className="pr-2 text-right text-muted-foreground">{day.slice(0, 3)}</td>
                  {d.cells[r].map((v, c) => {
                    const t = v ? (v - d.min) / (d.max - d.min || 1) : 0;
                    return <td key={c} title={`${day}, ${MONTHS[c]}: ${inr(v)} avg/day`} className="h-9 rounded text-center"
                      style={{ background: `color-mix(in oklab, var(--primary) ${Math.round(10 + t * 85)}%, var(--card))`, color: t > 0.5 ? "var(--primary-foreground)" : "var(--foreground)" }}>
                      {v ? `${(v / 1000).toFixed(0)}k` : "–"}
                    </td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

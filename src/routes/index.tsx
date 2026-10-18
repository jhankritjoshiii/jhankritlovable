import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, Kpi, PageHeader, Panel, axisProps, tooltipStyle } from "@/components/AppShell";
import { useDataset } from "@/lib/dataset-context";
import { MONTHS, dailySeries, groupSum, inr, num } from "@/lib/data";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/")({
  head: () => pageMeta("Overview", "Retail sales KPIs, trends and category mix for a simulated Indian retail network."),
  component: Overview,
});

function Overview() {
  const { filtered } = useDataset();
  const d = useMemo(() => {
    let rev = 0, qty = 0; const prods = new Set<string>(), stores = new Set<string>();
    filtered.forEach((r) => { rev += r.revenue; qty += r.quantity_sold; prods.add(r.product_id); stores.add(r.store_id); });
    const daily = dailySeries(filtered);
    const weekly: { week: string; revenue: number }[] = [];
    for (let i = 0; i < daily.length; i += 7) weekly.push({ week: daily[i].date, revenue: daily.slice(i, i + 7).reduce((s, p) => s + p.value, 0) });
    const monthly = [...groupSum(filtered, (r) => r.date.slice(0, 7))].sort().map(([m, v]) => ({ month: `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`, revenue: v.revenue }));
    const cats = [...groupSum(filtered, (r) => r.category)].map(([name, v]) => ({ name, value: v.revenue })).sort((a, b) => b.value - a.value);
    return { rev, qty, prods: prods.size, stores: stores.size, days: daily.length, weekly, monthly, cats, range: daily.length ? `${daily[0].date} → ${daily[daily.length - 1].date}` : "" };
  }, [filtered]);

  return (
    <>
      <PageHeader title="Sales overview" subtitle={`Business performance across the selected stores and categories · ${d.range}`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total revenue" value={inr(d.rev)} hint="After discounts" />
        <Kpi label="Units sold" value={num(d.qty)} />
        <Kpi label="Products" value={String(d.prods)} />
        <Kpi label="Stores" value={String(d.stores)} hint={`${d.days} days of history`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Weekly revenue trend" note="Sum of daily revenue per 7-day block (₹)" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={d.weekly}>
              <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="week" {...axisProps} minTickGap={40} />
              <YAxis {...axisProps} tickFormatter={inr} width={70} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => inr(v)} labelFormatter={(l) => `Week from ${l}`} />
              <Area isAnimationActive={false} dataKey="revenue" name="Revenue" stroke="var(--chart-1)" fill="url(#g1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Category contribution" note="Share of revenue">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={d.cats} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {d.cats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % 7]} />)}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v: number) => inr(v)} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-2 space-y-1 text-xs">
            {d.cats.map((c, i) => (
              <li key={c.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % 7] }} />{c.name}</span>
                <span className="text-muted-foreground">{((c.value / d.rev) * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel title="Monthly revenue" note="Total revenue per calendar month (₹)" className="mt-6">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={d.monthly}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={inr} width={70} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => inr(v)} />
            <Bar dataKey="revenue" name="Revenue" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </>
  );
}

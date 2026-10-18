import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { PageHeader, Panel, axisProps, tooltipStyle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useDataset } from "@/lib/dataset-context";
import { downloadCsv, groupSum, inr, num, round2 } from "@/lib/data";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/products")({
  head: () => pageMeta("Product performance", "Top and lowest-performing products by revenue and units, with discount patterns."),
  component: Products,
});

function Products() {
  const { filtered } = useDataset();
  const d = useMemo(() => {
    const meta = new Map<string, { cat: string; price: number }>();
    filtered.forEach((r) => meta.set(r.product_name, { cat: r.category, price: r.unit_price }));
    const list = [...groupSum(filtered, (r) => r.product_name)].map(([name, v]) => ({ name, category: meta.get(name)!.cat, unit_price: meta.get(name)!.price, revenue: round2(v.revenue), quantity: v.quantity }));
    const disc = [...groupSum(filtered, (r) => String(r.discount_percentage))].map(([k, v]) => ({ k: Number(k), v }));
    const days = new Map<number, Set<string>>();
    filtered.forEach((r) => { const s = days.get(r.discount_percentage) ?? new Set(); s.add(r.date + r.store_id + r.product_id); days.set(r.discount_percentage, s); });
    const discount = disc.map(({ k, v }) => ({ discount: `${k}%`, k, avgUnits: v.quantity / days.get(k)!.size })).sort((a, b) => a.k - b.k);
    return {
      list,
      byRev: [...list].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      byQty: [...list].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
      low: [...list].sort((a, b) => a.revenue - b.revenue).slice(0, 5),
      discount,
    };
  }, [filtered]);

  return (
    <>
      <PageHeader title="Product performance" subtitle="Which items drive revenue and volume, and how price and discounts relate to sales.">
        <Button variant="outline" onClick={() => downloadCsv("product_performance.csv", d.list)}>Download CSV</Button>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Top 10 by revenue" note="₹ after discounts">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={d.byRev} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={inr} />
              <YAxis type="category" dataKey="name" {...axisProps} width={150} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => inr(v)} />
              <Bar dataKey="revenue" name="Revenue" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Top 10 by units sold" note="Total units">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={d.byQty} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={num} />
              <YAxis type="category" dataKey="name" {...axisProps} width={150} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => num(v)} />
              <Bar dataKey="quantity" name="Units" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Price vs units sold" note="Each dot is a product; bubble size = revenue">
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart>
              <CartesianGrid stroke="var(--border)" />
              <XAxis type="number" dataKey="unit_price" name="Unit price" unit=" ₹" {...axisProps} />
              <YAxis type="number" dataKey="quantity" name="Units" {...axisProps} tickFormatter={num} width={70} />
              <ZAxis dataKey="revenue" range={[40, 400]} name="Revenue" />
              <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => (n === "Revenue" ? inr(v) : num(v))} labelFormatter={() => ""} />
              <Scatter data={d.list} fill="var(--chart-3)" fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Discount level vs average units" note="Average units per product-store-day at each discount level">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.discount}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="discount" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => v.toFixed(1)} />
              <Bar dataKey="avgUnits" name="Avg units" fill="var(--forecast)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <Panel title="Lowest-performing products" note="Bottom 5 by revenue — candidates for range or placement review" className="mt-6">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Product</th><th>Category</th><th className="text-right">Units</th><th className="text-right">Revenue</th></tr></thead>
          <tbody>{d.low.map((p) => <tr key={p.name} className="border-t"><td className="py-2">{p.name}</td><td>{p.category}</td><td className="text-right">{num(p.quantity)}</td><td className="text-right">{inr(p.revenue)}</td></tr>)}</tbody>
        </table>
      </Panel>
    </>
  );
}

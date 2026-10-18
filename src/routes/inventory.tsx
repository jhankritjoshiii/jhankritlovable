import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDataset } from "@/lib/dataset-context";
import { dailySeries, downloadCsv, num } from "@/lib/data";
import { reorderQuantity, weekdayAverageForecast } from "@/lib/forecast";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/inventory")({
  head: () => pageMeta("Inventory planner", "Illustrative reorder suggestions from 7-day unit demand forecasts, lead time and safety stock."),
  component: Inventory,
});

// Deterministic illustrative stock: between 2 and 8 days of recent average demand.
const simStock = (avg: number, key: string) => {
  let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Math.round(avg * (2 + (h % 600) / 100));
};

function Inventory() {
  const { filtered, store } = useDataset();
  const [lead, setLead] = useState(3);
  const [review, setReview] = useState(7);
  const [safetyDays, setSafetyDays] = useState(2);
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const items = useMemo(() => {
    const byP = new Map<string, typeof filtered>();
    filtered.forEach((r) => { const a = byP.get(r.product_name) ?? []; a.push(r); byP.set(r.product_name, a); });
    return [...byP].map(([name, rows]) => {
      const s = dailySeries(rows, "quantity_sold");
      const f7 = weekdayAverageForecast(s, 7);
      const avg = f7.reduce((a, b) => a + b, 0) / 7;
      return { name, category: rows[0].category, f7, avg, simulated: simStock(avg, name + store) };
    }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [filtered, store]);

  const protection = lead + review;
  const table = items.map((it) => {
    const demand = it.avg * protection; // first 7 days from forecast, extended at its daily average
    const safety = Math.ceil(it.avg * safetyDays);
    const stock = overrides[it.name] ?? it.simulated;
    const reorder = reorderQuantity(demand, safety, stock);
    return { ...it, demand, safety, stock, reorder };
  });

  return (
    <>
      <PageHeader title="Inventory planner" subtitle={`Illustrative reorder suggestions for ${store === "ALL" ? "all stores combined" : store}. Current stock is simulated (not real inventory) — edit any value.`}>
        <Button variant="outline" onClick={() => downloadCsv("inventory_recommendations.csv", table.map((t) => ({ product: t.name, category: t.category, current_stock_illustrative: t.stock, forecast_units_7d: Math.round(t.f7.reduce((a, b) => a + b, 0)), protection_period_days: protection, demand_protection_period: Math.round(t.demand), safety_stock: t.safety, suggested_reorder: t.reorder })))}>Export CSV</Button>
      </PageHeader>
      <Panel title="Assumptions" note="Protection period = supplier lead time + review interval">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Supplier lead time (days)" value={lead} set={setLead} />
          <Field label="Review interval (days)" value={review} set={setReview} />
          <Field label="Safety stock (days of demand)" value={safetyDays} set={setSafetyDays} />
        </div>
        <p className="mt-4 rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <b className="text-foreground">Suggested reorder = max(0, forecast demand during protection period + safety stock − current stock).</b> Unit demand per product is forecast as the average of the same weekday over the last 4 weeks; beyond 7 days it is extended at the forecast daily average. Recommendations are illustrative and do not guarantee lower costs or zero stockouts.
        </p>
      </Panel>
      <Panel title={`Reorder suggestions · ${protection}-day protection period`} className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-2">Product</th><th>Category</th><th className="text-right">Forecast 7d</th><th className="text-right">Demand ({protection}d)</th><th className="text-right">Safety</th><th className="w-28 text-right">Current stock</th><th className="text-right">Reorder</th></tr>
            </thead>
            <tbody>
              {table.map((t) => (
                <tr key={t.name} className="border-t">
                  <td className="py-2 font-medium">{t.name}</td>
                  <td className="text-muted-foreground">{t.category}</td>
                  <td className="text-right">{num(t.f7.reduce((a, b) => a + b, 0))}</td>
                  <td className="text-right">{num(t.demand)}</td>
                  <td className="text-right">{num(t.safety)}</td>
                  <td className="py-1 text-right"><Input type="number" min={0} className="h-8 text-right" value={t.stock} onChange={(e) => setOverrides((o) => ({ ...o, [t.name]: Math.max(0, Number(e.target.value) || 0) }))} /></td>
                  <td className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.reorder > 0 ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      {t.reorder > 0 ? num(t.reorder) : "None"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function Field({ label, value, set }: { label: string; value: number; set: (n: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} max={60} value={value} onChange={(e) => set(Math.max(0, Math.min(60, Number(e.target.value) || 0)))} />
    </div>
  );
}

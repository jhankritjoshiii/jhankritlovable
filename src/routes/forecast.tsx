import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Kpi, PageHeader, Panel, axisProps, tooltipStyle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useDataset } from "@/lib/dataset-context";
import { DAYS, dailySeries, downloadCsv, dowOf, inr, round2 } from "@/lib/data";
import { runForecast, type Metrics } from "@/lib/forecast";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/forecast")({
  head: () => pageMeta("7-day revenue forecast", "Machine learning forecast of daily revenue for the next seven days, evaluated against a seasonal-naive baseline."),
  component: Forecast,
});

const pct = (w: number | null) => (w === null ? "n/a" : `${(w * 100).toFixed(1)}%`);

function Forecast() {
  const { filtered, holidays, store, category } = useDataset();
  const series = useMemo(() => dailySeries(filtered), [filtered]);
  const res = useMemo(() => runForecast(series, holidays), [series, holidays]);

  if (!res.ok) return (<><PageHeader title="7-day revenue forecast" /><div className="rounded-xl border border-destructive bg-card p-6 text-sm text-destructive">{res.reason}</div></>);

  const hist = series.slice(-42).map((p) => ({ date: p.date, actual: p.value }));
  const lastDate = hist[hist.length - 1].date;
  const chart = [...hist.slice(0, -1), { ...hist[hist.length - 1], forecast: hist[hist.length - 1].actual }, ...res.future.map((f) => ({ date: f.date, forecast: f.predicted }))];
  const better = res.test.model.mae < res.test.baseline.mae;

  return (
    <>
      <PageHeader title="7-day revenue forecast" subtitle={`Target: total daily revenue (₹) for ${store === "ALL" ? "all stores" : store} · ${category === "ALL" ? "all categories" : category}. Change filters in the sidebar to retrain for that level.`}>
        <Button variant="outline" onClick={() => downloadCsv("forecast_7day.csv", res.future.map((f) => ({ date: f.date, day: DAYS[dowOf(f.date)], predicted_revenue: round2(f.predicted), model: res.modelName })))}>Download forecast</Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Next 7 days (predicted)" value={inr(res.future.reduce((s, f) => s + f.predicted, 0))} hint="Sum of daily forecasts" />
        <Kpi label="Test MAE · model" value={inr(res.test.model.mae)} hint={`Baseline ${inr(res.test.baseline.mae)}`} />
        <Kpi label="Test WAPE · model" value={pct(res.test.model.wape)} hint={`Baseline ${pct(res.test.baseline.wape)}`} />
        <Kpi label="Selected model" value="Ridge" hint={`λ = ${res.lambda}, chosen on validation`} />
      </div>
      <Panel title="History and forecast" note="Solid = observed history (last 6 weeks). Dashed = predicted values." className="mt-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chart}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" {...axisProps} minTickGap={30} />
            <YAxis {...axisProps} tickFormatter={inr} width={70} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => inr(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine x={lastDate} stroke="var(--muted-foreground)" strokeDasharray="2 2" label={{ value: "Forecast origin", fontSize: 10, fill: "var(--muted-foreground)" }} />
            <Line dataKey="actual" name="Observed" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
            <Line dataKey="forecast" name="Predicted" stroke="var(--forecast)" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Forecast table" note="Predicted, not observed">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Date</th><th>Day</th><th className="text-right">Revenue</th></tr></thead>
            <tbody>{res.future.map((f) => <tr key={f.date} className="border-t"><td className="py-1.5">{f.date}</td><td>{DAYS[dowOf(f.date)].slice(0, 3)}</td><td className="text-right font-medium">{inr(f.predicted)}</td></tr>)}</tbody>
          </table>
        </Panel>
        <Panel title="Held-out test: actual vs predicted" note={`Test period ${res.splits.test[0]} → ${res.splits.test[1]} (never seen during model selection)`} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={res.testSeries}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" {...axisProps} minTickGap={30} />
              <YAxis {...axisProps} tickFormatter={inr} width={70} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => inr(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="actual" name="Actual" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              <Line dataKey="model" name="Ridge model" stroke="var(--forecast)" strokeWidth={2} dot={false} />
              <Line dataKey="baseline" name="Seasonal-naive" stroke="var(--chart-7)" strokeDasharray="3 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <Panel title="Model evaluation" note="Chronological split — no shuffling. Lower is better for all metrics." className="mt-6">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Period</th><th>Method</th><th className="text-right">MAE</th><th className="text-right">RMSE</th><th className="text-right">WAPE</th></tr></thead>
          <tbody>
            {([["Validation", res.validation], ["Test", res.test]] as const).map(([p, m]) =>
              ([["Ridge model", m.model], ["Seasonal-naive baseline", m.baseline]] as [string, Metrics][]).map(([n, x]) => (
                <tr key={p + n} className="border-t"><td className="py-2">{p}</td><td>{n}</td><td className="text-right">{inr(x.mae)}</td><td className="text-right">{inr(x.rmse)}</td><td className="text-right">{pct(x.wape)}</td></tr>
              )))}
          </tbody>
        </table>
        <div className="mt-4 grid gap-3 text-xs text-muted-foreground md:grid-cols-2">
          <p><b className="text-foreground">How it works.</b> Train {res.splits.train[0]} → {res.splits.train[1]}, validation {res.splits.val[0]} → {res.splits.val[1]}, test {res.splits.test[0]} → {res.splits.test[1]}. Features: weekday, month (cyclic), weekend, holiday flag, lags 1/7/14 days and 7/28-day rolling means of past values only. The 7 future days are predicted recursively — each prediction feeds the next day's lag features.</p>
          <p><b className="text-foreground">Reading the metrics.</b> MAE = average rupee error per day. RMSE also averages errors but penalises big misses more. WAPE = total absolute error ÷ total actual revenue. On this test period the model is {better ? "more accurate than" : "not better than"} the simple "same day last week" baseline. Forecasts are illustrative and not guaranteed.</p>
        </div>
      </Panel>
    </>
  );
}

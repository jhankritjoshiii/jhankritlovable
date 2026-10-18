import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Kpi, PageHeader, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useDataset } from "@/lib/dataset-context";
import { REQUIRED_COLUMNS, downloadCsv, parseAndValidateCsv } from "@/lib/data";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/data")({
  head: () => pageMeta("Data & quality", "Dataset source, generation assumptions, quality checks and CSV upload."),
  component: DataPage,
});

function DataPage() {
  const { rows, source, report, fileName, loadUploaded, resetSynthetic, filtered } = useDataset();
  const [errors, setErrors] = useState<string[]>([]);

  const onFile = async (f: File) => {
    const res = parseAndValidateCsv(await f.text());
    if (res.ok) { setErrors([]); loadUploaded(res.rows, res.report, f.name); }
    else setErrors(res.errors);
  };

  return (
    <>
      <PageHeader title="Data & quality" subtitle="Where the data comes from, how it was checked, and how to load your own file.">
        <Button variant="outline" onClick={() => downloadCsv("filtered_sales.csv", filtered as unknown as Record<string, unknown>[])}>Download filtered data</Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Source" value={source === "synthetic" ? "Synthetic" : "Uploaded"} hint={fileName ?? "Seed 42, reproducible"} />
        <Kpi label="Rows" value={rows.length.toLocaleString("en-IN")} />
        <Kpi label="Date range" value={`${rows[0]?.date.slice(0, 7)} → ${rows[rows.length - 1]?.date.slice(0, 7)}`} />
        <Kpi label="Columns" value={String(REQUIRED_COLUMNS.length)} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Upload a compatible CSV" note="Your file replaces the sample data only if it passes validation.">
          <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground" />
          {errors.length > 0 && (
            <div className="mt-3 rounded-md border border-destructive p-3 text-xs text-destructive">
              <b>Upload rejected — current data kept.</b>
              <ul className="mt-1 list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Required: date (YYYY-MM-DD), store_id, product_name, category, unit_price, quantity_sold. Optional: {REQUIRED_COLUMNS.filter((c) => !["date", "store_id", "product_name", "category", "unit_price", "quantity_sold"].includes(c)).join(", ")}.</p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => downloadCsv("sample_sales_template.csv", rows.slice(0, 200) as unknown as Record<string, unknown>[])}>Download sample template</Button>
            {source === "uploaded" && <Button variant="ghost" size="sm" onClick={resetSynthetic}>Return to synthetic data</Button>}
          </div>
        </Panel>
        <Panel title="Quality checks">
          {report ? (
            <ul className="space-y-1.5 text-sm">
              {([["Rows in file", report.totalRows], ["Valid rows kept", report.validRows], ["Duplicates removed", report.duplicatesRemoved], ["Rows with missing fields dropped", report.missingDropped], ["Rows with invalid values dropped", report.invalidDropped], ["Revenue recalculated", report.revenueRecalculated], ["Extreme quantities capped", report.outliersCapped], ["Calendar dates with no records (treated as zero sales)", report.missingDates]] as const).map(([k, v]) => (
                <li key={k} className="flex justify-between border-b pb-1"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v.toLocaleString("en-IN")}</span></li>
              ))}
            </ul>
          ) : (
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              <li>Generated without missing values, duplicates, or invalid prices/discounts.</li>
              <li>Every calendar day is present; zero quantities are genuine zero-sales days.</li>
              <li>Revenue = unit price × quantity × (1 − discount ÷ 100).</li>
              <li>Uploaded files: quantities above 3× a product's 99.5th percentile are capped.</li>
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="How the synthetic dataset is generated" className="mt-6">
        <ul className="grid list-disc gap-x-8 gap-y-1 pl-4 text-sm text-muted-foreground md:grid-cols-2">
          <li>Two years of daily records (Oct 2024 → Sep 2026), 6 fictional stores, 24 products in 7 categories.</li>
          <li>City names are simulated locations, not actual DMart stores.</li>
          <li>Each row is one product's daily sales at one store (Poisson-distributed units).</li>
          <li>Weekend uplift (Sat +25%, Sun +35%) and a gentle 12% upward trend.</li>
          <li>Seasonality: summer beverages, festive Oct–Nov surge for packaged foods and home care.</li>
          <li>Promotions on days 1–3 of each month and in festive windows (5–15% discount) lift demand.</li>
          <li>Holiday dates are illustrative and add a 50% uplift.</li>
          <li>No customer or personal information is generated. Fixed seed → identical data on every load.</li>
        </ul>
      </Panel>
    </>
  );
}

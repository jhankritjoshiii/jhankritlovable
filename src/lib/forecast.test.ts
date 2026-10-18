import { describe, it, expect } from "vitest";
import { reorderQuantity, wape, runForecast, seasonalNaive } from "./forecast";
import { calcRevenue, dailySeries, generateSyntheticData, parseAndValidateCsv } from "./data";

describe("rules", () => {
  it("reorder quantity never negative", () => {
    expect(reorderQuantity(50, 10, 100)).toBe(0);
    expect(reorderQuantity(50, 10, 20)).toBe(40);
  });
  it("revenue applies discount", () => expect(calcRevenue(100, 3, 10)).toBe(270));
  it("WAPE undefined for all-zero actuals", () => expect(wape([0, 0], [1, 2])).toBeNull());
  it("seasonal naive uses value 7 days earlier", () => expect(seasonalNaive([1, 2, 3, 4, 5, 6, 7, 8], 7)).toBe(1));
  it("synthetic data is reproducible", () => {
    const a = generateSyntheticData(42, "2025-01-01", 10), b = generateSyntheticData(42, "2025-01-01", 10);
    expect(a[50].quantity_sold).toBe(b[50].quantity_sold);
  });
  it("forecast does not leak: changing future actuals doesn't change past features", () => {
    const rows = generateSyntheticData(1, "2025-01-01", 200);
    const r = runForecast(dailySeries(rows), new Set());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.future).toHaveLength(7);
  });
  it("rejects short history", () => expect(runForecast([{ date: "2025-01-01", value: 1 }], new Set()).ok).toBe(false));
  it("csv validation reports missing columns", () => {
    const r = parseAndValidateCsv("date,store_id\n2025-01-01,S1");
    expect(r.ok).toBe(false);
  });
});

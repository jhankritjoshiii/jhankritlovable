// Synthetic retail dataset generator, CSV validation and aggregation helpers.
export interface SalesRow {
  transaction_id: string;
  date: string; // YYYY-MM-DD
  store_id: string;
  store_location: string;
  product_id: string;
  product_name: string;
  category: string;
  unit_price: number;
  quantity_sold: number;
  discount_percentage: number;
  revenue: number;
  day_of_week: string;
  month: number;
  holiday_flag: number;
}

export const REQUIRED_COLUMNS: (keyof SalesRow)[] = [
  "transaction_id", "date", "store_id", "store_location", "product_id", "product_name",
  "category", "unit_price", "quantity_sold", "discount_percentage", "revenue",
  "day_of_week", "month", "holiday_flag",
];

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STORES = [
  { id: "STORE_001", loc: "Delhi", mult: 1.25 },
  { id: "STORE_002", loc: "Mumbai", mult: 1.35 },
  { id: "STORE_003", loc: "Pune", mult: 1.0 },
  { id: "STORE_004", loc: "Bengaluru", mult: 1.15 },
  { id: "STORE_005", loc: "Jaipur", mult: 0.8 },
  { id: "STORE_006", loc: "Lucknow", mult: 0.75 },
];

const PRODUCTS: [string, string, number, number][] = [
  // name, category, price (INR), base daily units
  ["Basmati Rice 5kg", "Groceries", 520, 14],
  ["Toor Dal 1kg", "Groceries", 165, 22],
  ["Atta Whole Wheat 10kg", "Groceries", 445, 16],
  ["Refined Sunflower Oil 1L", "Groceries", 145, 26],
  ["Instant Noodles 4-pack", "Packaged Foods", 56, 40],
  ["Glucose Biscuits 800g", "Packaged Foods", 90, 30],
  ["Breakfast Cornflakes 500g", "Packaged Foods", 185, 9],
  ["Namkeen Mixture 400g", "Packaged Foods", 95, 18],
  ["Toned Milk 1L", "Dairy Products", 66, 60],
  ["Paneer 200g", "Dairy Products", 90, 20],
  ["Curd 400g", "Dairy Products", 45, 32],
  ["Table Butter 500g", "Dairy Products", 275, 8],
  ["Herbal Shampoo 340ml", "Personal Care", 210, 7],
  ["Bath Soap 4-pack", "Personal Care", 160, 13],
  ["Toothpaste 150g", "Personal Care", 98, 17],
  ["Detergent Powder 4kg", "Home Care", 480, 9],
  ["Dishwash Liquid 750ml", "Home Care", 135, 12],
  ["Floor Cleaner 1L", "Home Care", 190, 7],
  ["Tea Leaves 500g", "Beverages", 260, 15],
  ["Instant Coffee 100g", "Beverages", 320, 6],
  ["Mango Drink 1.2L", "Beverages", 75, 18],
  ["Garbage Bags 30pc", "Household Essentials", 99, 8],
  ["LED Bulb 9W", "Household Essentials", 110, 5],
  ["Aluminium Foil 9m", "Household Essentials", 125, 6],
];

// Illustrative festival / holiday dates used in the simulation.
const HOLIDAYS = new Set([
  "2024-10-12", "2024-10-31", "2024-11-01", "2024-11-02", "2024-12-25", "2025-01-01", "2025-01-14",
  "2025-01-26", "2025-03-14", "2025-03-31", "2025-04-18", "2025-08-15", "2025-08-16", "2025-08-27",
  "2025-10-02", "2025-10-20", "2025-10-21", "2025-10-22", "2025-12-25", "2026-01-01", "2026-01-14",
  "2026-01-26", "2026-03-04", "2026-03-21", "2026-04-03", "2026-08-15", "2026-08-28", "2026-09-14",
]);

const CAT_SEASON: Record<string, (m: number) => number> = {
  Beverages: (m) => (m >= 3 && m <= 6 ? 1.35 : m === 11 || m === 0 ? 0.9 : 1),
  "Dairy Products": (m) => (m >= 9 && m <= 10 ? 1.15 : 1),
  "Packaged Foods": (m) => (m === 9 || m === 10 ? 1.25 : 1),
  "Home Care": (m) => (m === 9 || m === 10 ? 1.4 : 1),
  "Household Essentials": (m) => (m === 9 || m === 10 ? 1.3 : 1),
  Groceries: () => 1,
  "Personal Care": () => 1,
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda: number, rnd: () => number) {
  if (lambda > 30) {
    const u = Math.max(rnd(), 1e-9), v = rnd();
    const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.max(0, Math.round(lambda + n * Math.sqrt(lambda)));
  }
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => {
  const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d);
};
export const dowOf = (s: string) => new Date(s + "T00:00:00Z").getUTCDay();

export const round2 = (x: number) => Math.round(x * 100) / 100;

/** Revenue convention: unit_price × quantity × (1 − discount%/100). */
export const calcRevenue = (price: number, qty: number, disc: number) => round2(price * qty * (1 - disc / 100));

export function generateSyntheticData(seed = 42, start = "2024-10-01", days = 730): SalesRow[] {
  const rnd = mulberry32(seed);
  const rows: SalesRow[] = [];
  let id = 1;
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const dow = dowOf(date);
    const month = Number(date.slice(5, 7)) - 1;
    const holiday = HOLIDAYS.has(date) ? 1 : 0;
    const weekMult = dow === 0 ? 1.35 : dow === 6 ? 1.25 : dow === 5 ? 1.05 : 0.92;
    const trend = 1 + (i / days) * 0.12;
    // Promotions: first 3 days of each month plus festive windows.
    const day = Number(date.slice(8, 10));
    const promo = day <= 3 || month === 9 || (month === 0 && day <= 15);
    for (const s of STORES) {
      for (let p = 0; p < PRODUCTS.length; p++) {
        const [name, cat, price, base] = PRODUCTS[p];
        const disc = promo ? [5, 10, 15][Math.floor(rnd() * 3)] : rnd() < 0.08 ? 5 : 0;
        const lam = base * s.mult * weekMult * trend * CAT_SEASON[cat](month) * (holiday ? 1.5 : 1) * (1 + disc / 40) * (0.9 + rnd() * 0.2);
        const qty = poisson(lam, rnd);
        rows.push({
          transaction_id: `TXN${String(id++).padStart(7, "0")}`,
          date, store_id: s.id, store_location: s.loc,
          product_id: `P${String(p + 1).padStart(3, "0")}`, product_name: name, category: cat,
          unit_price: price, quantity_sold: qty, discount_percentage: disc,
          revenue: calcRevenue(price, qty, disc), day_of_week: DAYS[dow], month: month + 1, holiday_flag: holiday,
        });
      }
    }
  }
  return rows;
}

// ---------- CSV ----------
function splitCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur); return out.map((x) => x.trim());
}

export interface QualityReport {
  totalRows: number; validRows: number; duplicatesRemoved: number; missingDropped: number;
  invalidDropped: number; revenueRecalculated: number; outliersCapped: number; missingDates: number;
  dateRange: [string, string];
}

export type ParseResult = { ok: true; rows: SalesRow[]; report: QualityReport } | { ok: false; errors: string[] };

export function parseAndValidateCsv(text: string): ParseResult {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
  if (lines.length < 2) return { ok: false, errors: ["The file is empty or has only a header row."] };
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  const required = ["date", "store_id", "product_name", "category", "unit_price", "quantity_sold"];
  const missingCore = missing.filter((c) => required.includes(c));
  if (missingCore.length) return { ok: false, errors: [`Missing required columns: ${missingCore.join(", ")}.`, `Expected columns: ${REQUIRED_COLUMNS.join(", ")}.`] };
  const idx = (c: string) => header.indexOf(c);
  const raw: SalesRow[] = []; let missingDropped = 0, invalidDropped = 0, revenueRecalculated = 0;
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = splitCsvLine(lines[i]);
    const g = (c: string) => (idx(c) >= 0 ? f[idx(c)] ?? "" : "");
    const date = g("date"), store = g("store_id"), name = g("product_name"), cat = g("category");
    if (!date || !store || !name || !cat || g("unit_price") === "" || g("quantity_sold") === "") { missingDropped++; continue; }
    const price = Number(g("unit_price")), qty = Number(g("quantity_sold"));
    const disc = g("discount_percentage") === "" ? 0 : Number(g("discount_percentage"));
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
    if (!validDate || !(price > 0) || !(qty >= 0) || !(disc >= 0 && disc <= 100) || isNaN(price + qty + disc)) {
      invalidDropped++; if (errors.length < 5) errors.push(`Row ${i + 1}: invalid date, price, quantity or discount.`); continue;
    }
    const rev = calcRevenue(price, qty, disc);
    const given = Number(g("revenue"));
    if (g("revenue") === "" || isNaN(given) || Math.abs(given - rev) > 0.05) revenueRecalculated++;
    const dow = dowOf(date);
    raw.push({
      transaction_id: g("transaction_id") || `ROW${i}`, date, store_id: store, store_location: g("store_location") || store,
      product_id: g("product_id") || name, product_name: name, category: cat, unit_price: price, quantity_sold: qty,
      discount_percentage: disc, revenue: rev, day_of_week: DAYS[dow], month: Number(date.slice(5, 7)),
      holiday_flag: Number(g("holiday_flag")) === 1 ? 1 : 0,
    });
  }
  if (!raw.length) return { ok: false, errors: ["No valid rows found after validation.", ...errors] };
  // duplicates by transaction id + date + store + product
  const seen = new Set<string>(); const rows: SalesRow[] = [];
  for (const r of raw) { const k = `${r.transaction_id}|${r.date}|${r.store_id}|${r.product_id}`; if (!seen.has(k)) { seen.add(k); rows.push(r); } }
  const outliersCapped = capOutliers(rows);
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const dates = new Set(rows.map((r) => r.date));
  const first = rows[0].date, last = rows[rows.length - 1].date;
  let span = 0; for (let d = first; d <= last; d = addDays(d, 1)) span++;
  return {
    ok: true, rows,
    report: { totalRows: lines.length - 1, validRows: rows.length, duplicatesRemoved: raw.length - rows.length, missingDropped, invalidDropped, revenueRecalculated, outliersCapped, missingDates: span - dates.size, dateRange: [first, last] },
  };
}

/** Cap quantities above the product's 99.5th percentile (keeps rows, limits extreme spikes). */
export function capOutliers(rows: SalesRow[]): number {
  const byP = new Map<string, number[]>();
  rows.forEach((r) => { const a = byP.get(r.product_id) ?? []; a.push(r.quantity_sold); byP.set(r.product_id, a); });
  const caps = new Map<string, number>();
  byP.forEach((a, k) => { const s = [...a].sort((x, y) => x - y); caps.set(k, s[Math.floor((s.length - 1) * 0.995)]); });
  let n = 0;
  rows.forEach((r) => { const c = caps.get(r.product_id)!; if (r.quantity_sold > c * 3 && c > 0) { r.quantity_sold = c; r.revenue = calcRevenue(r.unit_price, c, r.discount_percentage); n++; } });
  return n;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- Aggregation ----------
export function groupSum<K extends string>(rows: SalesRow[], key: (r: SalesRow) => K) {
  const m = new Map<K, { revenue: number; quantity: number }>();
  for (const r of rows) { const k = key(r); const v = m.get(k) ?? { revenue: 0, quantity: 0 }; v.revenue += r.revenue; v.quantity += r.quantity_sold; m.set(k, v); }
  return m;
}

/** Daily totals with missing calendar dates filled as 0 (dates with no records). */
export function dailySeries(rows: SalesRow[], field: "revenue" | "quantity_sold" = "revenue") {
  if (!rows.length) return [] as { date: string; value: number }[];
  const m = new Map<string, number>(); let min = rows[0].date, max = rows[0].date;
  for (const r of rows) { m.set(r.date, (m.get(r.date) ?? 0) + r[field]); if (r.date < min) min = r.date; if (r.date > max) max = r.date; }
  const out: { date: string; value: number }[] = [];
  for (let d = min; d <= max; d = addDays(d, 1)) out.push({ date: d, value: round2(m.get(d) ?? 0) });
  return out;
}

export const inr = (x: number) =>
  x >= 1e7 ? `₹${(x / 1e7).toFixed(2)} Cr` : x >= 1e5 ? `₹${(x / 1e5).toFixed(2)} L` : `₹${Math.round(x).toLocaleString("en-IN")}`;
export const num = (x: number) => Math.round(x).toLocaleString("en-IN");

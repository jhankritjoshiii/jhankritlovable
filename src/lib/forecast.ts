// Time-series forecasting: seasonal-naive baseline vs ridge regression on lag/calendar features.
import { addDays, dowOf } from "./data";

export interface Point { date: string; value: number }

export const mae = (a: number[], p: number[]) => a.reduce((s, x, i) => s + Math.abs(x - p[i]), 0) / a.length;
export const rmse = (a: number[], p: number[]) => Math.sqrt(a.reduce((s, x, i) => s + (x - p[i]) ** 2, 0) / a.length);
/** WAPE = Σ|actual − predicted| / Σ|actual|. Undefined (null) when actuals sum to zero. */
export const wape = (a: number[], p: number[]) => {
  const den = a.reduce((s, x) => s + Math.abs(x), 0);
  return den === 0 ? null : a.reduce((s, x, i) => s + Math.abs(x - p[i]), 0) / den;
};

export interface Metrics { mae: number; rmse: number; wape: number | null }
const metrics = (a: number[], p: number[]): Metrics => ({ mae: mae(a, p), rmse: rmse(a, p), wape: wape(a, p) });

/** Seasonal-naive: prediction for day t is the value on day t−7. */
export const seasonalNaive = (history: number[], t: number) => history[t - 7];

export const FEATURE_NAMES = [
  "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "month_sin", "month_cos", "weekend", "holiday",
  "lag_1", "lag_7", "lag_14", "roll_mean_7", "roll_mean_28",
];

/** Features for day index t, using only values strictly before t. */
export function features(values: number[], dates: string[], t: number, holidays: Set<string>): number[] {
  const dow = dowOf(dates[t]);
  const m = Number(dates[t].slice(5, 7)) - 1;
  const oh = [1, 2, 3, 4, 5, 6].map((d) => (dow === d ? 1 : 0));
  const mean = (a: number, b: number) => { let s = 0; for (let i = a; i < b; i++) s += values[i]; return s / (b - a); };
  return [
    ...oh, Math.sin((2 * Math.PI * m) / 12), Math.cos((2 * Math.PI * m) / 12),
    dow === 0 || dow === 6 ? 1 : 0, holidays.has(dates[t]) ? 1 : 0,
    values[t - 1], values[t - 7], values[t - 14], mean(t - 7, t), mean(t - 28, t),
  ];
}

export interface RidgeModel { w: number[]; mu: number[]; sd: number[]; yMu: number; lambda: number }

function solve(A: number[][], b: number[]): number[] {
  const n = b.length; const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}

export function fitRidge(X: number[][], y: number[], lambda: number): RidgeModel {
  const k = X[0].length;
  const mu = Array.from({ length: k }, (_, j) => X.reduce((s, r) => s + r[j], 0) / X.length);
  const sd = mu.map((m, j) => Math.sqrt(X.reduce((s, r) => s + (r[j] - m) ** 2, 0) / X.length) || 1);
  const Z = X.map((r) => r.map((v, j) => (v - mu[j]) / sd[j]));
  const yMu = y.reduce((s, v) => s + v, 0) / y.length;
  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => Z.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? lambda : 0)));
  const b = Array.from({ length: k }, (_, i) => Z.reduce((s, r, n) => s + r[i] * (y[n] - yMu), 0));
  return { w: solve(A, b), mu, sd, yMu, lambda };
}

export const predictRidge = (m: RidgeModel, x: number[]) =>
  Math.max(0, m.yMu + x.reduce((s, v, j) => s + ((v - m.mu[j]) / m.sd[j]) * m.w[j], 0));

export interface ForecastResult {
  ok: true;
  modelName: string; lambda: number;
  validation: { model: Metrics; baseline: Metrics };
  test: { model: Metrics; baseline: Metrics };
  testSeries: { date: string; actual: number; model: number; baseline: number }[];
  future: { date: string; predicted: number }[];
  splits: { train: [string, string]; val: [string, string]; test: [string, string] };
}

export const MIN_HISTORY = 120;

/**
 * Chronological split: train | validation (last 2×H before test) | test (final H days).
 * λ chosen on validation; final test metrics reported separately; then refit on all data
 * and forecast 7 days recursively (predictions feed later lags, never future actuals).
 */
export function runForecast(series: Point[], holidays: Set<string>, horizon = 7, testDays = 56): ForecastResult | { ok: false; reason: string } {
  if (series.length < MIN_HISTORY) return { ok: false, reason: `Need at least ${MIN_HISTORY} days of history; found ${series.length}.` };
  const v = series.map((p) => p.value), d = series.map((p) => p.date);
  const start = 28, n = v.length;
  const testStart = n - testDays, valStart = testStart - testDays;
  const rowsFor = (a: number, b: number) => { const X: number[][] = [], y: number[] = []; for (let t = a; t < b; t++) { X.push(features(v, d, t, holidays)); y.push(v[t]); } return { X, y }; };
  const tr = rowsFor(start, valStart), va = rowsFor(valStart, testStart), te = rowsFor(testStart, n);
  const baseOf = (a: number, b: number) => { const p: number[] = []; for (let t = a; t < b; t++) p.push(seasonalNaive(v, t)); return p; };

  let best: { m: RidgeModel; met: Metrics } | null = null;
  for (const lambda of [0.1, 1, 10, 50]) {
    const m = fitRidge(tr.X, tr.y, lambda);
    const met = metrics(va.y, va.X.map((x) => predictRidge(m, x)));
    if (!best || met.mae < best.met.mae) best = { m, met };
  }
  const lambda = best!.m.lambda;
  const valBase = metrics(va.y, baseOf(valStart, testStart));
  // Refit on train+validation for the test evaluation.
  const tv = rowsFor(start, testStart);
  const mTest = fitRidge(tv.X, tv.y, lambda);
  const testPred = te.X.map((x) => predictRidge(mTest, x));
  const testBase = baseOf(testStart, n);

  // Final model on all data; recursive 7-day forecast.
  const all = rowsFor(start, n);
  const mAll = fitRidge(all.X, all.y, lambda);
  const ext = [...v], extD = [...d];
  const future: { date: string; predicted: number }[] = [];
  for (let h = 0; h < horizon; h++) {
    const date = addDays(extD[extD.length - 1], 1); extD.push(date); ext.push(0);
    const t = ext.length - 1;
    const p = predictRidge(mAll, features(ext, extD, t, holidays));
    ext[t] = p; future.push({ date, predicted: p });
  }
  return {
    ok: true, modelName: "Ridge regression (lag + calendar features)", lambda,
    validation: { model: best!.met, baseline: valBase },
    test: { model: metrics(te.y, testPred), baseline: metrics(te.y, testBase) },
    testSeries: te.y.map((a, i) => ({ date: d[testStart + i], actual: a, model: testPred[i], baseline: testBase[i] })),
    future,
    splits: { train: [d[start], d[valStart - 1]], val: [d[valStart], d[testStart - 1]], test: [d[testStart], d[n - 1]] },
  };
}

/** Unit demand forecast per day: mean of the same weekday over the last 4 weeks. */
export function weekdayAverageForecast(series: Point[], horizon = 7): number[] {
  const out: number[] = []; const n = series.length;
  for (let h = 1; h <= horizon; h++) {
    const vals: number[] = [];
    for (let w = 1; w <= 4; w++) { const i = n + h - 1 - 7 * w; if (i >= 0) vals.push(series[i].value); }
    out.push(vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0);
  }
  return out;
}

/** Suggested reorder = max(0, demand during protection period + safety stock − current stock). */
export const reorderQuantity = (demand: number, safety: number, stock: number) => Math.max(0, Math.ceil(demand + safety - stock));

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { generateSyntheticData, type QualityReport, type SalesRow } from "./data";

interface Ctx {
  rows: SalesRow[];
  source: "synthetic" | "uploaded";
  fileName?: string;
  report?: QualityReport;
  store: string; setStore: (s: string) => void;
  category: string; setCategory: (s: string) => void;
  filtered: SalesRow[];
  stores: { id: string; loc: string }[];
  categories: string[];
  holidays: Set<string>;
  loadUploaded: (rows: SalesRow[], report: QualityReport, name: string) => void;
  resetSynthetic: () => void;
}

const DatasetContext = createContext<Ctx | null>(null);

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ rows: SalesRow[]; source: "synthetic" | "uploaded"; fileName?: string; report?: QualityReport }>(() => ({ rows: generateSyntheticData(), source: "synthetic" }));
  const [store, setStore] = useState("ALL");
  const [category, setCategory] = useState("ALL");

  const value = useMemo<Ctx>(() => {
    const sm = new Map<string, string>(); const cs = new Set<string>(); const hol = new Set<string>();
    state.rows.forEach((r) => { sm.set(r.store_id, r.store_location); cs.add(r.category); if (r.holiday_flag) hol.add(r.date); });
    const filtered = state.rows.filter((r) => (store === "ALL" || r.store_id === store) && (category === "ALL" || r.category === category));
    return {
      ...state, store, setStore, category, setCategory, filtered, holidays: hol,
      stores: [...sm].map(([id, loc]) => ({ id, loc })).sort((a, b) => a.id.localeCompare(b.id)),
      categories: [...cs].sort(),
      loadUploaded: (rows, report, fileName) => { setState({ rows, source: "uploaded", report, fileName }); setStore("ALL"); setCategory("ALL"); },
      resetSynthetic: () => { setState({ rows: generateSyntheticData(), source: "synthetic" }); setStore("ALL"); setCategory("ALL"); },
    };
  }, [state, store, category]);

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDataset() {
  const c = useContext(DatasetContext);
  if (!c) throw new Error("useDataset must be inside DatasetProvider");
  return c;
}

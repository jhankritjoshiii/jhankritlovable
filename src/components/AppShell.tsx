import { Link, Outlet } from "@tanstack/react-router";
import { BarChart3, Boxes, Database, LineChart, Store, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { useDataset } from "@/lib/dataset-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NAV = [
  { to: "/", label: "Overview", icon: BarChart3 },
  { to: "/products", label: "Products", icon: TrendingUp },
  { to: "/stores", label: "Stores & Demand", icon: Store },
  { to: "/forecast", label: "7-Day Forecast", icon: LineChart },
  { to: "/inventory", label: "Inventory Planner", icon: Boxes },
  { to: "/data", label: "Data & Quality", icon: Database },
] as const;

export function AppShell() {
  const { stores, categories, store, setStore, category, setCategory, source, fileName } = useDataset();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="px-6 py-6">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-sidebar-primary font-display text-lg font-bold text-sidebar-primary-foreground">S</span>
            <div>
              <div className="font-display text-lg font-bold leading-tight text-sidebar-accent-foreground">SalesSense</div>
              <div className="text-xs opacity-70">Retail analytics · academic</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} activeOptions={{ exact: true }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}>
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="space-y-3 border-t border-sidebar-border px-4 py-4 text-xs">
          <div>
            <div className="mb-1 opacity-70">Store</div>
            <Select value={store} onValueChange={setStore}>
              <SelectTrigger className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All stores</SelectItem>
                {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.id} · {s.loc}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-1 opacity-70">Category</div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-6 py-2 text-xs text-muted-foreground">
          <span>
            <span className="mr-2 rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
              {source === "synthetic" ? "Synthetic data" : `Uploaded: ${fileName}`}
            </span>
            Independent academic simulation — not an official DMart application; not affiliated with or endorsed by Avenue Supermarts Limited. All data, forecasts and recommendations are illustrative.
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-b bg-card px-4 py-2 md:hidden">
          {NAV.map(({ to, label }) => (
            <Link key={to} to={to} activeOptions={{ exact: true }} className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm" activeProps={{ className: "bg-primary text-primary-foreground" }}>{label}</Link>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8"><Outlet /></main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Panel({ title, note, children, className = "" }: { title: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border bg-card p-5 shadow-card ${className}`}>
      <h2 className="text-base font-semibold text-card-foreground">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl font-bold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)"];
export const axisProps = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false } as const;
export const tooltipStyle = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } };

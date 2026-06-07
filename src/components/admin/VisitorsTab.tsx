import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Globe, MapPin, Users, Crown, Clock } from "lucide-react";
import VisitorMap from "./VisitorMap";

interface VisitorLog {
  id: string;
  ip_address: string;
  country: string | null;
  city: string | null;
  region: string | null;
  access_level: string | null;
  visited_at: string;
}

type DateFilter = "all" | "today" | "week" | "month";

const FILTERS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "TODO" },
  { value: "today", label: "HOY" },
  { value: "week", label: "7 DÍAS" },
  { value: "month", label: "30 DÍAS" },
];

function getFilterDate(filter: DateFilter): Date | null {
  if (filter === "all") return null;
  const now = new Date();
  if (filter === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
  const d = new Date(now); d.setDate(d.getDate() - 30); return d;
}

const VisitorsTab = () => {
  const [allLogs, setAllLogs] = useState<VisitorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DateFilter>("all");

  useEffect(() => {
    fetchVisitors();
  }, []);

  const fetchVisitors = async () => {
    const { data } = await supabase
      .from("visitor_logs")
      .select("*")
      .order("visited_at", { ascending: false })
      .limit(500);
    setAllLogs((data as VisitorLog[]) || []);
    setLoading(false);
  };

  const logs = useMemo(() => {
    const since = getFilterDate(filter);
    if (!since) return allLogs;
    return allLogs.filter((v) => new Date(v.visited_at) >= since);
  }, [allLogs, filter]);

  const { topCountries, topCities, stats, countryCounts } = useMemo(() => {
    const countriesMap: Record<string, number> = {};
    const citiesMap: Record<string, number> = {};
    let premiumCount = 0;

    logs.forEach((v) => {
      if (v.country) countriesMap[v.country] = (countriesMap[v.country] || 0) + 1;
      if (v.city) {
        const label = v.region ? `${v.city}, ${v.region}` : v.city;
        citiesMap[label] = (citiesMap[label] || 0) + 1;
      }
      if (v.access_level === "premium" || v.access_level === "admin") premiumCount++;
    });

    return {
      countryCounts: countriesMap,
      topCountries: Object.entries(countriesMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topCities: Object.entries(citiesMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      stats: {
        total: logs.length,
        countries: Object.keys(countriesMap).length,
        cities: Object.keys(citiesMap).length,
        premium: premiumCount,
      },
    };
  }, [logs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { icon: Users, label: "Total visitas", value: stats.total, color: "text-primary" },
    { icon: Globe, label: "Países", value: stats.countries, color: "text-emerald-400" },
    { icon: MapPin, label: "Ciudades", value: stats.cities, color: "text-electric" },
    { icon: Crown, label: "Premium", value: stats.premium, color: "text-amber-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Clock className="w-4 h-4 text-muted-foreground" />
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg font-display text-xs tracking-wider transition-all ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <s.icon className={`w-5 h-5 mx-auto mb-2 ${s.color}`} />
            <p className="font-display text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Map */}
      <VisitorMap countryCounts={countryCounts} />

      {/* Top Countries & Cities */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-display text-sm font-bold text-emerald-400 tracking-wider">TOP PAÍSES</h3>
          </div>
          <div className="divide-y divide-border">
            {topCountries.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">Sin datos aún</p>
            ) : topCountries.map((c) => (
              <div key={c.name} className="px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-foreground">{c.name}</span>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">{c.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-display text-sm font-bold text-electric tracking-wider">TOP CIUDADES / ZONAS</h3>
          </div>
          <div className="divide-y divide-border">
            {topCities.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">Sin datos aún</p>
            ) : topCities.map((c) => (
              <div key={c.name} className="px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-foreground">{c.name}</span>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent visits */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-display text-sm font-bold text-primary tracking-wider">VISITAS RECIENTES</h3>
        </div>
        <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">No hay visitas registradas</p>
          ) : logs.slice(0, 50).map((v) => (
            <div key={v.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {v.country || "Desconocido"}
                  </span>
                  {v.city && (
                    <span className="text-xs text-muted-foreground truncate">
                      {v.city}{v.region ? `, ${v.region}` : ""}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">{v.ip_address}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  v.access_level === "admin" ? "bg-destructive/20 text-destructive" :
                  v.access_level === "premium" ? "bg-amber-500/20 text-amber-400" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {v.access_level || "visitor"}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(v.visited_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VisitorsTab;

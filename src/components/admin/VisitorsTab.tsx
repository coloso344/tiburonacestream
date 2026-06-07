interface VisitorMapProps {
  countryCounts?: Record<string, number>;
}

export default function VisitorMap({ countryCounts }: VisitorMapProps) {
  const totalVisits = Object.values(countryCounts || {}).reduce((a, b) => a + b, 0);
  
  if (!countryCounts || Object.keys(countryCounts).length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-muted-foreground mb-2">No hay datos de visitantes aún</p>
        <p className="text-sm text-muted-foreground">
          Las visitas se registrarán automáticamente cuando los usuarios accedan a la app
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="font-display text-sm font-bold text-primary tracking-wider mb-4">
        DISTRIBUCIÓN POR PAÍSES
      </h3>
      <div className="space-y-3">
        {Object.entries(countryCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([country, count]) => (
            <div key={country} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{country}</span>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(count / totalVisits) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                  {count}
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
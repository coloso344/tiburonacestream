import { memo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Map common country names (from ip-api) to ISO 3166-1 alpha-3
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  "Spain": "ESP", "España": "ESP",
  "United States": "USA", "Estados Unidos": "USA",
  "United Kingdom": "GBR", "Reino Unido": "GBR",
  "France": "FRA", "Francia": "FRA",
  "Germany": "DEU", "Alemania": "DEU",
  "Italy": "ITA", "Italia": "ITA",
  "Portugal": "PRT",
  "Mexico": "MEX", "México": "MEX",
  "Argentina": "ARG",
  "Colombia": "COL",
  "Chile": "CHL",
  "Peru": "PER", "Perú": "PER",
  "Brazil": "BRA", "Brasil": "BRA",
  "Venezuela": "VEN",
  "Ecuador": "ECU",
  "Bolivia": "BOL",
  "Uruguay": "URY",
  "Paraguay": "PRY",
  "Cuba": "CUB",
  "Dominican Republic": "DOM", "República Dominicana": "DOM",
  "Canada": "CAN", "Canadá": "CAN",
  "Netherlands": "NLD", "Países Bajos": "NLD",
  "Belgium": "BEL", "Bélgica": "BEL",
  "Switzerland": "CHE", "Suiza": "CHE",
  "Austria": "AUT",
  "Poland": "POL", "Polonia": "POL",
  "Romania": "ROU", "Rumania": "ROU",
  "Sweden": "SWE", "Suecia": "SWE",
  "Norway": "NOR", "Noruega": "NOR",
  "Denmark": "DNK", "Dinamarca": "DNK",
  "Finland": "FIN", "Finlandia": "FIN",
  "Ireland": "IRL", "Irlanda": "IRL",
  "Russia": "RUS", "Rusia": "RUS",
  "China": "CHN",
  "Japan": "JPN", "Japón": "JPN",
  "India": "IND",
  "Australia": "AUS",
  "South Korea": "KOR", "Corea del Sur": "KOR",
  "Turkey": "TUR", "Turquía": "TUR",
  "Morocco": "MAR", "Marruecos": "MAR",
  "Algeria": "DZA", "Argelia": "DZA",
  "Egypt": "EGY", "Egipto": "EGY",
  "South Africa": "ZAF", "Sudáfrica": "ZAF",
  "Nigeria": "NGA",
  "Costa Rica": "CRI",
  "Panama": "PAN", "Panamá": "PAN",
  "Guatemala": "GTM",
  "Honduras": "HND",
  "El Salvador": "SLV",
  "Nicaragua": "NIC",
  "Puerto Rico": "PRI",
  "Philippines": "PHL", "Filipinas": "PHL",
  "Thailand": "THA", "Tailandia": "THA",
  "Indonesia": "IDN",
  "Malaysia": "MYS", "Malasia": "MYS",
  "Vietnam": "VNM",
  "Israel": "ISR",
  "Saudi Arabia": "SAU", "Arabia Saudita": "SAU",
  "United Arab Emirates": "ARE", "Emiratos Árabes Unidos": "ARE",
  "Greece": "GRC", "Grecia": "GRC",
  "Czech Republic": "CZE", "Czechia": "CZE",
  "Hungary": "HUN", "Hungría": "HUN",
  "Ukraine": "UKR", "Ucrania": "UKR",
  "New Zealand": "NZL", "Nueva Zelanda": "NZL",
  "Singapore": "SGP", "Singapur": "SGP",
};

interface Props {
  countryCounts: Record<string, number>;
}

const VisitorMap = memo(({ countryCounts }: Props) => {
  const [tooltip, setTooltip] = useState("");

  // Build ISO -> count map
  const isoCounts: Record<string, number> = {};
  Object.entries(countryCounts).forEach(([name, count]) => {
    const iso = COUNTRY_NAME_TO_ISO[name];
    if (iso) isoCounts[iso] = (isoCounts[iso] || 0) + count;
  });

  const maxCount = Math.max(1, ...Object.values(isoCounts));

  const getColor = (iso: string) => {
    const count = isoCounts[iso];
    if (!count) return "hsl(var(--muted))";
    const intensity = Math.min(count / maxCount, 1);
    // From muted to primary
    return `hsl(var(--primary) / ${0.25 + intensity * 0.75})`;
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-primary tracking-wider">MAPA DE VISITANTES</h3>
        <VisitorMap countryCounts={{}} />
        {tooltip && <span className="text-xs text-muted-foreground">{tooltip}</span>}
      </div>
      <div className="p-2">
        <ComposableMap
          projectionConfig={{ rotate: [-10, 0, 0], scale: 147 }}
          style={{ width: "100%", height: "auto" }}
        >
          <ZoomableGroup>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const iso = geo.properties?.ISO_A3 || geo.id;
                  const count = isoCounts[iso] || 0;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getColor(iso)}
                      stroke="hsl(var(--border))"
                      strokeWidth={0.4}
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", fill: "hsl(var(--primary))", cursor: "pointer" },
                        pressed: { outline: "none" },
                      }}
                      onMouseEnter={() => {
                        const name = geo.properties?.name || iso;
                        setTooltip(count > 0 ? `${name}: ${count} visita${count > 1 ? "s" : ""}` : name);
                      }}
                      onMouseLeave={() => setTooltip("")}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>
    </div>
  );
});

VisitorMap.displayName = "VisitorMap";

export default VisitorMap;

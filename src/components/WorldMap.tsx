// src/components/WorldMap.tsx
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

export default function WorldMap() {
  return (
    <div className="w-full h-[400px] bg-gray-800 rounded-xl p-4 overflow-hidden border border-gray-700">
      <ComposableMap projectionConfig={{ scale: 120 }}>
        <Geographies geography="https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json">
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#1f2937" // Color base de los países
                stroke="#374151" // Bordes entre países
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { fill: "#2563eb", outline: "none" }, // Azul al pasar el mouse
                  pressed: { outline: "none" }
                }}
              />
            ))
          }
        </Geographies>
      </ComposableMap>
    </div>
  );
}
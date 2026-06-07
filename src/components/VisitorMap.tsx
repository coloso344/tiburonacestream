import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// FIX: Arreglo para que los iconos del mapa se vean bien en React/Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Visitante {
  ip: string;
  ciudad: string;
  pais: string;
  lat: number;
  lon: number;
  fecha: string;
}

const PROXY_URL = "https://forth-gst-optimize-agency.trycloudflare.com";

export default function VisitorMap() {
  const [visitantes, setVisitantes] = useState<Visitante[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVisitantes = async () => {
      try {
        const response = await fetch(`${PROXY_URL}/visitantes`);
        const data = await response.json();
        setVisitantes(data);
      } catch (error) {
        console.error('Error cargando mapa:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVisitantes();
    // Actualizar el mapa cada 30 segundos
    const interval = setInterval(fetchVisitantes, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-4"></div>
        <p className="text-gray-400">Cargando mapa de visitas...</p>
      </div>
    );
  }

  const countries = new Set(visitantes.map(v => v.pais)).size;
  const cities = new Set(visitantes.map(v => `${v.ciudad}, ${v.pais}`)).size;

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cyan-400 mb-2">??? Visitas en Tiempo Real</h2>
        <p className="text-gray-400 text-sm">Datos del servidor local</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-sm text-gray-400 mb-2">Total Visitas</h3>
          <p className="text-4xl font-bold text-cyan-400">{visitantes.length}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-sm text-gray-400 mb-2">Países</h3>
          <p className="text-4xl font-bold text-emerald-400">{countries}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-sm text-gray-400 mb-2">Ciudades</h3>
          <p className="text-4xl font-bold text-amber-400">{cities}</p>
        </div>
      </div>

      {/* Mapa */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden" style={{ height: '500px' }}>
        {visitantes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-400 text-lg mb-2">No hay visitas registradas aún</p>
              <p className="text-sm text-gray-500">Las visitas aparecerán aquí cuando alguien entre a la app</p>
            </div>
          </div>
        ) : (
          <MapContainer 
            center={[20, 0]} 
            zoom={2} 
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            {visitantes.map((v, index) => (
              <Marker key={index} position={[v.lat, v.lon]}>
                <Popup>
                  <div className="text-zinc-800">
                    <strong>{v.ciudad}, {v.pais}</strong><br />
                    <small>{new Date(v.fecha).toLocaleString()}</small>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Lista de últimas visitas */}
      {visitantes.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h3 className="font-bold text-white">Últimas visitas</h3>
          </div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-900 sticky top-0">
                <tr>
                  <th className="text-left p-3 text-sm text-gray-400">IP</th>
                  <th className="text-left p-3 text-sm text-gray-400">Ubicación</th>
                  <th className="text-left p-3 text-sm text-gray-400">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {[...visitantes].reverse().slice(0, 20).map((v, i) => (
                  <tr key={i} className="border-t border-gray-700 hover:bg-gray-900">
                    <td className="p-3 text-gray-300 font-mono text-sm">{v.ip}</td>
                    <td className="p-3 text-gray-300">
                      {v.ciudad}, {v.pais}
                    </td>
                    <td className="p-3 text-gray-400 text-sm">
                      {new Date(v.fecha).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
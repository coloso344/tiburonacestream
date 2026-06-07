import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import VisitorMap from '@/components/admin/VisitorMap'; // Ajusta la ruta si es necesario

type PlaylistType = 'm3u' | 'xtream' | 'mac';

interface Playlist {
  id: string;
  name: string;
  type: PlaylistType;
  url?: string;
  server_url?: string;
  username?: string;
  password?: string;
  mac_address?: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminPanel() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [stats, setStats] = useState({
    totalVisits: 0,
    countries: 0,
    cities: 0,
    premiumUsers: 0
  });

  const [formData, setFormData] = useState({
    name: '',
    type: 'xtream' as PlaylistType,
    url: '',
    server_url: '',
    username: '',
    password: '',
    mac_address: ''
  });

  // Fetch data from visitor_logs on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('visitor_logs')
          .select('*')
          .order('visited_at', { ascending: false })
          .limit(500);

        if (error) throw error;

        console.log("Datos recibidos de visitor_logs:", data);

        const totalVisits = data?.length || 0;
        const countries = new Set(data?.map(r => r.country).filter(Boolean)).size;
        const cities = new Set(data?.map(r => r.city).filter(Boolean)).size;

        setStats({
          totalVisits,
          countries,
          cities,
          premiumUsers: 0
        });

        // Opcional: también carga playlists si las necesitas
        // const { data: playlistData } = await supabase.from('playlists').select('*');
        // setPlaylists(playlistData || []);

      } catch (err) {
        console.error("Error cargando estadísticas:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('playlists').insert([formData]);
    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      alert('✅ Playlist guardada exitosamente');
      setShowForm(false);
      setFormData({
        name: '',
        type: 'xtream',
        url: '',
        server_url: '',
        username: '',
        password: '',
        mac_address: ''
      });
      // Recargar playlists si las usas
      // fetchPlaylists();
    }
  };

  const deletePlaylist = async (id: string) => {
    const { error } = await supabase.from('playlists').delete().eq('id', id);
    if (!error) {
      // fetchPlaylists();
    }
  };

  const getPlaylistUrl = (playlist: Playlist) => {
    if (playlist.type === 'm3u') return playlist.url;
    if (playlist.type === 'xtream') return playlist.server_url;
    if (playlist.type === 'mac') return playlist.mac_address;
    return 'N/A';
  };

  // Construir countryCounts para el mapa
  const countryCounts: Record<string, number> = {};
  // Nota: Aquí deberías pasar los datos reales desde stats o desde una consulta separada
  // Por ahora, lo dejamos vacío o puedes llenarlo manualmente para probar
  // Ejemplo: countryCounts["México"] = 1;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-cyan-400">?? GESTOR DE PLAYLISTS</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-green-500 hover:bg-green-600 px-6 py-3 rounded-lg font-bold transition"
          >
            {showForm ? '❌ Cancelar' : '➕ Agregar Playlist'}
          </button>
        </div>

        {/* Formulario */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-bold mb-4 text-cyan-400">Nueva Playlist</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre:</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-gray-700 rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo:</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value as PlaylistType})}
                  className="w-full bg-gray-700 rounded px-3 py-2"
                >
                  <option value="m3u">M3U</option>
                  <option value="xtream">Xtream</option>
                  <option value="mac">MAC Portal</option>
                </select>
              </div>
              {formData.type === 'm3u' && (
                <div>
                  <label className="block text-sm font-medium mb-1">URL M3U:</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({...formData, url: e.target.value})}
                    className="w-full bg-gray-700 rounded px-3 py-2"
                  />
                </div>
              )}
              {formData.type === 'xtream' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Server URL:</label>
                    <input
                      type="url"
                      value={formData.server_url}
                      onChange={(e) => setFormData({...formData, server_url: e.target.value})}
                      className="w-full bg-gray-700 rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Username:</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                      className="w-full bg-gray-700 rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Password:</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="w-full bg-gray-700 rounded px-3 py-2"
                    />
                  </div>
                </>
              )}
              {formData.type === 'mac' && (
                <div>
                  <label className="block text-sm font-medium mb-1">MAC Address:</label>
                  <input
                    type="text"
                    value={formData.mac_address}
                    onChange={(e) => setFormData({...formData, mac_address: e.target.value})}
                    className="w-full bg-gray-700 rounded px-3 py-2"
                    placeholder="00:1A:79:XX:XX:XX"
                    required
                  />
                </div>
              )}
            </div>
            <button
              type="submit"
              className="mt-4 w-full bg-cyan-500 hover:bg-cyan-600 py-3 rounded-lg font-bold transition"
            >
              💾 Guardar Playlist
            </button>
          </form>
        )}

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="text-2xl font-bold">{stats.totalVisits}</div>
            <div className="text-sm text-gray-400">Total Visitas</div>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="text-2xl font-bold">{stats.countries}</div>
            <div className="text-sm text-gray-400">Países</div>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="text-2xl font-bold">{stats.cities}</div>
            <div className="text-sm text-gray-400">Ciudades</div>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="text-2xl font-bold">{stats.premiumUsers}</div>
            <div className="text-sm text-gray-400">Premium</div>
          </div>
        </div>

        {/* Mapa de Visitantes */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-8">
          <h2 className="text-xl font-bold text-yellow-500 mb-4">MAPA DE VISITANTES</h2>
          <VisitorMap countryCounts={countryCounts} />
        </div>

        {/* Lista de Playlists */}
        {loading ? (
          <p className="text-center text-gray-400">Cargando...</p>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-cyan-400">Playlists Guardadas ({playlists.length})</h2>
            {playlists.map((playlist) => (
              <div key={playlist.id} className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{playlist.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${playlist.is_active ? 'bg-green-500' : 'bg-gray-600'}`}>
                    {playlist.type.toUpperCase()}
                  </span>
                  {playlist.is_active && (
                    <span className="ml-2 text-xs text-green-500">ACTIVA</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <a
                    href={getPlaylistUrl(playlist)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-sm"
                  >
                    Ver
                  </a>
                  <button
                    onClick={() => deletePlaylist(playlist.id)}
                    className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-sm"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
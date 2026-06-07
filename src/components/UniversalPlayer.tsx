import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import mpegts from 'mpegts.js';

interface Playlist {
  id: string;
  name: string;
  type: 'm3u' | 'xtream' | 'mac';
  server_url?: string;
  username?: string;
  password?: string;
  url?: string;
  is_active: boolean;
}

interface Channel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
}

export default function UniversalPlayer() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentStream, setCurrentStream] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<mpegts.Player | null>(null);

  useEffect(() => {
    fetchActivePlaylists();
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (currentStream && videoRef.current) {
      playStream(currentStream);
    }
  }, [currentStream]);

  const playStream = (url: string) => {
    // Destruir player anterior si existe
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    if (mpegts.isSupported() && videoRef.current) {
      const player = mpegts.createPlayer({
        type: 'mpegts',
        isLive: true,
        url: url
      }, {
        enableWorker: true,
        enableStashBuffer: true,
        stashInitialSize: 128 * 1024,
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 1.5
      });

      player.attachMediaElement(videoRef.current);
      player.load();
      player.play();
      
      playerRef.current = player;
    }
  };

  const fetchActivePlaylists = async () => {
    const { data } = await supabase
      .from('playlists')
      .select('*')
      .eq('is_active', true);
    
    if (data) setPlaylists(data);
  };

  const loadPlaylist = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setLoading(true);
    setChannels([]);

    try {
      if (playlist.type === 'm3u') {
        await loadM3U(playlist);
      } else if (playlist.type === 'xtream') {
        await loadXtream(playlist);
      } else if (playlist.type === 'mac') {
        await loadMAC(playlist);
      }
    } catch (error) {
      console.error('Error loading playlist:', error);
      alert('Error al cargar la playlist');
    } finally {
      setLoading(false);
    }
  };

  const loadM3U = async (playlist: Playlist) => {
    const { data, error } = await supabase.functions.invoke('fetch-m3u', {
      body: { url: playlist.url }
    });

    if (error) throw error;

    const channels = parseM3U(data.content);
    setChannels(channels);
  };

  const loadXtream = async (playlist: Playlist) => {
    const { data, error } = await supabase.functions.invoke('xtream-proxy', {
      body: {
        server_url: playlist.server_url,
        username: playlist.username,
        password: playlist.password,
        action: 'get_live_streams'
      }
    });

    if (error) throw error;

    const channels = data.map((stream: any) => ({
      name: stream.name,
      url: `http://localhost:3000/stream?server_url=${encodeURIComponent(playlist.server_url)}&username=${playlist.username}&password=${playlist.password}&stream_id=${stream.stream_id}`,
      logo: stream.stream_icon,
      group: stream.category_name
    }));

    setChannels(channels);
  };

  const loadMAC = async (playlist: Playlist) => {
    const { data, error } = await supabase.functions.invoke('stalker-proxy', {
      body: {
        mac: playlist.mac_address,
        action: 'get_all_channels'
      }
    });

    if (error) throw error;

    setChannels(data);
  };

  const parseM3U = (content: string): Channel[] => {
    const lines = content.split('\n');
    const channels: Channel[] = [];
    let currentChannel: Partial<Channel> = {};

    for (const line of lines) {
      if (line.startsWith('#EXTINF:')) {
        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        const groupMatch = line.match(/group-title="([^"]+)"/);
        const nameMatch = line.match(/,(.+)$/);

        currentChannel = {
          logo: logoMatch ? logoMatch[1] : undefined,
          group: groupMatch ? groupMatch[1] : undefined,
          name: nameMatch ? nameMatch[1].trim() : 'Sin nombre'
        };
      } else if (line && !line.startsWith('#')) {
        currentChannel.url = line.trim();
        if (currentChannel.name) {
          channels.push(currentChannel as Channel);
        }
        currentChannel = {};
      }
    }

    return channels;
  };

  const playChannel = (channel: Channel) => {
    setCurrentStream(channel.url);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* HEADER */}
      <div className="bg-gray-800 p-4">
        <h1 className="text-2xl font-bold text-cyan-400">?? REPRODUCTOR UNIVERSAL</h1>
      </div>

      <div className="flex">
        {/* SIDEBAR - PLAYLISTS */}
        <div className="w-64 bg-gray-800 p-4 min-h-screen">
          <h2 className="font-bold mb-4 text-cyan-400">Mis Playlists</h2>
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => loadPlaylist(playlist)}
              className={`w-full text-left p-3 mb-2 rounded transition ${
                selectedPlaylist?.id === playlist.id
                  ? 'bg-cyan-600'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <div className="font-bold">{playlist.name}</div>
              <div className="text-xs text-gray-400">{playlist.type.toUpperCase()}</div>
            </button>
          ))}
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 p-6">
          {loading ? (
            <div className="text-center text-cyan-400 text-xl">Cargando canales...</div>
          ) : channels.length > 0 ? (
            <div>
              <h2 className="text-xl font-bold mb-4">
                {selectedPlaylist?.name} ({channels.length} canales)
              </h2>
              
              {currentStream && (
                <div className="mb-6">
                  <video
                    ref={videoRef}
                    controls
                    autoPlay
                    className="w-full max-h-[600px] bg-black rounded"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {channels.map((channel, index) => (
                  <button
                    key={index}
                    onClick={() => playChannel(channel)}
                    className="bg-gray-800 p-4 rounded hover:bg-gray-700 transition text-left"
                  >
                    {channel.logo && (
                      <img src={channel.logo} alt="" className="w-12 h-12 mb-2 object-contain" />
                    )}
                    <div className="font-bold text-sm">{channel.name}</div>
                    {channel.group && (
                      <div className="text-xs text-gray-400">{channel.group}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : selectedPlaylist ? (
            <div className="text-center text-gray-400">
              No se encontraron canales
            </div>
          ) : (
            <div className="text-center text-gray-400 mt-20">
              Selecciona una playlist para comenzar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
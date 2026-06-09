import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [isBuffering, setIsBuffering] = useState(false);
  const [streamError, setStreamError] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<mpegts.Player | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 3;

  useEffect(() => {
    fetchActivePlaylists();
    return () => {
      cleanupPlayer();
    };
  }, []);

  useEffect(() => {
    if (currentStream && videoRef.current) {
      playStream(currentStream);
    }
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [currentStream]);

  const cleanupPlayer = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.unload();
        playerRef.current.detachMediaElement();
        playerRef.current.destroy();
      } catch (e) {
        console.error('Error limpiando player:', e);
      }
      playerRef.current = null;
    }
  }, []);

  const playStream = useCallback((url: string) => {
    cleanupPlayer();
    setIsBuffering(true);
    setStreamError('');
    setRetryCount(0);

    if (!mpegts.isSupported() || !videoRef.current) {
      setStreamError('Tu navegador no soporta este formato');
      setIsBuffering(false);
      return;
    }

    try {
      const player = mpegts.createPlayer({
        type: 'mpegts',
        isLive: true,
        url: url,
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      }, {
        // OPTIMIZACIÓN: Buffer más grande para evitar cortes
        enableWorker: true,
        enableStashBuffer: true,
        stashInitialSize: 512 * 1024, // 512KB en vez de 128KB
        
        // OPTIMIZACIÓN: Control de latencia en vivo
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 3.0, // Aumentado de 1.5 a 3.0
        
        // OPTIMIZACIÓN: Auto-cleanup para evitar memoria
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 30,
        autoCleanupMinBackwardDuration: 15,
        
        // OPTIMIZACIÓN: Retry automático
        autoPlay: true,
        enableWorker: true,
        
        // OPTIMIZACIÓN: Manejo de errores
        retryDelay: 3000,
        maxRetryDelay: 10000,
        
        // OPTIMIZACIÓN: Estabilidad
        fixAudioTimestampGap: true,
        accurateSeek: false
      });

      // EVENTOS DEL PLAYER
      player.on(mpegts.Events.ERROR, (errorType, errorDetail, errorInfo) => {
        console.error('❌ Error del player:', errorType, errorDetail, errorInfo);
        setStreamError(`Error: ${errorDetail}`);
        setIsBuffering(false);
        
        // Reconexión automática
        if (retryCount < maxRetries) {
          console.log(`🔄 Reintentando (${retryCount + 1}/${maxRetries})...`);
          retryTimeoutRef.current = setTimeout(() => {
            setRetryCount(prev => prev + 1);
            playStream(url);
          }, 3000);
        } else {
          setStreamError('No se pudo conectar al stream. Intenta con otro canal.');
        }
      });

      player.on(mpegts.Events.LOADING_SEGMENTS, () => {
        setIsBuffering(true);
      });

      player.on(mpegts.Events.BUFFER_EMPTY, () => {
        setIsBuffering(true);
      });

      player.on(mpegts.Events.BUFFERING_END, () => {
        setIsBuffering(false);
      });

      player.on(mpegts.Events.MEDIA_INFO, () => {
        console.log('✅ Media info recibida');
        setIsBuffering(false);
      });

      player.on(mpegts.Events.STATISTICS_INFO, (stats) => {
        // Log cada 10MB
        if (stats && stats.receivedBytes && stats.receivedBytes % 10000000 < 1000000) {
          console.log(`📊 Stream: ${Math.round(stats.receivedBytes/1024/1024)}MB`);
        }
      });

      player.on(mpegts.Events.LIVE_BUFFERING_END, () => {
        setIsBuffering(false);
      });

      player.attachMediaElement(videoRef.current);
      player.load();
      
      // Auto-play
      player.play().catch(err => {
        console.error('Error en autoplay:', err);
        setIsBuffering(false);
      });
      
      playerRef.current = player;
      
    } catch (error) {
      console.error('Error creando player:', error);
      setStreamError('Error al iniciar el reproductor');
      setIsBuffering(false);
    }
  }, [cleanupPlayer, retryCount]);

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
    setCurrentStream('');

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
      url: `http://tiburontv.mooo.com:3000/stream?server_url=${encodeURIComponent(playlist.server_url)}&username=${playlist.username}&password=${playlist.password}&stream_id=${stream.stream_id}`,
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

  const retryStream = () => {
    if (currentStream) {
      setRetryCount(0);
      playStream(currentStream);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* HEADER */}
      <div className="bg-gray-800 p-4">
        <h1 className="text-2xl font-bold text-cyan-400">🦈 REPRODUCTOR UNIVERSAL</h1>
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
                <div className="mb-6 relative">
                  <video
                    ref={videoRef}
                    controls
                    autoPlay
                    className="w-full max-h-[600px] bg-black rounded"
                  />
                  
                  {/* INDICADOR DE BUFFERING */}
                  {isBuffering && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-400 mx-auto mb-4"></div>
                        <div className="text-cyan-400 font-bold">Cargando stream...</div>
                        {retryCount > 0 && (
                          <div className="text-yellow-400 text-sm mt-2">
                            Reintentando ({retryCount}/{maxRetries})...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* ERROR */}
                  {streamError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded">
                      <div className="text-center p-6 bg-red-900 rounded-lg">
                        <div className="text-red-400 text-xl font-bold mb-2">❌ Error</div>
                        <div className="text-white mb-4">{streamError}</div>
                        <button
                          onClick={retryStream}
                          className="bg-cyan-600 hover:bg-cyan-700 px-6 py-2 rounded font-bold"
                        >
                          🔄 Reintentar
                        </button>
                      </div>
                    </div>
                  )}
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

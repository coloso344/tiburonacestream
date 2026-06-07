import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Hls from 'hls.js';

interface Playlist {
  id: string;
  name: string;
  type: 'm3u' | 'xtream' | 'mac';
  server_url?: string;
  username?: string;
  password?: string;
  url?: string;
  mac_address?: string;
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
  const [bufferStatus, setBufferStatus] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    fetchActivePlaylists();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (!currentStream || !videoRef.current) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        // BUFFER MEGA GRANDE para streams en vivo
        maxBufferLength: 120,
        maxMaxBufferLength: 180,
        maxBufferSize: 150 * 1000 * 1000,
        
        // Configuración para LIVE streaming
        liveSyncDuration: 30,
        liveMaxLatencyDuration: 60,
        liveDurationInfinity: true,
        
        // Tolerancia extrema
        maxBufferHole: 2.0,
        maxFragLookUpTolerance: 0.5,
        highBufferWatchdogPeriod: 5,
        nudgeMaxRetry: 20,
        
        // Rendimiento
        enableWorker: true,
        enableSoftwareAES: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        
        // Calidad - empezar bajo y subir gradualmente
        startLevel: -1,
        capLevelToPlayerSize: true,
        testBandwidth: true,
        abrEwmaDefaultEstimate: 500000,
        abrBandWidthFactor: 0.95,
        abrBandWidthUpFactor: 0.7,
        
        // Timeouts largos
        manifestLoadingTimeOut: 30000,
        manifestLoadingMaxRetry: 10,
        manifestLoadingRetryDelay: 2000,
        levelLoadingTimeOut: 30000,
        levelLoadingMaxRetry: 10,
        fragLoadingTimeOut: 60000,
        fragLoadingMaxRetry: 10,
        fragLoadingRetryDelay: 2000,
      });

      hls.loadSource(currentStream);
      hls.attachMedia(videoRef.current);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('? Manifest parsed, levels:', hls.levels.length);
        videoRef.current?.play().catch(err => {
          console.error('Error al reproducir:', err);
        });
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        console.log(' Calidad cambiada a nivel:', data.level);
      });

      hls.on(Hls.Events.FRAG_BUFFERED, (event, data) => {
        if (videoRef.current) {
          const buffered = videoRef.current.buffered;
          if (buffered.length > 0) {
            const bufferedEnd = buffered.end(buffered.length - 1);
            const currentTime = videoRef.current.currentTime;
            const bufferAhead = bufferedEnd - currentTime;
            setBufferStatus(bufferAhead);
            console.log(` Buffer: ${bufferAhead.toFixed(1)}s`);
          }
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('? Error HLS:', data.type, data.details);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('?? Error de red, reconectando...');
              setTimeout(() => hls.startLoad(), 3000);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('?? Error de media, recuperando...');
              hls.recoverMediaError();
              break;
            default:
              console.log('?? Error fatal, reiniciando...');
              hls.destroy();
              setTimeout(() => {
                setCurrentStream('');
                setTimeout(() => setCurrentStream(currentStream), 100);
              }, 2000);
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = currentStream;
      videoRef.current.addEventListener('loadedmetadata', () => {
        videoRef.current?.play().catch(err => {
          console.error('Error al reproducir:', err);
        });
      });
    }
  }, [currentStream]);

  // Monitorear estado de reproducción
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => console.log('? Buffering...');
    const handlePlaying = () => console.log('?? Playing');

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, []);

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
      url: `https://newton-unto-fork-dolls.trycloudflare.com/stream-hls?server_url=${encodeURIComponent(playlist.server_url)}&username=${playlist.username}&password=${playlist.password}&stream_id=${stream.stream_id}`,
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
    setBufferStatus(0);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 p-4">
        <h1 className="text-2xl font-bold text-cyan-400">?? REPRODUCTOR UNIVERSAL</h1>
      </div>

      <div className="flex">
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
                  {/* Indicador de buffer */}
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm text-gray-400">Buffer:</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          bufferStatus < 10 ? 'bg-red-500' :
                          bufferStatus < 30 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min((bufferStatus / 120) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-400 w-16">
                      {bufferStatus.toFixed(1)}s
                    </span>
                  </div>
                  
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
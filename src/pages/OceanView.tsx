import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Waves, Play, LogOut, Radio, X, ChevronLeft, ChevronRight, Loader2, Copy, ExternalLink, Volume2, VolumeX, Tv, ListVideo, Maximize } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Hls from "hls.js";
import mpegts from "mpegts.js";

interface Stream {
  id: string;
  name: string;
  acestream_id: string;
  category: string;
}

interface XtreamServer {
  id: string;
  name: string;
  url?: string;
  server_url?: string;
  username: string;
  password: string;
}

interface M3uPlaylist {
  id: string;
  name: string;
  url: string | null;
  content: string | null;
}

interface M3uChannel {
  name: string;
  url: string;
  group: string;
  logo: string;
}

interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

interface XtreamChannel {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string;
  category_id: string;
}

const categoryColors: Record<string, string> = {
  Deportes: "bg-electric/20 text-electric",
  Cine: "bg-primary/20 text-primary",
  Series: "bg-emerald-500/20 text-emerald-400",
  Noticias: "bg-amber-500/20 text-amber-400",
  Música: "bg-fuchsia-500/20 text-fuchsia-400",
  General: "bg-muted text-muted-foreground",
};

const CHANNELS_PER_PAGE = 24;

const OceanView = () => {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [xtreamServers, setXtreamServers] = useState<XtreamServer[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // M3U state
  const [m3uPlaylists, setM3uPlaylists] = useState<M3uPlaylist[]>([]);
  const [selectedM3u, setSelectedM3u] = useState<M3uPlaylist | null>(null);
  const [m3uChannels, setM3uChannels] = useState<M3uChannel[]>([]);
  const [m3uGroups, setM3uGroups] = useState<string[]>([]);
  const [selectedM3uGroup, setSelectedM3uGroup] = useState<string>("*");
  const [m3uSearch, setM3uSearch] = useState("");
  const [m3uPage, setM3uPage] = useState(1);
  const [loadingM3u, setLoadingM3u] = useState(false);

  // Xtream state
  const [selectedXtream, setSelectedXtream] = useState<XtreamServer | null>(null);
  const [xtreamCategories, setXtreamCategories] = useState<XtreamCategory[]>([]);
  const [xtreamChannels, setXtreamChannels] = useState<XtreamChannel[]>([]);
  const [selectedXtreamCat, setSelectedXtreamCat] = useState<string>("*");
  const [loadingXtream, setLoadingXtream] = useState(false);
  const [xtreamSearch, setXtreamSearch] = useState("");
  const [xtreamPage, setXtreamPage] = useState(1);

  // Player state
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [playingName, setPlayingName] = useState<string>("");
  const [rawStreamUrl, setRawStreamUrl] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const access = sessionStorage.getItem("access");
    if (access !== "visitor" && access !== "premium") {
      navigate("/");
      return;
    }
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [streamsRes, xtreamRes, m3uRes] = await Promise.all([
      supabase.from("streams").select("*").order("created_at", { ascending: false }),
      supabase.from("xtream_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("m3u_playlists").select("*").order("created_at", { ascending: false }),
    ]);

    setStreams((streamsRes.data as Stream[]) || []);
    setXtreamServers((xtreamRes.data as XtreamServer[]) || []);
    setM3uPlaylists((m3uRes.data as M3uPlaylist[]) || []);
    setLoading(false);
  };

  // === XTREAM CODES ===
  const xtreamCall = async (action: string, server: XtreamServer, extra?: Record<string, string>) => {
    try {
      const rawUrl = server.url || server.server_url;
      if (!rawUrl) throw new Error("Server URL is missing");
      
      const base = String(rawUrl).trim();
      const normalizedUrl = /^https?:\/\//i.test(base) ? base : `http://${base}`;

      console.log(`📡 Xtream API Call: ${action} -> ${normalizedUrl}`);

      const { data, error } = await supabase.functions.invoke("xtream-proxy", {
        body: {
          action: action,
          server_url: normalizedUrl,
          username: server.username,
          password: server.password,
          ...extra,
        },
      });

      if (error) throw new Error(error.message);

      console.log("📥 Response from xtream-proxy:", data);
      return { data: data?.data || data, error: data?.error || null };
    } catch (error: any) {
      console.error(`❌ Xtream API Call failed (${action}):`, error);
      return { data: null, error: error.message };
    }
  };

  const connectToXtream = async (server: XtreamServer) => {
    setSelectedXtream(server);
    setLoadingXtream(true);
    setXtreamCategories([]);
    setXtreamChannels([]);
    setSelectedXtreamCat("*");
    setXtreamSearch("");
    setXtreamPage(1);

    try {
      const authData = await xtreamCall("auth", server);
      if (String(authData?.user_info?.auth) === "0") {
        throw new Error("Autenticación fallida");
      }

      const cats = await xtreamCall("get_live_categories", server);
      const categories = Array.isArray(cats.data) ? cats.data : [];
      setXtreamCategories(categories);

      if (categories.length > 0) {
        await loadXtreamCategory("*", server);
      }
    } catch (err: any) {
      toast.error(err.message || "Error al conectar");
    } finally {
      setLoadingXtream(false);
    }
  };

  const loadXtreamCategory = async (catId: string, server: XtreamServer) => {
    setSelectedXtreamCat(catId);
    setXtreamPage(1);

    try {
      const params = catId === "*" ? {} : { category_id: catId };
      const response = await xtreamCall("get_live_streams", server, params);
      
      const channelsData = response.data || [];
      if (Array.isArray(channelsData)) {
        setXtreamChannels(channelsData);
      }
    } catch (err: any) {
      console.error("Error loading category:", err);
    }
  };

  const filteredXtreamChannels = (() => {
    let filtered = xtreamChannels;
    if (selectedXtreamCat !== "*") {
      filtered = filtered.filter(c => String(c.category_id) === selectedXtreamCat);
    }
    if (xtreamSearch.trim()) {
      const q = xtreamSearch.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(q));
    }
    return filtered;
  })();

  const xtreamTotalPages = Math.ceil(filteredXtreamChannels.length / CHANNELS_PER_PAGE) || 1;
  const xtreamPageChannels = filteredXtreamChannels.slice((xtreamPage - 1) * CHANNELS_PER_PAGE, xtreamPage * CHANNELS_PER_PAGE);
  
  // === FUNCIÓN CORREGIDA - USA RENDER COMO PROXY ===
  const playXtreamChannel = (channel: XtreamChannel) => {
    if (!selectedXtream) return;

    const rawUrl = selectedXtream.url || selectedXtream.server_url;
    const base = String(rawUrl).trim();
    const normalizedUrl = /^https?:\/\//i.test(base) ? base : `http://${base}`;

    const PROXY_URL = "https://pacifier-uplifting-eskimo.ngrok-free.dev";

    const proxyStreamUrl = `${PROXY_URL}/stream?server_url=${encodeURIComponent(normalizedUrl)}&username=${encodeURIComponent(selectedXtream.username)}&password=${encodeURIComponent(selectedXtream.password)}&stream_id=${channel.stream_id}`;

    setRawStreamUrl(`${normalizedUrl}/live/${encodeURIComponent(selectedXtream.username)}/${encodeURIComponent(selectedXtream.password)}/${channel.stream_id}.ts`);
    setPlayingName(channel.name);
    setPlayingUrl(proxyStreamUrl);

    requestAnimationFrame(() => {
      playerAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // === M3U PARSER ===
  const parseM3u = (text: string): M3uChannel[] => {
    const lines = text.split(/\r?\n/);
    const channels: M3uChannel[] = [];
    let current: Partial<M3uChannel> | null = null;
    
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      
      if (line.startsWith("#EXTINF")) {
        const nameMatch = line.match(/,(.*)$/);
        const groupMatch = line.match(/group-title="([^"]*)"/i);
        const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
        current = {
          name: nameMatch?.[1]?.trim() || "Sin nombre",
          group: groupMatch?.[1]?.trim() || "General",
          logo: logoMatch?.[1]?.trim() || "",
        };
      } else if (!line.startsWith("#") && current) {
        current.url = line;
        channels.push(current as M3uChannel);
        current = null;
      }
    }
    return channels;
  };

  const loadM3uPlaylist = async (pl: M3uPlaylist) => {
    setSelectedM3u(pl);
    setLoadingM3u(true);
    setM3uChannels([]);
    setM3uGroups([]);
    setSelectedM3uGroup("*");
    setM3uSearch("");
    setM3uPage(1);
    
    try {
      let content = pl.content || "";
      if (!content && pl.url) {
        const { data, error } = await supabase.functions.invoke("fetch-m3u", { body: { url: pl.url } });
        if (error) throw new Error(error.message);
        content = data?.content || "";
      }
      
      const parsed = parseM3u(content);
      setM3uChannels(parsed.slice(0, 50));
      const groups = Array.from(new Set(parsed.map(c => c.group)));
      setM3uGroups(groups);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar M3U");
    } finally {
      setLoadingM3u(false);
    }
  };

  const filteredM3uChannels = (() => {
    let filtered = m3uChannels;
    if (selectedM3uGroup !== "*") filtered = filtered.filter(c => c.group === selectedM3uGroup);
    if (m3uSearch.trim()) {
      const q = m3uSearch.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(q));
    }
    return filtered;
  })();

  const m3uTotalPages = Math.ceil(filteredM3uChannels.length / CHANNELS_PER_PAGE) || 1;
  const m3uPageChannels = filteredM3uChannels.slice((m3uPage - 1) * CHANNELS_PER_PAGE, m3uPage * CHANNELS_PER_PAGE);

  // === FUNCIÓN ORIGINAL - REPRODUCE EN EL NAVEGADOR ===
  const playM3uChannel = (channel: M3uChannel) => {
    if (channel.url.startsWith("acestream://") || channel.url.startsWith("ace://")) {
      window.location.href = channel.url;
      return;
    }
    setRawStreamUrl(channel.url);
    setPlayingName(channel.name);
    setPlayingUrl(channel.url);
    requestAnimationFrame(() => {
      playerAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // === PLAYER CORREGIDO - DETECTA STREAMS DE RENDER ===
  useEffect(() => {
  if (!playingUrl || !videoRef.current) return;
  const video = videoRef.current;
  setPlayerError(null);
  let destroyed = false;
  video.muted = true;
  setIsMuted(true);

  if (hlsRef.current) { 
    if ('destroy' in hlsRef.current) {
      hlsRef.current.destroy();
    }
    hlsRef.current = null; 
  }

  const isHlsStream = playingUrl.toLowerCase().includes(".m3u8") || playingUrl.toLowerCase().includes("m3u8");
  const isTsStream = playingUrl.toLowerCase().includes(".ts") || playingUrl.includes("/stream?");

  // === BUFFER CONFIGURACIÓN - 2 MINUTOS ===
  const BUFFER_SECONDS = 120; // 2 minutos de buffer
  
  // Para streams HLS (.m3u8)
  if (isHlsStream && Hls.isSupported()) {
    const hls = new Hls({
  enableWorker: true,
  lowLatencyMode: false,
  backBufferLength: BUFFER_SECONDS,
  maxBufferLength: BUFFER_SECONDS,
  maxMaxBufferLength: BUFFER_SECONDS,
  maxBufferSize: 100 * 1024 * 1024,
  maxBufferHole: 0.5,
  highBufferWatchdogPeriod: 2,
  nudgeOffset: 0.1,
  nudgeMaxRetry: 5,
  liveSyncDurationCount: BUFFER_SECONDS / 10,
  liveDurationInfinity: true,
  // ← AGREGA ESTO PARA NGROK
  xhrSetup: function(xhr, url) {
    xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');
  }
});
    
    hls.loadSource(playingUrl);
    hls.attachMedia(video);
    
    hls.on(Hls.Events.MANIFEST_PARSED, () => { 
      if (!destroyed) {
        setTimeout(() => {
          video.play().catch(() => {});
        }, 5000);
      }
    });
    
    hls.on(Hls.Events.BUFFER_CREATED, (event, data) => {
      console.log('📦 Buffer creado:', data);
    });
    
    hls.on(Hls.Events.ERROR, (_e, d) => {
      if (destroyed || !d.fatal) return;
      hls.destroy();
      hlsRef.current = null;
      setPlayerError("Error HLS. Copia la URL y ábrela en VLC.");
    });
    
    hlsRef.current = hls;
  }
  else if (isTsStream && typeof mpegts !== 'undefined') {
    try {
      const flvPlayer = mpegts.createPlayer({
        type: 'mpegts',
        url: playingUrl,
        isLive: true,
        cors: true,
        enableWorker: true,
        lazyLoadMaxBuffer: 100 * 1024 * 1024,
        lazyLoadRecoverDuration: 60000,
        autoCleanupSource: false,
        stashInitialSize: 128 * 1024,
        stashUsedSize: 256 * 1024,
      });
      
      flvPlayer.attachMediaElement(video);
      flvPlayer.load();
      
      setTimeout(() => {
        flvPlayer.play().catch(() => {});
      }, 5000);
      
      if (!destroyed) {
        hlsRef.current = flvPlayer as any;
      }
    } catch (err) {
      console.error('Error con mpegts.js:', err);
      video.src = playingUrl;
      video.play().catch(() => {});
    }
  }
  else {
    video.src = playingUrl;
    video.play().catch(() => {});
  }

  return () => {
    destroyed = true;
    if (hlsRef.current) { 
      if ('destroy' in hlsRef.current) {
        hlsRef.current.destroy();
      }
      hlsRef.current = null; 
    }
  };
}, [playingUrl]);

  const closePlayer = () => {
    setPlayingUrl(null);
    setRawStreamUrl(null);
    setPlayingName("");
    setPlayerError(null);
    if (hlsRef.current) { 
      if ('destroy' in hlsRef.current) {
        hlsRef.current.destroy();
      }
      hlsRef.current = null; 
    }
  };

  const copyStreamUrl = () => {
    if (rawStreamUrl) {
      navigator.clipboard.writeText(rawStreamUrl);
      toast.success("URL copiada al portapapeles");
    }
  };

  const logout = () => {
    sessionStorage.removeItem("access");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-electric animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Waves className="w-6 h-6 text-electric" />
            <h1 className="font-display text-xl font-bold text-electric">EL OCÉANO</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={logout} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
              <LogOut className="w-4 h-4" /> Salir
            </button>
          </div>
        </div>
      </header>

      {/* Player */}
      {playingUrl && (
        <div ref={playerAnchorRef} className="w-full bg-black sm:container sm:mx-auto">
         <div className="px-0 py-0 sm:px-4 sm:py-4 space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Play className="w-3 h-3 sm:w-4 sm:h-4 text-electric shrink-0" />
                <h2 className="font-display text-[10px] sm:text-xs font-bold tracking-wider text-electric truncate">
                  {playingName || "REPRODUCTOR"}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => { if (videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted); } }} className="p-1.5 sm:p-2 bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                  {isMuted ? <VolumeX className="w-4 h-4 text-destructive" /> : <Volume2 className="w-4 h-4 text-electric" />}
                </button>
                <button onClick={closePlayer} className="p-1.5 sm:p-2 bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <video 
              ref={videoRef} 
              controls 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-[60vw] sm:h-auto sm:aspect-video bg-black rounded-lg"
            />
            {playerError && <p className="text-destructive text-xs sm:text-sm">{playerError}</p>}
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <button onClick={copyStreamUrl} className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-card border border-border rounded-lg text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Copiar URL
              </button>
              {rawStreamUrl && (
                <a href={rawStreamUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-card border border-border rounded-lg text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Abrir
                </a>
              )}
              <button 
                onClick={() => {
                  const video = videoRef.current;
                  if (video) {
                    if (video.requestFullscreen) {
                      video.requestFullscreen();
                    } else if ((video as any).webkitRequestFullscreen) {
                      (video as any).webkitRequestFullscreen();
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-card border border-border rounded-lg text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Maximize className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Fullscreen
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="iptv" className="w-full">
          <TabsList className="w-full mb-6 bg-card border border-border">
            {xtreamServers.length > 0 && (
              <TabsTrigger value="iptv" className="flex-1 font-display text-xs tracking-wider data-[state=active]:text-emerald-400">
                <Tv className="w-4 h-4 mr-1" /> IPTV
              </TabsTrigger>
            )}
            {m3uPlaylists.length > 0 && (
              <TabsTrigger value="m3u" className="flex-1 font-display text-xs tracking-wider data-[state=active]:text-amber-400">
                <ListVideo className="w-4 h-4 mr-1" /> M3U
              </TabsTrigger>
            )}
            {streams.length > 0 && (
              <TabsTrigger value="acestream" className="flex-1 font-display text-xs tracking-wider data-[state=active]:text-primary">
                <Radio className="w-4 h-4 mr-1" /> ACE
              </TabsTrigger>
            )}
          </TabsList>

          {/* IPTV */}
          {xtreamServers.length > 0 && (
            <TabsContent value="iptv">
              <div className="flex gap-2 mb-6 flex-wrap">
                {xtreamServers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => connectToXtream(s)}
                    className={`px-4 py-2 rounded-lg font-display text-xs tracking-wider transition-all ${
                      selectedXtream?.id === s.id
                        ? "bg-emerald-500 text-secondary-foreground"
                        : "bg-card border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              {!selectedXtream ? (
                <div className="text-center py-20">
                  <Tv className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg">Selecciona un servidor IPTV</p>
                </div>
              ) : loadingXtream ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                  <p className="text-muted-foreground font-display text-sm tracking-wider">CONECTANDO...</p>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                  {xtreamCategories.length > 1 && (
                    <div className="hidden md:block w-56 shrink-0">
                      <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-24">
                        <div className="p-3 border-b border-border">
                          <h3 className="font-display text-xs font-bold text-emerald-400 tracking-wider">CATEGORÍAS</h3>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto">
                          <button
                            onClick={() => loadXtreamCategory("*", selectedXtream)}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                              selectedXtreamCat === "*" ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                            }`}
                          >
                            Todos ({xtreamChannels.length})
                          </button>
                          {xtreamCategories.map((c) => (
                            <button
                              key={c.category_id}
                              onClick={() => loadXtreamCategory(c.category_id, selectedXtream)}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors truncate ${
                                selectedXtreamCat === c.category_id ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                              }`}
                            >
                              {c.category_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {xtreamCategories.length > 1 && (
                    <div className="md:hidden w-full mb-4">
                      <select
                        value={selectedXtreamCat}
                        onChange={(e) => loadXtreamCategory(e.target.value, selectedXtream)}
                        className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground text-sm"
                      >
                        <option value="*">Todas las categorías ({xtreamChannels.length})</option>
                        {xtreamCategories.map((c) => (
                          <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="mb-4 relative">
                      <input
                        type="text"
                        placeholder="Buscar canal..."
                        value={xtreamSearch}
                        onChange={(e) => { setXtreamSearch(e.target.value); setXtreamPage(1); }}
                        className="w-full px-4 py-2.5 pr-10 bg-card border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-emerald-400/60 transition-colors"
                      />
                      {xtreamSearch && (
                        <button onClick={() => setXtreamSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {xtreamPageChannels.length === 0 ? (
                      <div className="text-center py-20">
                        <p className="text-muted-foreground">No hay canales</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {xtreamPageChannels.map((ch) => (
                            <div key={ch.stream_id} className="group bg-card border border-border rounded-xl p-5 hover:border-emerald-400/40 transition-all duration-300">
                              <h3 className="font-display text-sm font-semibold text-foreground tracking-wide truncate pr-2 mb-4">
                                {ch.name}
                              </h3>
                              <button
                                onClick={() => playXtreamChannel(ch)}
                                className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-secondary-foreground font-display font-bold tracking-wider rounded-lg hover:opacity-90 transition-opacity text-sm select-none"
                              >
                                <Play className="w-4 h-4" /> VER STREAM
                              </button>
                            </div>
                          ))}
                        </div>
                        {xtreamTotalPages > 1 && (
                          <div className="flex items-center justify-center gap-4 mt-8">
                            <button onClick={() => setXtreamPage(p => Math.max(1, p - 1))} disabled={xtreamPage <= 1} className="p-2 bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="font-display text-sm text-muted-foreground tracking-wider">{xtreamPage} / {xtreamTotalPages}</span>
                            <button onClick={() => setXtreamPage(p => Math.min(xtreamTotalPages, p + 1))} disabled={xtreamPage >= xtreamTotalPages} className="p-2 bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          {/* M3U */}
          {m3uPlaylists.length > 0 && (
            <TabsContent value="m3u">
              <div className="flex gap-2 mb-6 flex-wrap">
                {m3uPlaylists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => loadM3uPlaylist(pl)}
                    className={`px-4 py-2 rounded-lg font-display text-xs tracking-wider transition-all ${
                      selectedM3u?.id === pl.id
                        ? "bg-amber-500 text-secondary-foreground"
                        : "bg-card border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {pl.name}
                  </button>
                ))}
              </div>

              {!selectedM3u ? (
                <div className="text-center py-20">
                  <ListVideo className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg">Selecciona una lista M3U</p>
                </div>
              ) : loadingM3u ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                  <p className="text-muted-foreground font-display text-sm tracking-wider">CARGANDO...</p>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                  {m3uGroups.length > 1 && (
                    <div className="hidden md:block w-56 shrink-0">
                      <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-24">
                        <div className="p-3 border-b border-border">
                          <h3 className="font-display text-xs font-bold text-amber-400 tracking-wider">GRUPOS</h3>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto">
                          <button
                            onClick={() => setSelectedM3uGroup("*")}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                              selectedM3uGroup === "*" ? "bg-amber-500/20 text-amber-400" : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                            }`}
                          >
                            Todos ({m3uChannels.length})
                          </button>
                          {m3uGroups.map((g) => (
                            <button
                              key={g}
                              onClick={() => setSelectedM3uGroup(g)}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors truncate ${
                                selectedM3uGroup === g ? "bg-amber-500/20 text-amber-400" : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {m3uGroups.length > 1 && (
                    <div className="md:hidden w-full mb-4">
                      <select
                        value={selectedM3uGroup}
                        onChange={(e) => { setSelectedM3uGroup(e.target.value); setM3uPage(1); }}
                        className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground text-sm"
                      >
                        <option value="*">Todos los grupos ({m3uChannels.length})</option>
                        {m3uGroups.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="mb-4 relative">
                      <input
                        type="text"
                        placeholder="Buscar canal..."
                        value={m3uSearch}
                        onChange={(e) => { setM3uSearch(e.target.value); setM3uPage(1); }}
                        className="w-full px-4 py-2.5 pr-10 bg-card border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-amber-400/60 transition-colors"
                      />
                      {m3uSearch && (
                        <button onClick={() => setM3uSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {m3uPageChannels.length === 0 ? (
                      <div className="text-center py-20">
                        <p className="text-muted-foreground">No hay canales</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {m3uPageChannels.map((ch, idx) => (
                            <div key={idx} className="group bg-card border border-border rounded-xl p-5 hover:border-amber-400/40 transition-all duration-300">
                              <h3 className="font-display text-sm font-semibold text-foreground tracking-wide truncate pr-2 mb-4">
                                {ch.name}
                              </h3>
                              <button
                                onClick={() => playM3uChannel(ch)}
                                className="flex items-center justify-center gap-2 w-full py-3 bg-amber-500 hover:bg-amber-600 text-secondary-foreground font-display font-bold tracking-wider rounded-lg hover:opacity-90 transition-opacity text-sm select-none"
                              >
                                <Play className="w-4 h-4" /> VER STREAM
                              </button>
                            </div>
                          ))}
                        </div>
                        {m3uTotalPages > 1 && (
                          <div className="flex items-center justify-center gap-4 mt-8">
                            <button onClick={() => setM3uPage(p => Math.max(1, p - 1))} disabled={m3uPage <= 1} className="p-2 bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="font-display text-sm text-muted-foreground tracking-wider">{m3uPage} / {m3uTotalPages}</span>
                            <button onClick={() => setM3uPage(p => Math.min(m3uTotalPages, p + 1))} disabled={m3uPage >= m3uTotalPages} className="p-2 bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          {/* ACESTREAM */}
          {streams.length > 0 && (
            <TabsContent value="acestream">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {streams.map((stream) => (
                  <div key={stream.id} className="group bg-card border border-border rounded-xl p-5 hover:border-electric/40 transition-all duration-300">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-display text-sm font-semibold text-foreground tracking-wide truncate pr-2">{stream.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${categoryColors[stream.category] || categoryColors.General}`}>{stream.category}</span>
                    </div>
                    <div className="mb-4" />
                    <button
                      onClick={() => { window.location.href = `acestream://${stream.acestream_id}`; }}
                      className="flex items-center justify-center gap-2 w-full py-3 bg-electric hover:bg-electric/90 text-secondary-foreground font-display font-bold tracking-wider rounded-lg hover:opacity-90 transition-opacity text-sm select-none"
                    >
                      <Play className="w-4 h-4" /> VER STREAM
                    </button>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default OceanView;
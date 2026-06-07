import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Waves, Play, LogOut, Radio, X, ChevronLeft, ChevronRight, Loader2, Copy, ExternalLink, Volume2, VolumeX, Tv, ListVideo } from "lucide-react";
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

interface MacPortal {
  id: string;
  name: string;
  portal_url: string;
  mac_address: string;
}

interface XtreamServer {
  id: string;
  name: string;
  server_url: string;
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

interface XtreamServerInfo {
  port?: string | number | null;
  https_port?: string | number | null;
  server_protocol?: string | null;
  url?: string | null;
}

interface StalkerGenre {
  id: string;
  title: string;
  number: string;
}

interface StalkerChannel {
  id: string;
  name: string;
  number: string;
  cmd: string;
  tv_genre_id: string;
  logo: string;
}

const categoryColors: Record<string, string> = {
  Deportes: "bg-electric/20 text-electric",
  Cine: "bg-primary/20 text-primary",
  Series: "bg-emerald-500/20 text-emerald-400",
  Noticias: "bg-amber-500/20 text-amber-400",
  Música: "bg-fuchsia-500/20 text-fuchsia-400",
  General: "bg-muted text-muted-foreground",
};

const normalizeXtreamServerUrl = (serverUrl: string) => {
  const trimmed = serverUrl.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
};

const resolveXtreamServerUrl = (serverUrl: string, serverInfo?: XtreamServerInfo) => {
  try {
    const fallback = new URL(normalizeXtreamServerUrl(serverUrl));
    const protocolValue = String(serverInfo?.server_protocol || fallback.protocol.replace(":", "") || "http").toLowerCase();
    const protocol = protocolValue === "https" ? "https:" : "http:";
    const hostname = serverInfo?.url?.trim() || fallback.hostname;
    const port = protocol === "https:"
      ? serverInfo?.https_port || serverInfo?.port || fallback.port
      : serverInfo?.port || serverInfo?.https_port || fallback.port;

    const resolved = new URL(`${protocol}//${hostname}`);
    if (port) {
      resolved.port = String(port);
    }

    return resolved.toString().replace(/\/+$/, "");
  } catch {
    return normalizeXtreamServerUrl(serverUrl).replace(/\/+$/, "");
  }
};

const resolveXtreamStreamBase = (serverUrl: string, serverInfo?: XtreamServerInfo) => {
  try {
    const parsed = new URL(resolveXtreamServerUrl(serverUrl, serverInfo));
    parsed.search = "";
    parsed.hash = "";

    if (!parsed.port) {
      const fallbackPort = parsed.protocol === "https:"
        ? serverInfo?.https_port || serverInfo?.port
        : serverInfo?.port || serverInfo?.https_port;

      if (fallbackPort) {
        parsed.port = String(fallbackPort);
      }
    }

    return parsed.origin;
  } catch {
    return normalizeXtreamServerUrl(serverUrl).replace(/\/+$/, "");
  }
};

const CHANNELS_PER_PAGE = 24;

const OceanView = () => {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [macPortals, setMacPortals] = useState<MacPortal[]>([]);
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
  const [m3uError, setM3uError] = useState<string | null>(null);

  // Stalker state
  const [selectedPortal, setSelectedPortal] = useState<MacPortal | null>(null);
  const [stalkerToken, setStalkerToken] = useState<string | null>(null);
  const [genres, setGenres] = useState<StalkerGenre[]>([]);
  const [channels, setChannels] = useState<StalkerChannel[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>("*");
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [channelSearch, setChannelSearch] = useState("");

  // Xtream Codes state
  const [selectedXtream, setSelectedXtream] = useState<XtreamServer | null>(null);
  const [xtreamCategories, setXtreamCategories] = useState<XtreamCategory[]>([]);
  const [xtreamChannels, setXtreamChannels] = useState<XtreamChannel[]>([]);
  const [selectedXtreamCat, setSelectedXtreamCat] = useState<string>("*");
  const [loadingXtream, setLoadingXtream] = useState(false);
  const [xtreamError, setXtreamError] = useState<string | null>(null);
  const [xtreamSearch, setXtreamSearch] = useState("");
  const [xtreamPage, setXtreamPage] = useState(1);
  const [xtreamOutputFormat, setXtreamOutputFormat] = useState<"m3u8" | "ts">("ts");
  const [xtreamStreamBase, setXtreamStreamBase] = useState<string | null>(null);
  const [xtreamLoadedCategories, setXtreamLoadedCategories] = useState<string[]>([]);

  // Player state
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [playingName, setPlayingName] = useState<string>("");
  const [rawStreamUrl, setRawStreamUrl] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [proxyAttempt, setProxyAttempt] = useState<0 | 1 | 2>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
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
    const [streamsRes, portalsRes, xtreamRes, m3uRes] = await Promise.all([
      supabase.from("streams").select("*").order("created_at", { ascending: false }),
      supabase.from("mac_portals").select("*").order("created_at", { ascending: false }),
      supabase.from("xtream_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("m3u_playlists").select("*").order("created_at", { ascending: false }),
    ]);
    setStreams((streamsRes.data as Stream[]) || []);
    const portals = (portalsRes.data as MacPortal[]) || [];
    setMacPortals(portals);
    setXtreamServers((xtreamRes.data as XtreamServer[]) || []);
    setM3uPlaylists((m3uRes.data as M3uPlaylist[]) || []);
    setLoading(false);

    // Auto-select first portal
    if (portals.length > 0 && !selectedPortal) {
      connectToPortal(portals[0]);
    }
  };

  // === M3U ===
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
    setM3uError(null);
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
        if (data?.error) throw new Error(data.error);
        content = data?.content || "";
      }
      const parsed = parseM3u(content);
      setM3uChannels(parsed.slice(0, 50));

      const groups = Array.from(new Set(parsed.map(c => c.group)));
setM3uGroups(groups);
     }}
    
    } catch (err: any) {
      setM3uError(err.message || "Error al cargar la lista M3U");
    }
    setLoadingM3u(false);
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

  const playM3uChannel = (channel: M3uChannel) => {
    if (channel.url.startsWith("acestream://") || channel.url.startsWith("ace://")) {
      window.location.href = channel.url;
      return;
    }
    setRawStreamUrl(channel.url);
    setPlayingName(channel.name);
    setProxyAttempt(0);
    setPlayingUrl(channel.url);
    requestAnimationFrame(() => {
      playerAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // === STALKER / MAC ===
  const stalkerCall = async (
    action: string,
    portal: MacPortal,
    token?: string,
    extra?: Record<string, string>
  ) => {
    const { data, error } = await supabase.functions.invoke("stalker-proxy", {
      body: {
        action,
        portal_url: portal.portal_url,
        mac_address: portal.mac_address,
        token: token || stalkerToken,
        ...extra,
      },
    });
    if (error) throw new Error(error.message);
    return data;
  };

  const connectToPortal = async (portal: MacPortal) => {
    setSelectedPortal(portal);
    setLoadingPortal(true);
    setPortalError(null);
    setGenres([]);
    setChannels([]);
    setStalkerToken(null);
    setSelectedGenre("*");
    setCurrentPage(1);

    try {
      const hsData = await stalkerCall("handshake", portal);
      const token = hsData?.js?.token || hsData?.token;
      if (!token) {
        const errMsg = hsData?.js?.error || hsData?.error || hsData?.__error?.portal_error || hsData?.__error?.message || "No token in response";
        const status = hsData?.__debug?.status;
        setPortalError(`Handshake falló: ${errMsg}${status ? ` (status ${status})` : ""}`);
        setLoadingPortal(false);
        return;
      }

      setStalkerToken(token);
      localStorage.setItem("stalker_token", token);

      const profileData = await stalkerCall("get_profile", portal, token);
      if (profileData?.__error) {
        const errMsg = profileData?.js?.error || profileData?.error || profileData?.__error?.portal_error || profileData?.__error?.message || "Error en get_profile";
        setPortalError(`get_profile falló: ${errMsg}`);
        setLoadingPortal(false);
        return;
      }

      const genresData = await stalkerCall("get_genres", portal, token);
      const genreList = genresData?.js || [];
      setGenres(genreList);

      await loadChannels(portal, token, "*", 1);
      setLoadingPortal(false);
    } catch (err: any) {
      setPortalError(err.message || "Error al conectar con el portal");
      setLoadingPortal(false);
    }
  };

  const loadChannels = async (portal: MacPortal, token: string, genreId: string, page: number, search?: string) => {
    setLoadingChannels(true);
    try {
      const trimmedSearch = search?.trim();
      const isSearching = Boolean(trimmedSearch);
      const data = await stalkerCall(isSearching ? "search_channels" : "get_channels", portal, token, {
        category_id: genreId,
        page: String(page),
        ...(isSearching ? { search_query: trimmedSearch as string } : {}),
      });
      const js = data?.js;
      const channelList = js?.data || [];
      setChannels(channelList);
      setTotalPages(Math.ceil((js?.total_items || channelList.length) / (js?.max_page_items || 14)) || 1);
      setCurrentPage(page);
    } catch (err: any) {
      console.error("Error loading channels:", err);
    }
    setLoadingChannels(false);
  };

  useEffect(() => {
    if (!selectedPortal || !stalkerToken) return;
    const timer = setTimeout(() => {
      loadChannels(selectedPortal, stalkerToken, selectedGenre, 1, channelSearch || undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [channelSearch]);

  const selectGenre = (genreId: string) => {
    setSelectedGenre(genreId);
    setChannelSearch("");
    if (selectedPortal && stalkerToken) {
      loadChannels(selectedPortal, stalkerToken, genreId, 1);
    }
  };

  // === XTREAM CODES ===
  const xtreamCall = async (action: string, server: XtreamServer, extra?: Record<string, string>) => {
    const { data, error } = await supabase.functions.invoke("xtream-proxy", {
      body: {
        action,
        server_url: normalizeXtreamServerUrl(server.server_url),
        username: server.username,
        password: server.password,
        ...extra,
      },
    });
    if (error) throw new Error(error.message);
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      throw new Error(data.error);
    }
    return data;
  };

  const connectToXtream = async (server: XtreamServer) => {
    setSelectedXtream(server);
    setLoadingXtream(true);
    setXtreamError(null);
    setXtreamCategories([]);
    setXtreamChannels([]);
    setSelectedXtreamCat("*");
    setXtreamSearch("");
    setXtreamPage(1);
    setXtreamOutputFormat("ts");
    setXtreamStreamBase(null);
    setXtreamLoadedCategories([]);

    try {
      const authData = await xtreamCall("auth", server);
      if (String(authData?.user_info?.auth) === "0") {
        setXtreamError("Autenticación fallida: usuario o contraseña incorrectos");
        setLoadingXtream(false);
        return;
      }

      const allowedFormats = Array.isArray(authData?.user_info?.allowed_output_formats)
        ? authData.user_info.allowed_output_formats.map((format: string) => String(format).toLowerCase())
        : [];
      const effectiveServerUrl = resolveXtreamServerUrl(server.server_url, authData?.server_info);
      const effectiveServer = { ...server, server_url: effectiveServerUrl };

      setSelectedXtream(effectiveServer);
      setXtreamOutputFormat(allowedFormats.includes("m3u8") ? "m3u8" : "ts");
      setXtreamStreamBase(resolveXtreamStreamBase(effectiveServerUrl, authData?.server_info));

      const cats = await xtreamCall("get_live_categories", effectiveServer);
      const categories = Array.isArray(cats) ? cats : [];
      setXtreamCategories(categories);

      if (categories.length > 0) {
        await loadXtreamCategory(String(categories[0].category_id), {
          server: effectiveServer,
          force: true,
        });
      }

      setLoadingXtream(false);
    } catch (err: any) {
      setXtreamError(err.message || "Error al conectar con el servidor Xtream");
      setLoadingXtream(false);
    }
  };

  const [loadingXtreamCat, setLoadingXtreamCat] = useState(false);

  const loadXtreamCategory = async (
    catId: string,
    options?: { force?: boolean; server?: XtreamServer },
  ) => {
    const server = options?.server || selectedXtream;
    if (!server) return;

    setSelectedXtreamCat(catId);
    setXtreamPage(1);

    if (catId === "*") return;
    if (!options?.force && xtreamLoadedCategories.includes(catId)) return;

    setLoadingXtreamCat(true);
    try {
      const channels = await xtreamCall("get_live_streams", server, { category_id: catId });
      if (Array.isArray(channels)) {
        setXtreamChannels(prev => {
          const existingIds = new Set(prev.map(c => c.stream_id));
          const newChannels = channels.filter((c: XtreamChannel) => !existingIds.has(c.stream_id));
          return [...prev, ...newChannels];
        });
        setXtreamLoadedCategories(prev => prev.includes(catId) ? prev : [...prev, catId]);
      }
    } catch (err) {
      console.error("Error loading category:", err);
      toast.error("Error al cargar canales de esta categoría");
    }
    setLoadingXtreamCat(false);
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

  const playXtreamChannel = (channel: XtreamChannel) => {
    if (!selectedXtream) return;
    const base = xtreamStreamBase || resolveXtreamStreamBase(selectedXtream.server_url);
    const streamUrl = xtreamOutputFormat === "m3u8"
      ? `${base}/live/${encodeURIComponent(selectedXtream.username)}/${encodeURIComponent(selectedXtream.password)}/${channel.stream_id}.m3u8`
      : `${base}/live/${encodeURIComponent(selectedXtream.username)}/${encodeURIComponent(selectedXtream.password)}/${channel.stream_id}.ts`;
    setRawStreamUrl(streamUrl);
    setPlayingName(channel.name);
    setProxyAttempt(0);
    const proxiedUrl = getProxiedUrl(streamUrl, undefined, getPlaybackMode(streamUrl));
    setPlayingUrl(proxiedUrl);
    requestAnimationFrame(() => {
      playerAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // === PLAYER SHARED ===
  const getPlaybackMode = (url: string): "hls" | "probe" => {
    const lowered = url.toLowerCase();
    return lowered.includes(".m3u8") || lowered.includes("output=m3u8") || lowered.includes("output=hls") ? "hls" : "probe";
  };

  const getProxiedUrl = (url: string, mac?: string, mode: "hls" | "probe" = "probe"): string => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "mlgbsogdhvwebwyrmmxn";
    let proxyUrl = `https://${projectId}.supabase.co/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`;
    if (mac) {
      proxyUrl += `&mac=${encodeURIComponent(mac)}`;
    }
    proxyUrl += `&mode=${mode}`;
    return proxyUrl;
  };

  // CORS proxy fallback chain — used when the primary stream-proxy fails
  const buildPlayUrl = (rawUrl: string, attempt: 0 | 1 | 2, mac?: string): string => {
    const mode = getPlaybackMode(rawUrl);
    if (attempt === 0) return getProxiedUrl(rawUrl, mac, mode);
    if (attempt === 1) return `https://corsproxy.io/?${encodeURIComponent(rawUrl)}`;
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`;
  };

  const tryNextProxy = () => {
    if (!rawStreamUrl) return false;
    const next = (proxyAttempt + 1) as 0 | 1 | 2;
    if (next > 2) return false;
    console.warn(`Stream falló, probando proxy alternativo #${next}...`);
    setProxyAttempt(next);
    setPlayerError(null);
    setPlayingUrl(buildPlayUrl(rawStreamUrl, next));
    return true;
  };

  const cleanStreamCmd = (cmd?: string | null): string | null => {
    if (!cmd) return null;
    const cleaned = cmd.replace(/^ffmpeg\s+/i, "").replace(/^ffrt\s+/i, "").trim();
    return cleaned.length > 0 ? cleaned : null;
  };

  const isUsableHttpStream = (candidate?: string | null): candidate is string => {
    if (!candidate || !/^https?:\/\//i.test(candidate)) return false;
    try {
      const parsed = new URL(candidate);
      const streamParam = parsed.searchParams.get("stream");
      if (streamParam !== null && streamParam.trim() === "") return false;
      return true;
    } catch {
      return false;
    }
  };

  const rebuildBrokenLinkCmd = (linkCmd?: string | null, originalCmd?: string | null): string | null => {
    const cleanLink = cleanStreamCmd(linkCmd);
    const cleanOriginal = cleanStreamCmd(originalCmd);
    if (!cleanLink) return cleanOriginal;
    try {
      const linkUrl = new URL(cleanLink);
      const originalUrl = cleanOriginal ? new URL(cleanOriginal) : null;
      const linkStream = linkUrl.searchParams.get("stream")?.trim() || "";
      const originalStream = originalUrl?.searchParams.get("stream")?.trim() || "";
      if (!linkStream && originalStream) {
        linkUrl.searchParams.set("stream", originalStream);
      }
      return linkUrl.toString();
    } catch {
      return cleanLink || cleanOriginal;
    }
  };

  const playChannel = async (channel: StalkerChannel) => {
    if (!selectedPortal || !stalkerToken) return;
    setLoadingLink(channel.id);
    setPlayerError(null);

    try {
      const originalCmd = cleanStreamCmd(channel.cmd);
      const data = await stalkerCall("get_link", selectedPortal, stalkerToken, {
        category_id: channel.cmd,
      });
      const linkCmd = typeof data?.js === "string" ? data.js : data?.js?.cmd;
      const repairedCmd = rebuildBrokenLinkCmd(linkCmd, originalCmd);
      let streamUrl = cleanStreamCmd(repairedCmd);

      if (!isUsableHttpStream(streamUrl) && isUsableHttpStream(originalCmd)) {
        streamUrl = originalCmd;
      }

      if (streamUrl?.startsWith("acestream://")) {
        window.location.href = streamUrl;
      } else if (isUsableHttpStream(streamUrl)) {
        setRawStreamUrl(streamUrl);
        setPlayingName(channel.name);
        setProxyAttempt(0);
        setPlayingUrl(getProxiedUrl(streamUrl, selectedPortal.mac_address, getPlaybackMode(streamUrl)));
        requestAnimationFrame(() => {
          playerAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } else {
        console.error("No usable stream URL returned", { data, originalCmd, repairedCmd });
        toast.error("No se obtuvo URL válida del stream");
      }
    } catch (err: any) {
      console.error("Error getting link:", err);
      toast.error("Error al obtener enlace");
    }
    setLoadingLink(null);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !videoRef.current.muted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  useEffect(() => {
    if (!playingUrl || !videoRef.current) return;
    const video = videoRef.current;
    setPlayerError(null);
    let destroyed = false;
    video.muted = true;
    setIsMuted(true);
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (mpegtsRef.current) { mpegtsRef.current.destroy(); mpegtsRef.current = null; }

    // Detect stream type from URL (check both raw and final to be safe)
    const lowered = `${rawStreamUrl || ""} ${playingUrl}`.toLowerCase();
    const isHlsStream =
      lowered.includes(".m3u8") ||
      lowered.includes("m3u8") ||
      lowered.includes("/hls/") ||
      lowered.includes("output=hls");

    if (isHlsStream && Hls.isSupported()) {
      // Use HLS.js for .m3u8 streams with optimized live config
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        maxBufferHole: 1.5,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 15000,
        levelLoadingMaxRetry: 4,
        startFragPrefetch: true,
      });
      hls.loadSource(playingUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { if (!destroyed) video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (destroyed || !d.fatal) return;
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
          console.warn("HLS network error, recovering...");
          hls.startLoad();
        } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
          console.warn("HLS media error, recovering...");
          hls.recoverMediaError();
        } else {
          hls.destroy();
          hlsRef.current = null;
          if (!tryNextProxy()) {
            setPlayerError("Error HLS. Copia la URL y ábrela en VLC.");
          }
        }
      });
      hlsRef.current = hls;
    } else if (mpegts.isSupported()) {
      // Use mpegts.js for all non-HLS streams with auto-reconnect
      let reconnectAttempts = 0;
      const MAX_RECONNECT = 10;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      // Proactive reconnect before edge function timeout (~120s to be safe)
      let proactiveTimer: ReturnType<typeof setInterval> | null = null;

      const createMpegtsPlayer = () => {
        if (destroyed) return;
        // Destroy previous instance
        if (mpegtsRef.current) {
          try { mpegtsRef.current.destroy(); } catch {}
          mpegtsRef.current = null;
        }

        const player = mpegts.createPlayer({
          type: "mpegts",
          isLive: true,
          url: playingUrl,
        }, {
          enableWorker: true,
          liveBufferLatencyChasing: true,
          liveBufferLatencyMaxLatency: 5,
          liveBufferLatencyMinRemain: 1,
        });
        player.attachMediaElement(video);
        player.load();
        player.play();

        player.on(mpegts.Events.ERROR, (type: string, detail: string) => {
          console.warn("mpegts error, attempting reconnect:", type, detail);
          if (destroyed) return;
          if (reconnectAttempts < MAX_RECONNECT) {
            reconnectAttempts++;
            const delay = Math.min(1000 * reconnectAttempts, 5000);
            reconnectTimer = setTimeout(() => {
              console.log(`Reconnecting stream (attempt ${reconnectAttempts})...`);
              createMpegtsPlayer();
            }, delay);
          } else {
            if (!tryNextProxy()) {
              setPlayerError("Error de reproducción. Copia la URL y ábrela en VLC.");
            }
          }
        });

        mpegtsRef.current = player;
      };

      createMpegtsPlayer();

      // Proactive reconnect every 110s to avoid edge function 150s timeout
      proactiveTimer = setInterval(() => {
        if (destroyed || !video || video.paused) return;
        // Keep stream alive
        console.log("Proactive stream reconnect to avoid timeout...");
        createMpegtsPlayer();
        // Reset reconnect attempts on proactive reconnect
        reconnectAttempts = 0;
      }, 110_000);

      // Also handle video stall events
      const onStalled = () => {
        if (destroyed || reconnectAttempts >= MAX_RECONNECT) return;
        console.warn("Video stalled, reconnecting...");
        reconnectAttempts++;
        reconnectTimer = setTimeout(createMpegtsPlayer, 2000);
      };
      video.addEventListener("stalled", onStalled);

      // Store cleanup refs
      const cleanupMpegts = () => {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (proactiveTimer) clearInterval(proactiveTimer);
        video.removeEventListener("stalled", onStalled);
      };
      // Attach cleanup to the destroyed flag check in the main cleanup
      const origCleanup = () => {
        cleanupMpegts();
        if (mpegtsRef.current) { try { mpegtsRef.current.destroy(); } catch {} mpegtsRef.current = null; }
      };
      // Store for cleanup
      (video as any).__mpegtsCleanup = origCleanup;
    } else {
      video.src = playingUrl;
      video.play().catch(() => {});
    }

    const timeout = setTimeout(() => {
      if (video.readyState < 2 && !destroyed) {
        setPlayerError("Cargando stream... Si no reproduce, copia la URL y ábrela en VLC.");
      }
    }, 15000);

    return () => {
      destroyed = true;
      clearTimeout(timeout);
      if ((video as any).__mpegtsCleanup) { (video as any).__mpegtsCleanup(); (video as any).__mpegtsCleanup = null; }
      else if (mpegtsRef.current) { try { mpegtsRef.current.destroy(); } catch {} mpegtsRef.current = null; }
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [playingUrl]);

  const closePlayer = () => {
    setPlayingUrl(null);
    setRawStreamUrl(null);
    setPlayingName("");
    setPlayerError(null);
    if (videoRef.current && (videoRef.current as any).__mpegtsCleanup) {
      (videoRef.current as any).__mpegtsCleanup();
      (videoRef.current as any).__mpegtsCleanup = null;
    } else if (mpegtsRef.current) { try { mpegtsRef.current.destroy(); } catch {} mpegtsRef.current = null; }
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
  };

  const copyStreamUrl = () => {
    if (rawStreamUrl) {
      navigator.clipboard.writeText(rawStreamUrl);
      toast.success("URL copiada al portapapeles — pega en VLC");
    }
  };

  const logout = () => {
    sessionStorage.removeItem("access");
    navigate("/");
  };

  const getCategoryClass = (cat: string) => categoryColors[cat] || categoryColors.General;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Waves className="w-6 h-6 text-electric" />
            <h1 className="font-display text-xl font-bold text-electric text-glow-electric tracking-wider">
              EL OCÉANO
            </h1>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </header>

      {/* Player */}
      {playingUrl && (
        <div ref={playerAnchorRef} className="w-full bg-black">
          <div className="px-2 py-2 sm:container sm:mx-auto sm:px-4 sm:py-4 space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Play className="w-3 h-3 sm:w-4 sm:h-4 text-electric shrink-0" />
                <h2 className="font-display text-[10px] sm:text-xs font-bold tracking-wider text-electric truncate">
                  {playingName || "REPRODUCTOR"}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleMute}
                  aria-label={isMuted ? "Activar sonido" : "Silenciar"}
                  className="p-1.5 sm:p-2 bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-destructive" /> : <Volume2 className="w-4 h-4 text-electric" />}
                </button>
                <button
                  onClick={closePlayer}
                  aria-label="Cerrar reproductor"
                  className="p-1.5 sm:p-2 bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {isMuted && (
              <button
                onClick={toggleMute}
                className="w-full py-2 bg-electric/20 border border-electric/40 rounded-lg text-electric text-xs font-display tracking-wider flex items-center justify-center gap-2 animate-pulse"
              >
                <VolumeX className="w-4 h-4" /> TOCA PARA ACTIVAR SONIDO
              </button>
            )}
            <video ref={videoRef} controls autoPlay muted playsInline preload="auto" className="w-full aspect-video bg-muted rounded-lg" />
            {playerError && <p className="text-destructive text-xs sm:text-sm">{playerError}</p>}
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <button
                onClick={copyStreamUrl}
                className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-card border border-border rounded-lg text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Copiar URL (VLC)
              </button>
              {rawStreamUrl && (
                <a
                  href={rawStreamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-card border border-border rounded-lg text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Abrir directo
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-electric border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="mac" className="w-full">
            <TabsList className="w-full mb-6 bg-card border border-border">
              <TabsTrigger value="mac" className="flex-1 font-display text-xs tracking-wider data-[state=active]:text-electric">
                MAC PORTAL
              </TabsTrigger>
              {xtreamServers.length > 0 && (
                <TabsTrigger value="xtream" className="flex-1 font-display text-xs tracking-wider data-[state=active]:text-emerald-400">
                  <Tv className="w-4 h-4 mr-1" /> XTREAM
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

            {/* MAC PORTAL */}
            <TabsContent value="mac">
              {macPortals.length === 0 ? (
                <div className="text-center py-20">
                  <Waves className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg">No hay portales MAC configurados</p>
                </div>
              ) : (
                <div>
                  {macPortals.length > 1 && (
                    <div className="flex gap-2 mb-6 flex-wrap">
                      {macPortals.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => connectToPortal(p)}
                          className={`px-4 py-2 rounded-lg font-display text-xs tracking-wider transition-all ${
                            selectedPortal?.id === p.id
                              ? "gradient-electric text-secondary-foreground glow-electric"
                              : "bg-card border border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {loadingPortal ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <Loader2 className="w-10 h-10 text-electric animate-spin" />
                      <p className="text-muted-foreground font-display text-sm tracking-wider">CONECTANDO AL PORTAL...</p>
                    </div>
                  ) : portalError ? (
                    <div className="text-center py-20">
                      <p className="text-destructive text-lg mb-4">{portalError}</p>
                      <button
                        onClick={() => selectedPortal && connectToPortal(selectedPortal)}
                        className="px-6 py-3 gradient-electric text-secondary-foreground font-display font-bold tracking-wider rounded-lg text-sm"
                      >
                        REINTENTAR
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                      {/* Genres sidebar */}
                      {genres.length > 0 && (
                        <div className="hidden md:block w-56 shrink-0">
                          <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-24">
                            <div className="p-3 border-b border-border">
                              <h3 className="font-display text-xs font-bold text-electric tracking-wider">CATEGORÍAS</h3>
                            </div>
                            <div className="max-h-[60vh] overflow-y-auto">
                              <button
                                onClick={() => selectGenre("*")}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                  selectedGenre === "*" ? "bg-electric/20 text-electric" : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                                }`}
                              >
                                Todos
                              </button>
                              {genres.map((g) => (
                                <button
                                  key={g.id}
                                  onClick={() => selectGenre(g.id)}
                                  className={`w-full text-left px-3 py-2 text-sm transition-colors truncate ${
                                    selectedGenre === g.id ? "bg-electric/20 text-electric" : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                                  }`}
                                >
                                  {g.title}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Mobile genre selector */}
                      {genres.length > 0 && (
                        <div className="md:hidden w-full mb-4">
                          <select
                            value={selectedGenre}
                            onChange={(e) => selectGenre(e.target.value)}
                            className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground text-sm"
                          >
                            <option value="*">Todas las categorías</option>
                            {genres.map((g) => (
                              <option key={g.id} value={g.id}>{g.title}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Channels grid */}
                      <div className="flex-1 min-w-0">
                        <div className="mb-4 relative">
                          <input
                            type="text"
                            placeholder="Buscar canal..."
                            value={channelSearch}
                            onChange={(e) => setChannelSearch(e.target.value)}
                            className="w-full px-4 py-2.5 pr-10 bg-card border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-electric/60 transition-colors"
                          />
                          {channelSearch && (
                            <button
                              onClick={() => setChannelSearch("")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {loadingChannels ? (
                          <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-electric animate-spin" />
                          </div>
                        ) : channels.length === 0 ? (
                          <div className="text-center py-20">
                            <p className="text-muted-foreground">No hay canales en esta categoría</p>
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {channels.map((ch) => {
                                const genre = genres.find((g) => g.id === ch.tv_genre_id);
                                return (
                                  <div key={ch.id} className="group bg-card border border-border rounded-xl p-5 hover:border-electric/40 transition-all duration-300 hover:glow-electric">
                                    <div className="flex items-start justify-between mb-3">
                                      <h3 className="font-display text-sm font-semibold text-foreground tracking-wide truncate pr-2">
                                        {ch.name}
                                      </h3>
                                      {genre && (
                                        <span className="text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap bg-electric/20 text-electric">
                                          {genre.title}
                                        </span>
                                      )}
                                    </div>
                                    {ch.number && (
                                      <p className="text-xs text-muted-foreground mb-2">Ch. {ch.number}</p>
                                    )}
                                    <div className="mb-4" />
                                    <button
                                      onClick={() => playChannel(ch)}
                                      disabled={loadingLink === ch.id}
                                      onContextMenu={(e) => e.preventDefault()}
                                      className="flex items-center justify-center gap-2 w-full py-3 gradient-electric text-secondary-foreground font-display font-bold tracking-wider rounded-lg hover:opacity-90 transition-opacity text-sm glow-electric select-none disabled:opacity-50"
                                    >
                                      {loadingLink === ch.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Play className="w-4 h-4" />
                                      )}
                                      VER STREAM
                                    </button>
                                  </div>
                                );
                              })}
                            </div>

                            {totalPages > 1 && (
                              <div className="flex items-center justify-center gap-4 mt-8">
                                <button
                                  onClick={() => selectedPortal && stalkerToken && loadChannels(selectedPortal, stalkerToken, selectedGenre, currentPage - 1, channelSearch || undefined)}
                                  disabled={currentPage <= 1}
                                  className="p-2 bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                                >
                                  <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className="font-display text-sm text-muted-foreground tracking-wider">
                                  {currentPage} / {totalPages}
                                </span>
                                <button
                                  onClick={() => selectedPortal && stalkerToken && loadChannels(selectedPortal, stalkerToken, selectedGenre, currentPage + 1, channelSearch || undefined)}
                                  disabled={currentPage >= totalPages}
                                  className="p-2 bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                                >
                                  <ChevronRight className="w-5 h-5" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>


            {/* XTREAM CODES */}
            {xtreamServers.length > 0 && (
              <TabsContent value="xtream">
                <div>
                  {/* Server selector */}
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
                      <p className="text-muted-foreground text-lg">Selecciona un servidor Xtream para ver los canales</p>
                    </div>
                  ) : loadingXtream ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                      <p className="text-muted-foreground font-display text-sm tracking-wider">CONECTANDO AL SERVIDOR XTREAM...</p>
                    </div>
                  ) : xtreamError ? (
                    <div className="text-center py-20">
                      <p className="text-destructive text-lg mb-4">{xtreamError}</p>
                      <button
                        onClick={() => selectedXtream && connectToXtream(selectedXtream)}
                        className="px-6 py-3 bg-emerald-500 text-secondary-foreground font-display font-bold tracking-wider rounded-lg text-sm"
                      >
                        REINTENTAR
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                      {/* Categories sidebar */}
                      {xtreamCategories.length > 1 && (
                        <div className="hidden md:block w-56 shrink-0">
                          <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-24">
                            <div className="p-3 border-b border-border">
                              <h3 className="font-display text-xs font-bold text-emerald-400 tracking-wider">CATEGORÍAS</h3>
                            </div>
                            <div className="max-h-[60vh] overflow-y-auto">
                              <button
                                onClick={() => loadXtreamCategory("*")}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                  selectedXtreamCat === "*" ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                                }`}
                              >
                                Todos ({xtreamChannels.length})
                              </button>
                              {xtreamCategories.map((c) => (
                                <button
                                  key={c.category_id}
                                  onClick={() => loadXtreamCategory(c.category_id)}
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

                      {/* Mobile category selector */}
                      {xtreamCategories.length > 1 && (
                        <div className="md:hidden w-full mb-4">
                          <select
                            value={selectedXtreamCat}
                            onChange={(e) => loadXtreamCategory(e.target.value)}
                            className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground text-sm"
                          >
                            <option value="*">Todas las categorías ({xtreamChannels.length})</option>
                            {xtreamCategories.map((c) => (
                              <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Channels */}
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
                            <button
                              onClick={() => setXtreamSearch("")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {loadingXtreamCat ? (
                          <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                            <p className="text-muted-foreground text-sm">Cargando canales...</p>
                          </div>
                        ) : xtreamPageChannels.length === 0 ? (
                          <div className="text-center py-20">
                            <p className="text-muted-foreground">No hay canales en esta categoría</p>
                            {selectedXtreamCat !== "*" && xtreamChannels.length === 0 && (
                              <button
                                onClick={() => loadXtreamCategory(selectedXtreamCat)}
                                className="mt-4 px-6 py-3 bg-emerald-500 text-secondary-foreground font-display font-bold tracking-wider rounded-lg text-sm"
                              >
                                CARGAR CANALES
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {xtreamPageChannels.map((ch) => (
                                <div key={ch.stream_id} className="group bg-card border border-border rounded-xl p-5 hover:border-emerald-400/40 transition-all duration-300">
                                  <div className="flex items-start justify-between mb-3">
                                    <h3 className="font-display text-sm font-semibold text-foreground tracking-wide truncate pr-2">
                                      {ch.name}
                                    </h3>
                                  </div>
                                  <div className="mb-4" />
                                  <button
                                    onClick={() => playXtreamChannel(ch)}
                                    onContextMenu={(e) => e.preventDefault()}
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-secondary-foreground font-display font-bold tracking-wider rounded-lg hover:opacity-90 transition-opacity text-sm select-none"
                                  >
                                    <Play className="w-4 h-4" /> VER STREAM
                                  </button>
                                </div>
                              ))}
                            </div>

                            {xtreamTotalPages > 1 && (
                              <div className="flex items-center justify-center gap-4 mt-8">
                                <button
                                  onClick={() => setXtreamPage(p => Math.max(1, p - 1))}
                                  disabled={xtreamPage <= 1}
                                  className="p-2 bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                                >
                                  <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className="font-display text-sm text-muted-foreground tracking-wider">
                                  {xtreamPage} / {xtreamTotalPages}
                                </span>
                                <button
                                  onClick={() => setXtreamPage(p => Math.min(xtreamTotalPages, p + 1))}
                                  disabled={xtreamPage >= xtreamTotalPages}
                                  className="p-2 bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                                >
                                  <ChevronRight className="w-5 h-5" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            {m3uPlaylists.length > 0 && (
              <TabsContent value="m3u">
                <div>
                  <div className="flex gap-2 mb-6 flex-wrap">
                    {m3uPlaylists.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => loadM3uPlaylist(p)}
                        className={`px-4 py-2 rounded-lg font-display text-xs tracking-wider transition-all ${
                          selectedM3u?.id === p.id
                            ? "bg-amber-500 text-secondary-foreground"
                            : "bg-card border border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {p.name}
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
                      <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                      <p className="text-muted-foreground font-display text-sm tracking-wider">CARGANDO LISTA...</p>
                    </div>
                  ) : m3uError ? (
                    <div className="text-center py-20">
                      <p className="text-destructive text-lg mb-4">{m3uError}</p>
                      <button
                        onClick={() => selectedM3u && loadM3uPlaylist(selectedM3u)}
                        className="px-6 py-3 bg-amber-500 text-secondary-foreground font-display font-bold tracking-wider rounded-lg text-sm"
                      >
                        REINTENTAR
                      </button>
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
                                onClick={() => { setSelectedM3uGroup("*"); setM3uPage(1); }}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                  selectedM3uGroup === "*" ? "bg-amber-500/20 text-amber-400" : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                                }`}
                              >
                                Todos ({m3uChannels.length})
                              </button>
                              {m3uGroups.map((g) => (
                                <button
                                  key={g}
                                  onClick={() => { setSelectedM3uGroup(g); setM3uPage(1); }}
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
                            <button
                              onClick={() => setM3uSearch("")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
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
                                <div key={`${ch.url}-${idx}`} className="group bg-card border border-border rounded-xl p-5 hover:border-amber-400/40 transition-all duration-300">
                                  <div className="flex items-start justify-between mb-3">
                                    <h3 className="font-display text-sm font-semibold text-foreground tracking-wide truncate pr-2">
                                      {ch.name}
                                    </h3>
                                    {ch.group && (
                                      <span className="text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap bg-amber-500/20 text-amber-400 truncate max-w-[40%]">
                                        {ch.group}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mb-4" />
                                  <button
                                    onClick={() => playM3uChannel(ch)}
                                    onContextMenu={(e) => e.preventDefault()}
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-amber-500 hover:bg-amber-600 text-secondary-foreground font-display font-bold tracking-wider rounded-lg hover:opacity-90 transition-opacity text-sm select-none"
                                  >
                                    <Play className="w-4 h-4" /> VER STREAM
                                  </button>
                                </div>
                              ))}
                            </div>

                            {m3uTotalPages > 1 && (
                              <div className="flex items-center justify-center gap-4 mt-8">
                                <button
                                  onClick={() => setM3uPage(p => Math.max(1, p - 1))}
                                  disabled={m3uPage <= 1}
                                  className="p-2 bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                                >
                                  <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className="font-display text-sm text-muted-foreground tracking-wider">
                                  {m3uPage} / {m3uTotalPages}
                                </span>
                                <button
                                  onClick={() => setM3uPage(p => Math.min(m3uTotalPages, p + 1))}
                                  disabled={m3uPage >= m3uTotalPages}
                                  className="p-2 bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                                >
                                  <ChevronRight className="w-5 h-5" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            {streams.length > 0 && (
              <TabsContent value="acestream">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {streams.map((stream) => (
                    <div key={stream.id} className="group bg-card border border-border rounded-xl p-5 hover:border-electric/40 transition-all duration-300 hover:glow-electric">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-display text-sm font-semibold text-foreground tracking-wide truncate pr-2">{stream.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${getCategoryClass(stream.category)}`}>{stream.category}</span>
                      </div>
                      <div className="mb-4" />
                      <button
                        onClick={() => { window.location.href = `acestream://${stream.acestream_id}`; }}
                        onContextMenu={(e) => e.preventDefault()}
                        className="flex items-center justify-center gap-2 w-full py-3 gradient-electric text-secondary-foreground font-display font-bold tracking-wider rounded-lg hover:opacity-90 transition-opacity text-sm glow-electric select-none"
                      >
                        <Play className="w-4 h-4" /> VER STREAM
                      </button>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default OceanView;

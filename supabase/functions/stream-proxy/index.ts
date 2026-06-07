import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "Content-Range, Content-Length, Content-Type",
};

const STB_USER_AGENT =
  "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const HLS_CONTENT_TYPES = ["application/vnd.apple.mpegurl", "application/x-mpegurl"];
const EXTERNAL_FUNCTION_PATH = "/functions/v1/stream-proxy";

const resolveUrl = (value: string, baseUrl: string) => {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
};

const looksLikeHlsRequest = (url: string, mode: string) => {
  const lowered = url.toLowerCase();
  return mode === "hls" || lowered.includes(".m3u8") || lowered.includes("output=m3u8");
};

const buildProxyUrl = (proxyBase: string, targetUrl: string, mac?: string) => {
  const proxiedUrl = new URL(proxyBase);
  proxiedUrl.searchParams.set("url", targetUrl);
  if (mac) {
    proxiedUrl.searchParams.set("mac", mac);
  }
  return proxiedUrl.toString();
};

const rewriteHlsAttributes = (
  line: string,
  baseUrl: string,
  proxyBase: string,
  mac?: string,
) => {
  return line.replace(/URI="([^"]+)"/g, (_match, value) => {
    const resolvedUrl = resolveUrl(value, baseUrl);
    return `URI="${buildProxyUrl(proxyBase, resolvedUrl, mac)}"`;
  });
};

const rewriteHlsPlaylist = (
  playlistText: string,
  baseUrl: string,
  proxyBase: string,
  mac?: string,
) => {
  return playlistText
    .split(/\r?\n/)
    .map((line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        return line;
      }

      if (trimmedLine.startsWith("#")) {
        return rewriteHlsAttributes(line, baseUrl, proxyBase, mac);
      }

      const resolvedUrl = resolveUrl(trimmedLine, baseUrl);
      return buildProxyUrl(proxyBase, resolvedUrl, mac);
    })
    .join("\n");
};

const streamWithPrefix = (
  prefix: Uint8Array,
  reader: ReadableStreamDefaultReader<Uint8Array>,
) => {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(prefix);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestUrl = new URL(req.url);
    const streamUrl = requestUrl.searchParams.get("url");
    const mac = requestUrl.searchParams.get("mac");
    const mode = requestUrl.searchParams.get("mode") || "";

    if (!streamUrl) {
      return new Response(JSON.stringify({ error: "url parameter required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Force https so HLS segment URLs rewritten in the playlist are not blocked
    // by the browser as mixed content when the app runs over HTTPS.
    const proxyBase = `https://${requestUrl.host}${EXTERNAL_FUNCTION_PATH}`;

    const streamUrlObj = new URL(streamUrl);
    const referer = `${streamUrlObj.protocol}//${streamUrlObj.host}/`;

    const headers: Record<string, string> = {
      "User-Agent": mac ? STB_USER_AGENT : DEFAULT_USER_AGENT,
      "Referer": referer,
      "Origin": referer.replace(/\/$/, ""),
      "Accept": "*/*",
      "Connection": "keep-alive",
    };

    const rangeHeader = req.headers.get("range");
    if (rangeHeader && !looksLikeHlsRequest(streamUrl, mode)) {
      headers["Range"] = rangeHeader;
    }

    if (mac) {
      const encodedMac = encodeURIComponent(mac.toUpperCase());
      headers["Cookie"] = `mac=${encodedMac}; stb_lang=es; timezone=Europe%2FMadrid`;
    }

    const response = await fetch(streamUrl, {
      headers,
      redirect: "follow",
      signal: req.signal,
    });

    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, no-transform",
      "Pragma": "no-cache",
      "Expires": "0",
      "X-Accel-Buffering": "no",
      "Accept-Ranges": "none",
      "Content-Disposition": "inline",
    };

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const finalUrl = response.url || streamUrl;
    const looksLikeHls =
      mode === "hls" ||
      finalUrl.toLowerCase().includes(".m3u8") ||
      HLS_CONTENT_TYPES.some((type) => contentType.includes(type));

    if (looksLikeHls) {
      const playlistText = await response.text();
      const rewrittenPlaylist = rewriteHlsPlaylist(playlistText, finalUrl, proxyBase, mac);

      return new Response(rewrittenPlaylist, {
        status: response.status,
        headers: {
          ...responseHeaders,
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        },
      });
    }

    if (response.status === 206) {
      const contentRange = response.headers.get("content-range");
      const contentLength = response.headers.get("content-length");
      if (contentRange) responseHeaders["Content-Range"] = contentRange;
      if (contentLength) responseHeaders["Content-Length"] = contentLength;
      responseHeaders["Accept-Ranges"] = response.headers.get("accept-ranges") || "bytes";
    }

    if (contentType && !contentType.includes("application/octet-stream")) {
      responseHeaders["Content-Type"] = contentType;
    } else {
      responseHeaders["Content-Type"] = "video/mp2t";
    }

    if (mode === "probe" && response.body) {
      const reader = response.body.getReader();
      const firstRead = await reader.read();
      const prefix = firstRead.value || new Uint8Array();
      const firstText = new TextDecoder().decode(prefix.slice(0, 256));
      if (firstText.startsWith("#EXTM3U")) {
        const rest = await new Response(streamWithPrefix(prefix, reader)).text();
        const rewrittenPlaylist = rewriteHlsPlaylist(rest, finalUrl, proxyBase, mac);
        return new Response(rewrittenPlaylist, {
          status: response.status,
          headers: {
            ...responseHeaders,
            "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          },
        });
      }

      return new Response(streamWithPrefix(prefix, reader), {
        status: response.status,
        headers: responseHeaders,
      });
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
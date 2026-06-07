import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

   try {
    // Leer los parámetros directamente de la URL (petición GET)
    const reqUrl = new URL(req.url);
    
    // Capturamos si viene una URL directa o las credenciales por separado
    const targetUrl = reqUrl.searchParams.get("url");
    const action = reqUrl.searchParams.get("action");
    const server_url = reqUrl.searchParams.get("server_url");
    const username = reqUrl.searchParams.get("username");
    const password = reqUrl.searchParams.get("password");
    const category_id = reqUrl.searchParams.get("category_id");
    const stream_id = reqUrl.searchParams.get("stream_id");

    // Agrupamos en un objeto simulado para no romper tu lógica de abajo
    const body = { action, server_url, username, password, category_id, stream_id };

    console.log("xtream proxy action:", action, "server:", server_url);

    // Validación: si no hay URL directa ni datos de servidor mínimos, rechaza
    if (!targetUrl && (!action || !server_url || !username || !password)) {
      return new Response(
        JSON.stringify({ error: "action, server_url, username, password required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


     let url: string = "";

  if (targetUrl) {
    url = targetUrl;
  } else if (server_url) {
    let base = server_url.trim().replace(/\/+$/, "");


    switch (action) {
      case "auth":
        url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
        break;
      case "get_live_categories":
        url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_categories`;
        break;
      case "get_live_streams":
        url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams${category_id ? `&category_id=${encodeURIComponent(category_id)}` : ""}`;
        break;
      case "get_stream_url":
        // Return the direct stream URL for the client to use
        const streamUrl = `${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${stream_id}.ts`;
        return new Response(
          JSON.stringify({ url: streamUrl }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
     }
    console.log("Fetching URL:", url.substring(0, 100));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout
    
        const response = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const contentType = response.headers.get("content-type") || "";
    
    if (url.includes(".m3u8") || contentType.includes("mpegurl") || contentType.includes("application/x-mpegURL")) {
      let text = await response.text();
      const urlObj = new URL(url);
      const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);

      const lines = text.split("\n").map(line => {
        line = line.trim();
        if (line && !line.startsWith("#")) {
          if (!line.startsWith("http://") && !line.startsWith("https://")) {
            if (line.startsWith("/")) {
              return `${urlObj.protocol}//${urlObj.host}${line}`;
            }
            return `${baseUrl}${line}`;
          }
        }
        return line;
      });
      
      return new Response(lines.join("\n"), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/x-mpegURL" },
      });
    }

    const blob = await response.blob();
    return new Response(blob, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": contentType },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

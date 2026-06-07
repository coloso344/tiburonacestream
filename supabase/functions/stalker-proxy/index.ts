import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// EXACT MAG/STBEMU UA
const STB_USER_AGENT =
  "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3";

type JsonObject = Record<string, unknown>;

function normalizeBaseUrl(portalUrl: string): string {
  let baseUrl = portalUrl.trim();

  // If user pasted the full portal.php path, keep only the base.
  const idx = baseUrl.toLowerCase().indexOf("portal.php");
  if (idx !== -1) {
    baseUrl = baseUrl.slice(0, idx);
  }

  baseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  return baseUrl;
}

function buildHeaders(baseUrl: string, mac: string, token?: string): Record<string, string> {
  const encodedMac = encodeURIComponent(mac.toUpperCase());

  // EXACT client headers requested
  const headers: Record<string, string> = {
    "User-Agent": STB_USER_AGENT,
    "Referer": baseUrl,
    "Accept": "application/json, text/plain, */*",
    "Cookie": `mac=${encodedMac}; stb_lang=es; timezone=Europe%2FMadrid`,
    "Connection": "keep-alive",
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function buildUrl(baseUrl: string, action: string, categoryId?: string, page?: string): string {
  const portalPhp = `${baseUrl}portal.php`;

  switch (action) {
    case "handshake":
      // EXACT URL shape requested
      return `${portalPhp}?type=stb&action=handshake&token=&prehash=&JsHttpRequest=1-xml`;

    case "get_profile":
      return `${portalPhp}?type=stb&action=get_profile&JsHttpRequest=1-xml`;

    case "get_genres":
      return `${portalPhp}?type=itv&action=get_genres&JsHttpRequest=1-xml`;

    case "get_channels":
      return `${portalPhp}?type=itv&action=get_ordered_list&genre=${encodeURIComponent(categoryId || "*")}&fav=0&sortby=number&p=${encodeURIComponent(page || "1")}&JsHttpRequest=1-xml`;

    case "search_channels":
      return `${portalPhp}?type=itv&action=get_all_channels&JsHttpRequest=1-xml`;

    case "get_link":
      // categoryId is used as cmd from the client
      return `${portalPhp}?type=itv&action=create_link&cmd=${encodeURIComponent(categoryId || "")}&series=&forced_storage=undefined&disable_ad=0&download=0&JsHttpRequest=1-xml`;

    default:
      throw new Error("Invalid action");
  }
}

function attachDebug(payload: unknown, debug: JsonObject): JsonObject {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return { ...(payload as JsonObject), __debug: debug };
  }
  return { data: payload, __debug: debug };
}

function cleanCmdPrefix(cmd?: string | null): string | null {
  if (!cmd || typeof cmd !== "string") return null;
  const cleaned = cmd.replace(/^ffmpeg\s+/i, "").replace(/^ffrt\s+/i, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function repairCreateLinkCmd(returnedCmd?: string | null, originalCmd?: string | null): string | null {
  const cleanReturned = cleanCmdPrefix(returnedCmd);
  const cleanOriginal = cleanCmdPrefix(originalCmd);

  if (!cleanReturned) return cleanOriginal;

  try {
    const returnedUrl = new URL(cleanReturned);
    const originalUrl = cleanOriginal ? new URL(cleanOriginal) : null;

    const returnedStream = returnedUrl.searchParams.get("stream")?.trim() || "";
    const originalStream = originalUrl?.searchParams.get("stream")?.trim() || "";

    if (!returnedStream && originalStream) {
      returnedUrl.searchParams.set("stream", originalStream);
    }

    return returnedUrl.toString();
  } catch {
    return cleanReturned || cleanOriginal;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      action,
      portal_url,
      mac_address,
      token,
      category_id,
      page,
      search_query,
    } = (body || {}) as {
      action?: string;
      portal_url?: string;
      mac_address?: string;
      token?: string;
      category_id?: string;
      page?: string;
      search_query?: string;
    };

    if (!action) {
      return new Response(JSON.stringify({ __error: { message: "action required" } }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!portal_url || !mac_address) {
      return new Response(
        JSON.stringify({ __error: { message: "portal_url and mac_address required" } }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const baseUrl = normalizeBaseUrl(portal_url);
    const url = buildUrl(baseUrl, action, category_id, page);
    const headers = buildHeaders(baseUrl, mac_address, token);

    const debug = {
      url,
      headers,
      baseUrl,
      action,
    } satisfies JsonObject;

    let response: Response;
    try {
      response = await fetch(url, { method: "GET", headers });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const payload = attachDebug(
        { __error: { message: `Fetch failed: ${errMsg}` } },
        { ...debug, fetch_error: errMsg },
      );

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    const fullDebug = {
      ...debug,
      status: response.status,
      ok: response.ok,
      // keep response for UI debugging (truncated)
      response_text: text.slice(0, 5000),
    } satisfies JsonObject;

    let payload: JsonObject = attachDebug(parsed, fullDebug);

    if (action === "search_channels") {
      const jsNode = (payload as any)?.js;
      const allChannels = Array.isArray(jsNode)
        ? jsNode
        : Array.isArray(jsNode?.data)
          ? jsNode.data
          : [];

      const searchTerm = (search_query || "").trim().toLowerCase();
      const filtered = searchTerm
        ? allChannels.filter((ch: any) => String(ch?.name || "").toLowerCase().includes(searchTerm))
        : allChannels;

      const pageNumber = Math.max(1, Number(page || "1") || 1);
      const perPage = 14;
      const totalItems = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
      const safePage = Math.min(pageNumber, totalPages);
      const start = (safePage - 1) * perPage;
      const pagedData = filtered.slice(start, start + perPage);

      const prevDebug = ((payload as any)?.__debug || {}) as JsonObject;
      payload = {
        js: {
          total_items: totalItems,
          max_page_items: perPage,
          selected_item: 0,
          cur_page: safePage - 1,
          data: pagedData,
        },
        __debug: {
          ...prevDebug,
          search_query: searchTerm,
          source_total_items: allChannels.length,
          filtered_items: totalItems,
        },
      };
    }

    if (action === "get_link") {
      const originalCmd = typeof category_id === "string" ? category_id : undefined;
      const jsNode = (payload as any)?.js;
      const returnedCmd = typeof jsNode === "string" ? jsNode : jsNode?.cmd;
      const repairedCmd = repairCreateLinkCmd(returnedCmd, originalCmd);

      if (repairedCmd && repairedCmd !== cleanCmdPrefix(returnedCmd)) {
        if (typeof jsNode === "string") {
          (payload as any).js = repairedCmd;
        } else if (jsNode && typeof jsNode === "object") {
          (payload as any).js = { ...jsNode, cmd: repairedCmd };
        }

        const prevDebug = ((payload as any)?.__debug || {}) as JsonObject;
        (payload as any).__debug = {
          ...prevDebug,
          repaired_cmd: true,
          repaired_cmd_value: repairedCmd,
        };
      }
    }

    if (!response.ok) {
      payload = {
        ...payload,
        __error: {
          message: `Status ${response.status}`,
          portal_error:
            (payload as any)?.js?.error || (payload as any)?.error || undefined,
        },
      };
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ __error: { message } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

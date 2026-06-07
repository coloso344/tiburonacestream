import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { access_level } = await req.json();

    // Get IP from headers
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || req.headers.get("cf-connecting-ip") 
      || "unknown";

    let country = req.headers.get("cf-ipcountry") || null;
    let city = req.headers.get("cf-ipcity") || null;
    let region = req.headers.get("cf-region") || null;

    // Fallback to ip-api if Cloudflare headers missing
    if (!country || !city) {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,regionName`);
        if (geoRes.ok) {
          const geo = await geoRes.json();
          country = country || geo.country || null;
          city = city || geo.city || null;
          region = region || geo.regionName || null;
        }
      } catch { /* ignore geo errors */ }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("visitor_logs").insert({
      ip_address: ip,
      country,
      city,
      region,
      access_level: access_level || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

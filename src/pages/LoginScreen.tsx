import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SplashScreen from "@/components/SplashScreen";
import cyberSharkCover from "@/assets/cyber-shark-cover.png";

// === FUNCIÓN DE TRACKING ===
const trackVisit = async (accessLevel: string) => {
  try {
    // Obtener IP y ubicación (gratis, sin API key)
    const geoRes = await fetch("https://ipapi.co/json/");
    const geo = await geoRes.json();
    
    await supabase.from("visitor_logs").insert([{
      ip_address: geo.ip || "unknown",
      country: geo.country_name || null,
      city: geo.city || null,
      region: geo.region || null,
      access_level: accessLevel,
      visited_at: new Date().toISOString(),
    }]);
    
    console.log("✅ Visita registrada:", accessLevel, geo.city, geo.country_name);
  } catch (err) {
    console.error("❌ Error tracking:", err);
  }
};

const LoginScreen = () => {
  const [showSplash, setShowSplash] = useState(() => {
    return !sessionStorage.getItem("splashSeen");
  });

  useEffect(() => {
    if (showSplash) {
      const handler = () => {
        setShowSplash(false);
        sessionStorage.setItem("splashSeen", "true");
      };
      window.addEventListener("splash-done", handler);
      return () => window.removeEventListener("splash-done", handler);
    }
  }, [showSplash]);
  
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code === "PANTUFLAS.1873") {
        sessionStorage.setItem("access", "visitor");
        trackVisit("visitor");
        navigate("/ocean");
        return;
    }
    
    if (code === "borico344") {
        sessionStorage.setItem("access", "premium");
        trackVisit("premium");
        navigate("/ocean");
        return;
    }
    
    if (code === "lucifer.4818") {
        sessionStorage.setItem("access", "admin");
        trackVisit("admin");
        navigate("/admin");
        return;
    }
    
    // Validate against access_codes table (temporary codes with expiration)
    const { data, error: dbError } = await supabase
        .from("access_codes")
        .select("access_level, expires_at")
        .eq("code", code)
        .maybeSingle();
    
    if (!dbError && data && new Date(data.expires_at) > new Date()) {
        const level = data.access_level || "visitor";
        sessionStorage.setItem("access", level);
        trackVisit(level);
        navigate(level === "admin" ? "/admin" : "/ocean");
        return;
    }
    
    setError("Código incorrecto o expirado");
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  return (
    <>
      <SplashScreen visible={showSplash} onComplete={() => {}} />
      <div className="relative min-h-screen flex flex-col items-center justify-center bg-background px-4 overflow-hidden">
        {/* Cyber shark cover background */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${cyberSharkCover})` }}
        />
        {/* Dark gradient overlay for legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background/95" />
        <div className="absolute inset-0 bg-background/40" />
        {/* Subtle glow accents */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-electric/10 blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-sm text-center">
          <div className="mb-8 animate-float">
            <div className="w-20 h-20 mx-auto rounded-2xl gradient-gold flex items-center justify-center glow-gold">
              <Lock className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>

          <h1 className="font-display text-3xl font-bold text-primary mb-2 text-glow-gold tracking-wider">
          SHARK STREAM
          </h1>
          <p className="text-foreground/80 mb-8 text-sm drop-shadow-lg">
          Introduce tu código de acceso
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(""); }}
            placeholder="Código de acceso..."
            className={`w-full px-5 py-4 bg-surface/80 backdrop-blur-md border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-center font-display tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all ${shaking ? "animate-[shake_0.3s_ease-in-out]" : ""}`}
            autoFocus
          />
          {error && (
            <p className="text-destructive text-sm animate-pulse">{error}</p>
          )}
          <button
            type="submit"
            className="w-full py-4 gradient-gold text-primary-foreground font-display font-bold tracking-wider rounded-lg glow-gold hover:opacity-90 transition-opacity text-lg"
          >
            ENTRAR
          </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default LoginScreen;

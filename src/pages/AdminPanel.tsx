import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, LogOut, Download, Upload } from "lucide-react";
import VisitorMap from "@/components/VisitorMap";

export default function AdminPanel() {
  const navigate = useNavigate();

  const logout = () => {
    sessionStorage.removeItem("access");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-amber-400" />
            <h1 className="font-display text-xl font-bold text-amber-400">EL TIBURÓN</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Download className="w-4 h-4" /> EXPORTAR
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-sm text-emerald-400 hover:bg-emerald-500/30 transition-colors">
              <Upload className="w-4 h-4" /> IMPORTAR
            </button>
            <button onClick={logout} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
              <LogOut className="w-4 h-4" /> Salir
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="mac" className="w-full">
          <TabsList className="w-full mb-6 bg-card border border-border grid grid-cols-5">
            <TabsTrigger value="mac" className="font-display text-xs tracking-wider data-[state=active]:text-blue-400">
              MAC PORTAL
            </TabsTrigger>
            <TabsTrigger value="m3u" className="font-display text-xs tracking-wider data-[state=active]:text-blue-400">
              IPTV M3U
            </TabsTrigger>
            <TabsTrigger value="ace" className="font-display text-xs tracking-wider data-[state=active]:text-blue-400">
              ACE
            </TabsTrigger>
            <TabsTrigger value="xtream" className="font-display text-xs tracking-wider data-[state=active]:text-blue-400">
              XTREAM
            </TabsTrigger>
            <TabsTrigger value="visit" className="font-display text-xs tracking-wider data-[state=active]:text-blue-400">
              VISIT
            </TabsTrigger>
          </TabsList>

          {/* MAC PORTAL TAB */}
          <TabsContent value="mac">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-bold text-blue-400 mb-4">+ AÑADIR PORTAL STALKER / MAC</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Nombre del portal (ej: WeaselTV)" className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400" />
                <input type="text" placeholder="URL del portal (ej: http://weaseltv.live:80/c/)" className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400" />
                <input type="text" placeholder="MAC Address (ej: 00:1A:79:72:C6:74)" className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400" />
                <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors">
                  AÑADIR PORTAL
                </button>
              </div>
            </div>
            <div className="mt-6 bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-bold text-blue-400 mb-4">PORTALES MAC (0)</h3>
              <p className="text-muted-foreground text-center py-8">No hay portales MAC aún</p>
            </div>
          </TabsContent>

          {/* IPTV M3U TAB */}
          <TabsContent value="m3u">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-bold text-blue-400 mb-4">GESTIÓN DE LISTAS M3U</h2>
              <p className="text-muted-foreground">Aquí irá la gestión de listas M3U.</p>
            </div>
          </TabsContent>

          {/* ACE TAB */}
          <TabsContent value="ace">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-bold text-blue-400 mb-4">GESTIÓN DE ACESTREAM</h2>
              <p className="text-muted-foreground">Aquí irá la gestión de Acestream.</p>
            </div>
          </TabsContent>

          {/* XTREAM TAB */}
          <TabsContent value="xtream">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-bold text-blue-400 mb-4">GESTIÓN DE XTREAM CODES</h2>
              <p className="text-muted-foreground">Aquí irá la gestión de Xtream Codes.</p>
            </div>
          </TabsContent>

          {/* VISIT TAB (AQUÍ ESTÁ EL MAPA) */}
          <TabsContent value="visit">
            <VisitorMap />
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}
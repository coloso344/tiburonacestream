import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Plus, Trash2, Pencil, LogOut, Save, X, Radio, Eye, List, Tv } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VisitorsTab from "@/components/admin/VisitorsTab";

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

interface M3uPlaylist {
  id: string;
  name: string;
  url: string;
}

interface XtreamServer {
  id: string;
  name: string;
  server_url: string;
  username: string;
  password: string;
}

const CATEGORIES = ["Deportes", "Cine", "Series", "Noticias", "Música", "General"];

const AdminPanel = () => {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [macPortals, setMacPortals] = useState<MacPortal[]>([]);
  const [m3uPlaylists, setM3uPlaylists] = useState<M3uPlaylist[]>([]);
  const [xtreamServers, setXtreamServers] = useState<XtreamServer[]>([]);
  const [loading, setLoading] = useState(true);

  // Acestream form
  const [name, setName] = useState("");
  const [acestreamId, setAcestreamId] = useState("");
  const [category, setCategory] = useState("General");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", acestream_id: "", category: "" });

  // MAC Portal form
  const [portalName, setPortalName] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [editingPortalId, setEditingPortalId] = useState<string | null>(null);
  const [editPortalForm, setEditPortalForm] = useState({ name: "", portal_url: "", mac_address: "" });

  // M3U form
  const [m3uName, setM3uName] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");
  const [editingM3uId, setEditingM3uId] = useState<string | null>(null);
  const [editM3uForm, setEditM3uForm] = useState({ name: "", url: "" });

  // Xtream Codes form
  const [xtreamName, setXtreamName] = useState("");
  const [xtreamUrl, setXtreamUrl] = useState("");
  const [xtreamUser, setXtreamUser] = useState("");
  const [xtreamPass, setXtreamPass] = useState("");
  const [editingXtreamId, setEditingXtreamId] = useState<string | null>(null);
  const [editXtreamForm, setEditXtreamForm] = useState({ name: "", server_url: "", username: "", password: "" });

  const navigate = useNavigate();


const exportarTodo = () => {
  const backupData = { streams, macPortals, m3uPlaylists, xtreamServers };
  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = "respaldo_oceano.json";
  link.click();
  toast.success("Respaldo descargado");
};

const importarTodo = async (e: any) => {
  const reader = new FileReader();
  if (!e.target.files?.[0]) return;
  reader.onload = async (event) => {
    const data = JSON.parse(event.target?.result as string);
    if (data.streams) await supabase.from("streams").insert(data.streams.map(({id, ...r}: any) => r));
    if (data.macPortals) await supabase.from("mac_portals").insert(data.macPortals.map(({id, ...r}: any) => r));
    toast.success("¡Importado con éxito!");
    fetchAll();
  };
  reader.readAsText(e.target.files[0]);
};

  useEffect(() => {
    if (sessionStorage.getItem("access") !== "admin") {
      navigate("/");
      return;
    }
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [streamsRes, portalsRes, m3uRes, xtreamRes] = await Promise.all([
      supabase.from("streams").select("*").order("created_at", { ascending: false }),
      supabase.from("mac_portals").select("*").order("created_at", { ascending: false }),
      supabase.from("m3u_playlists").select("*").order("created_at", { ascending: false }),
      supabase.from("xtream_codes").select("*").order("created_at", { ascending: false }),
    ]);
    setStreams((streamsRes.data as Stream[]) || []);
    setMacPortals((portalsRes.data as MacPortal[]) || []);
    setM3uPlaylists((m3uRes.data as M3uPlaylist[]) || []);
    setXtreamServers((xtreamRes.data as XtreamServer[]) || []);
    setLoading(false);
  };

  // === ACESTREAM ===
  const addStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !acestreamId.trim()) return;
    const { error } = await supabase.from("streams").insert({ name: name.trim(), acestream_id: acestreamId.trim(), category });
    if (error) { toast.error("Error al añadir"); return; }
    toast.success("Stream añadido");
    setName(""); setAcestreamId(""); setCategory("General");
    fetchAll();
  };

  const deleteStream = async (id: string) => {
    const { error } = await supabase.from("streams").delete().eq("id", id);
    if (error) { toast.error("Error al eliminar"); return; }
    toast.success("Eliminado");
    fetchAll();
  };

  const startEdit = (stream: Stream) => {
    setEditingId(stream.id);
    setEditForm({ name: stream.name, acestream_id: stream.acestream_id, category: stream.category });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase.from("streams").update(editForm).eq("id", editingId);
    if (error) { toast.error("Error al actualizar"); return; }
    toast.success("Actualizado");
    setEditingId(null);
    fetchAll();
  };

  // === MAC PORTALS ===
  const addPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalName.trim() || !portalUrl.trim() || !macAddress.trim()) return;
    const { error } = await supabase.from("mac_portals").insert({
      name: portalName.trim(),
      portal_url: portalUrl.trim(),
      mac_address: macAddress.trim(),
    });
    if (error) { toast.error("Error al añadir portal"); return; }
    toast.success("Portal MAC añadido");
    setPortalName(""); setPortalUrl(""); setMacAddress("");
    fetchAll();
  };

  const deletePortal = async (id: string) => {
    const { error } = await supabase.from("mac_portals").delete().eq("id", id);
    if (error) { toast.error("Error al eliminar"); return; }
    toast.success("Eliminado");
    fetchAll();
  };

  const startEditPortal = (p: MacPortal) => {
    setEditingPortalId(p.id);
    setEditPortalForm({ name: p.name, portal_url: p.portal_url, mac_address: p.mac_address });
  };

  const saveEditPortal = async () => {
    if (!editingPortalId) return;
    const { error } = await supabase.from("mac_portals").update(editPortalForm).eq("id", editingPortalId);
    if (error) { toast.error("Error al actualizar"); return; }
    toast.success("Actualizado");
    setEditingPortalId(null);
    fetchAll();
  };

  // === M3U PLAYLISTS ===
  const addM3u = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!m3uName.trim() || !m3uUrl.trim()) return;
    const { error } = await supabase.from("m3u_playlists").insert({
      name: m3uName.trim(),
      url: m3uUrl.trim(),
    });
    if (error) { toast.error("Error al añadir lista M3U"); return; }
    toast.success("Lista M3U añadida");
    setM3uName(""); setM3uUrl("");
    fetchAll();
  };

  const uploadM3uFile = async (file: File) => {
    try {
      const text = await file.text();
      if (!text.includes("#EXTM3U") && !text.includes("#EXTINF")) {
        toast.error("El archivo no parece una lista M3U válida");
        return;
      }
      const baseName = file.name.replace(/\.(m3u8?|txt)$/i, "");
      const name = m3uName.trim() || baseName;
      const { error } = await supabase.from("m3u_playlists").insert({
        name,
        content: text,
      } as any);
      if (error) { toast.error("Error al subir archivo M3U"); return; }
      toast.success(`Lista "${name}" subida (${(text.length / 1024).toFixed(1)} KB)`);
      setM3uName(""); setM3uUrl("");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Error al leer el archivo");
    }
  };

  const deleteM3u = async (id: string) => {
    const { error } = await supabase.from("m3u_playlists").delete().eq("id", id);
    if (error) { toast.error("Error al eliminar"); return; }
    toast.success("Eliminado");
    fetchAll();
  };

  const startEditM3u = (p: M3uPlaylist) => {
    setEditingM3uId(p.id);
    setEditM3uForm({ name: p.name, url: p.url });
  };

  const saveEditM3u = async () => {
    if (!editingM3uId) return;
    const { error } = await supabase.from("m3u_playlists").update(editM3uForm).eq("id", editingM3uId);
    if (error) { toast.error("Error al actualizar"); return; }
    toast.success("Actualizado");
    setEditingM3uId(null);
    fetchAll();
  };

  // === XTREAM CODES ===
  const addXtream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!xtreamName.trim() || !xtreamUrl.trim() || !xtreamUser.trim() || !xtreamPass.trim()) return;
    const { error } = await supabase.from("xtream_codes").insert({
      name: xtreamName.trim(),
      server_url: xtreamUrl.trim(),
      username: xtreamUser.trim(),
      password: xtreamPass.trim(),
    });
    if (error) { toast.error("Error al añadir servidor Xtream"); return; }
    toast.success("Servidor Xtream añadido");
    setXtreamName(""); setXtreamUrl(""); setXtreamUser(""); setXtreamPass("");
    fetchAll();
  };

  const deleteXtream = async (id: string) => {
    const { error } = await supabase.from("xtream_codes").delete().eq("id", id);
    if (error) { toast.error("Error al eliminar"); return; }
    toast.success("Eliminado");
    fetchAll();
  };

  const startEditXtream = (s: XtreamServer) => {
    setEditingXtreamId(s.id);
    setEditXtreamForm({ name: s.name, server_url: s.server_url, username: s.username, password: s.password });
  };

  const saveEditXtream = async () => {
    if (!editingXtreamId) return;
    const { error } = await supabase.from("xtream_codes").update(editXtreamForm).eq("id", editingXtreamId);
    if (error) { toast.error("Error al actualizar"); return; }
    toast.success("Actualizado");
    setEditingXtreamId(null);
    fetchAll();
  };


  
 


  const logout = () => {
    sessionStorage.removeItem("access");
    navigate("/");
  };

  const inputClass = "px-4 py-3 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="font-display text-xl font-bold text-primary text-glow-gold tracking-wider">
              EL TIBURÓN
            </h1>
          
          <div className="flex gap-2 mr-4">
  <button 
    onClick={exportarTodo}
    className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-1.5 rounded-lg border border-blue-500/30 transition-all text-xs font-bold"
  >
    <Save className="w-3.5 h-3.5" /> EXPORTAR
  </button>
  <label className="flex items-center gap-2 bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white px-3 py-1.5 rounded-lg border border-green-500/30 transition-all text-xs font-bold cursor-pointer">
    <Plus className="w-3.5 h-3.5" /> IMPORTAR
    <input type="file" accept=".json" onChange={importarTodo} className="hidden" />
  </label>
</div>

          <button onClick={logout} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs defaultValue="mac" className="w-full">
          <TabsList className="w-full mb-6 bg-card border border-border">
            <TabsTrigger value="mac" className="flex-1 font-display text-xs tracking-wider data-[state=active]:text-electric">
              MAC PORTAL
            </TabsTrigger>
            <TabsTrigger value="m3u" className="flex-1 font-display text-xs tracking-wider data-[state=active]:text-amber-400">
              <List className="w-4 h-4 mr-1" /> IPTV M3U
            </TabsTrigger>
            <TabsTrigger value="acestream" className="flex-1 font-display text-xs tracking-wider data-[state=active]:text-primary">
              <Radio className="w-4 h-4 mr-1" /> ACE
            </TabsTrigger>
            <TabsTrigger value="xtream" className="flex-1 font-display text-xs tracking-wider data-[state=active]:text-emerald-400">
              <Tv className="w-4 h-4 mr-1" /> XTREAM
            </TabsTrigger>
            <TabsTrigger value="visitors" className="flex-1 font-display text-xs tracking-wider data-[state=active]:text-muted-foreground">
              <Eye className="w-4 h-4 mr-1" /> VISIT
            </TabsTrigger>
          </TabsList>

          {/* === TAB MAC PORTAL === */}
          <TabsContent value="mac">
            <form onSubmit={addPortal} className="bg-card border border-border rounded-xl p-6 mb-8">
              <h2 className="font-display text-sm font-bold text-electric tracking-wider mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> AÑADIR PORTAL STALKER / MAC
              </h2>
              <div className="grid grid-cols-1 gap-3 mb-4">
                <input type="text" placeholder="Nombre del portal (ej: WeaselTV)" value={portalName} onChange={(e) => setPortalName(e.target.value)} className={inputClass} />
                <input type="text" placeholder="URL del portal (ej: http://weaseltv.live:80/c/)" value={portalUrl} onChange={(e) => setPortalUrl(e.target.value)} className={`${inputClass} font-mono`} />
                <input type="text" placeholder="MAC Address (ej: 00:1A:79:72:C6:74)" value={macAddress} onChange={(e) => setMacAddress(e.target.value)} className={`${inputClass} font-mono`} />
              </div>
              <button type="submit" className="w-full sm:w-auto px-8 py-3 gradient-electric text-secondary-foreground font-display font-bold tracking-wider rounded-lg glow-electric hover:opacity-90 transition-opacity text-sm">
                AÑADIR PORTAL
              </button>
            </form>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="font-display text-sm font-bold text-electric tracking-wider">PORTALES MAC ({macPortals.length})</h2>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-electric border-t-transparent rounded-full animate-spin" />
                </div>
              ) : macPortals.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No hay portales MAC aún</p>
              ) : (
                <div className="divide-y divide-border">
                  {macPortals.map((portal) => (
                    <div key={portal.id} className="p-4 hover:bg-surface/50 transition-colors">
                      {editingPortalId === portal.id ? (
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                          <input value={editPortalForm.name} onChange={(e) => setEditPortalForm({ ...editPortalForm, name: e.target.value })} className={`${inputClass} border-electric/30`} />
                          <input value={editPortalForm.portal_url} onChange={(e) => setEditPortalForm({ ...editPortalForm, portal_url: e.target.value })} className={`${inputClass} font-mono border-electric/30`} />
                          <input value={editPortalForm.mac_address} onChange={(e) => setEditPortalForm({ ...editPortalForm, mac_address: e.target.value })} className={`${inputClass} font-mono border-electric/30`} />
                          <div className="flex gap-2">
                            <button onClick={saveEditPortal} className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"><Save className="w-4 h-4" /></button>
                            <button onClick={() => setEditingPortalId(null)} className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-display text-sm font-semibold text-foreground truncate">{portal.name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">MAC</span>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono truncate">{portal.portal_url}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{portal.mac_address}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => startEditPortal(portal)} className="p-2 text-electric hover:bg-electric/10 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => deletePortal(portal.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* === TAB M3U IPTV === */}
          <TabsContent value="m3u">
            <form onSubmit={addM3u} className="bg-card border border-border rounded-xl p-6 mb-8">
              <h2 className="font-display text-sm font-bold text-amber-400 tracking-wider mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> AÑADIR LISTA M3U / IPTV
              </h2>
              <div className="grid grid-cols-1 gap-3 mb-4">
                <input type="text" placeholder="Nombre de la lista (ej: Mi IPTV)" value={m3uName} onChange={(e) => setM3uName(e.target.value)} className={inputClass} />
                <input type="text" placeholder="URL de la lista M3U (ej: http://example.com/playlist.m3u)" value={m3uUrl} onChange={(e) => setM3uUrl(e.target.value)} className={`${inputClass} font-mono`} />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button type="submit" className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-secondary-foreground font-display font-bold tracking-wider rounded-lg hover:opacity-90 transition-opacity text-sm">
                  AÑADIR POR URL
                </button>
                <label className="px-8 py-3 bg-card border-2 border-dashed border-amber-500/50 text-amber-400 hover:bg-amber-500/10 font-display font-bold tracking-wider rounded-lg transition-colors text-sm text-center cursor-pointer">
                  📁 SUBIR ARCHIVO M3U
                  <input
                    type="file"
                    accept=".m3u,.m3u8,audio/x-mpegurl,application/x-mpegURL,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadM3uFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Puedes añadir una lista por URL o subir un archivo <code className="text-amber-400">.m3u</code> / <code className="text-amber-400">.m3u8</code> directamente.
              </p>
            </form>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="font-display text-sm font-bold text-amber-400 tracking-wider">LISTAS M3U ({m3uPlaylists.length})</h2>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : m3uPlaylists.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No hay listas M3U aún</p>
              ) : (
                <div className="divide-y divide-border">
                  {m3uPlaylists.map((pl) => (
                    <div key={pl.id} className="p-4 hover:bg-surface/50 transition-colors">
                      {editingM3uId === pl.id ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                          <input value={editM3uForm.name} onChange={(e) => setEditM3uForm({ ...editM3uForm, name: e.target.value })} className={`${inputClass} border-amber-400/30`} />
                          <input value={editM3uForm.url} onChange={(e) => setEditM3uForm({ ...editM3uForm, url: e.target.value })} className={`${inputClass} font-mono border-amber-400/30`} />
                          <div className="flex gap-2">
                            <button onClick={saveEditM3u} className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"><Save className="w-4 h-4" /></button>
                            <button onClick={() => setEditingM3uId(null)} className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-display text-sm font-semibold text-foreground truncate">{pl.name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">M3U</span>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono truncate">{pl.url}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => startEditM3u(pl)} className="p-2 text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => deleteM3u(pl.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* === TAB ACESTREAM === */}
          <TabsContent value="acestream">
            <form onSubmit={addStream} className="bg-card border border-border rounded-xl p-6 mb-8">
              <h2 className="font-display text-sm font-bold text-primary tracking-wider mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> AÑADIR STREAM
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <input type="text" placeholder="Nombre del canal" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                <input type="text" placeholder="ID de Ace Stream" value={acestreamId} onChange={(e) => setAcestreamId(e.target.value)} className={`${inputClass} font-mono`} />
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full sm:w-auto px-8 py-3 gradient-gold text-primary-foreground font-display font-bold tracking-wider rounded-lg glow-gold hover:opacity-90 transition-opacity text-sm">
                AÑADIR
              </button>
            </form>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="font-display text-sm font-bold text-primary tracking-wider">STREAMS ({streams.length})</h2>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : streams.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No hay streams aún</p>
              ) : (
                <div className="divide-y divide-border">
                  {streams.map((stream) => (
                    <div key={stream.id} className="p-4 hover:bg-surface/50 transition-colors">
                      {editingId === stream.id ? (
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                          <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={`${inputClass} border-primary/30`} />
                          <input value={editForm.acestream_id} onChange={(e) => setEditForm({ ...editForm, acestream_id: e.target.value })} className={`${inputClass} font-mono border-primary/30`} />
                          <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className={`${inputClass} border-primary/30`}>
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <div className="flex gap-2">
                            <button onClick={saveEdit} className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"><Save className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-display text-sm font-semibold text-foreground truncate">{stream.name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{stream.category}</span>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono truncate">{stream.acestream_id}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => startEdit(stream)} className="p-2 text-electric hover:bg-electric/10 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => deleteStream(stream.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* === TAB XTREAM CODES === */}
          <TabsContent value="xtream">
            <form onSubmit={addXtream} className="bg-card border border-border rounded-xl p-6 mb-8">
              <h2 className="font-display text-sm font-bold text-emerald-400 tracking-wider mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> AÑADIR SERVIDOR XTREAM CODES
              </h2>
              <div className="grid grid-cols-1 gap-3 mb-4">
                <input type="text" placeholder="Nombre (ej: Mi IPTV)" value={xtreamName} onChange={(e) => setXtreamName(e.target.value)} className={inputClass} />
                <input type="text" placeholder="URL del servidor (ej: http://example.com:8080)" value={xtreamUrl} onChange={(e) => setXtreamUrl(e.target.value)} className={`${inputClass} font-mono`} />
                <input type="text" placeholder="Usuario" value={xtreamUser} onChange={(e) => setXtreamUser(e.target.value)} className={inputClass} />
                <input type="password" placeholder="Contraseña" value={xtreamPass} onChange={(e) => setXtreamPass(e.target.value)} className={inputClass} />
              </div>
              <button type="submit" className="w-full sm:w-auto px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-secondary-foreground font-display font-bold tracking-wider rounded-lg hover:opacity-90 transition-opacity text-sm">
                AÑADIR SERVIDOR
              </button>
            </form>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="font-display text-sm font-bold text-emerald-400 tracking-wider">SERVIDORES XTREAM ({xtreamServers.length})</h2>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : xtreamServers.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No hay servidores Xtream aún</p>
              ) : (
                <div className="divide-y divide-border">
                  {xtreamServers.map((srv) => (
                    <div key={srv.id} className="p-4 hover:bg-surface/50 transition-colors">
                      {editingXtreamId === srv.id ? (
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
                          <input value={editXtreamForm.name} onChange={(e) => setEditXtreamForm({ ...editXtreamForm, name: e.target.value })} className={`${inputClass} border-emerald-400/30`} />
                          <input value={editXtreamForm.server_url} onChange={(e) => setEditXtreamForm({ ...editXtreamForm, server_url: e.target.value })} className={`${inputClass} font-mono border-emerald-400/30`} />
                          <input value={editXtreamForm.username} onChange={(e) => setEditXtreamForm({ ...editXtreamForm, username: e.target.value })} className={`${inputClass} border-emerald-400/30`} />
                          <input value={editXtreamForm.password} onChange={(e) => setEditXtreamForm({ ...editXtreamForm, password: e.target.value })} className={`${inputClass} border-emerald-400/30`} />
                          <div className="flex gap-2">
                            <button onClick={saveEditXtream} className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"><Save className="w-4 h-4" /></button>
                            <button onClick={() => setEditingXtreamId(null)} className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-display text-sm font-semibold text-foreground truncate">{srv.name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">XTREAM</span>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono truncate">{srv.server_url}</p>
                            <p className="text-xs text-muted-foreground truncate">Usuario: {srv.username}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => startEditXtream(srv)} className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => deleteXtream(srv.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* === TAB VISITANTES === */}
          <TabsContent value="visitors">
            <VisitorsTab />
      </TabsContent>
  </Tabs>
  </main>
  </header>
</div>
);
};

export default AdminPanel;

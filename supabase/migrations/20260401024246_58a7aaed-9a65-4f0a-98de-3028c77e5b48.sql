
CREATE TABLE public.m3u_playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  url TEXT NOT NULL
);

ALTER TABLE public.m3u_playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read m3u_playlists" ON public.m3u_playlists FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert m3u_playlists" ON public.m3u_playlists FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update m3u_playlists" ON public.m3u_playlists FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete m3u_playlists" ON public.m3u_playlists FOR DELETE TO public USING (true);

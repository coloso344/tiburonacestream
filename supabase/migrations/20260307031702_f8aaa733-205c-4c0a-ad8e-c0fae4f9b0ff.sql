
CREATE TABLE public.iptv_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  url text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  type text NOT NULL DEFAULT 'stream',
  logo_url text,
  group_name text
);

ALTER TABLE public.iptv_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read iptv_channels" ON public.iptv_channels FOR SELECT USING (true);
CREATE POLICY "Anyone can insert iptv_channels" ON public.iptv_channels FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update iptv_channels" ON public.iptv_channels FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete iptv_channels" ON public.iptv_channels FOR DELETE USING (true);

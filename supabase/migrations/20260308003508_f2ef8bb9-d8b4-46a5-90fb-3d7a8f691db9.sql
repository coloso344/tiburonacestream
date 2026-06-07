CREATE TABLE public.mac_portals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  portal_url TEXT NOT NULL,
  mac_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mac_portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read mac_portals" ON public.mac_portals FOR SELECT USING (true);
CREATE POLICY "Anyone can insert mac_portals" ON public.mac_portals FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update mac_portals" ON public.mac_portals FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete mac_portals" ON public.mac_portals FOR DELETE USING (true);
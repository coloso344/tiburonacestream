CREATE TABLE public.xtream_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  server_url TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.xtream_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to xtream_codes" ON public.xtream_codes FOR ALL USING (true) WITH CHECK (true);
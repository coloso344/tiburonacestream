CREATE TABLE public.access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  access_level text NOT NULL DEFAULT 'premium',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read access_codes" ON public.access_codes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert access_codes" ON public.access_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete access_codes" ON public.access_codes FOR DELETE USING (true);

-- Create streams table
CREATE TABLE public.streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  acestream_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read streams (visitor view needs this)
CREATE POLICY "Anyone can read streams" ON public.streams FOR SELECT USING (true);

-- Allow anyone to insert/update/delete (admin protected by app-level code)
CREATE POLICY "Anyone can insert streams" ON public.streams FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update streams" ON public.streams FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete streams" ON public.streams FOR DELETE USING (true);

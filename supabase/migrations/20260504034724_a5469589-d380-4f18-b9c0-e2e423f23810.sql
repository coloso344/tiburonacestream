ALTER TABLE public.m3u_playlists ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.m3u_playlists ALTER COLUMN url DROP NOT NULL;
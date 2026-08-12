-- Añade videos a la publicación supabase_realtime para que postgres_changes
-- emita los UPDATE de state (processing → published/deleted) que escucha
-- useVideoUploadStatus. Sin esto, el webhook de Cloudflare actualiza la fila
-- pero el cliente nunca recibe el evento y la UI se queda en "procesando".
--
-- RLS aplica también a Realtime: videos_select ya permite al creador ver su
-- propia fila en cualquier estado, así que el uploader recibe el evento.

ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;

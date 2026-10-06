-- Puntaje de a media estrella: 0.5, 1, 1.5 … 5. Las figuritas existentes (enteras) quedan igual.
-- Correr en el SQL Editor de Supabase ANTES de publicar la versión que manda medias estrellas.

alter table public.alfajores drop constraint if exists alfajores_rating_check;

alter table public.alfajores alter column rating type numeric(2, 1) using rating::numeric(2, 1);

alter table public.alfajores add constraint alfajores_rating_check
  check (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2));

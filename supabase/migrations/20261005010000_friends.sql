-- Amigos: seguir el álbum de otra persona a partir de su link (de un solo lado, sin solicitud).
-- Correr en el SQL Editor de Supabase ANTES de publicar la versión con la sección Amigos.

-- Nombre que ven los amigos ("Álbum de Tomás")
alter table public.albums add column if not exists display_name text
  check (char_length(display_name) between 1 and 30);

drop policy if exists "Editar mi álbum" on public.albums;
create policy "Editar mi álbum" on public.albums for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- Álbumes que sigue cada usuario, por su código de link
create table if not exists public.friends (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  share_code text not null references public.albums (share_code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, share_code)
);

alter table public.friends enable row level security;

drop policy if exists "Ver mis amigos" on public.friends;
create policy "Ver mis amigos" on public.friends for select to authenticated
  using ((select auth.uid()) = owner_id);
drop policy if exists "Agregar amigos" on public.friends;
create policy "Agregar amigos" on public.friends for insert to authenticated
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Quitar amigos" on public.friends;
create policy "Quitar amigos" on public.friends for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- Nombre del dueño de un álbum compartido (para el encabezado del link)
create or replace function public.shared_album_name(code text)
returns text
language sql stable security definer set search_path = '' as $$
  select display_name from public.albums where share_code = code;
$$;

revoke execute on function public.shared_album_name(text) from public;
grant execute on function public.shared_album_name(text) to anon, authenticated;

-- Resumen de los álbumes que sigue el usuario actual: lo necesario para mostrar nivel y última figurita
create or replace function public.friend_albums()
returns table (
  share_code text,
  display_name text,
  stickers int,
  brands int,
  comments int,
  own_photos int,
  last_thumb_path text,
  last_photo_style text,
  last_added timestamptz,
  followed_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select
    f.share_code,
    b.display_name,
    count(a.id)::int,
    count(distinct lower(trim(a.brand)))::int,
    count(a.id) filter (where trim(a.notes) <> '')::int,
    count(a.id) filter (where a.photo_credit is null)::int,
    (array_agg(a.thumb_path order by a.created_at desc))[1],
    (array_agg(a.photo_style order by a.created_at desc))[1],
    max(a.created_at),
    f.created_at
  from public.friends f
  join public.albums b on b.share_code = f.share_code
  left join public.alfajores a on a.owner_id = b.owner_id
  where f.owner_id = (select auth.uid())
  group by f.share_code, b.display_name, f.created_at
  order by max(a.created_at) desc nulls last;
$$;

revoke execute on function public.friend_albums() from public;
grant execute on function public.friend_albums() to authenticated;

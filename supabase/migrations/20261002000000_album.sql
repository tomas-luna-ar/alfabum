-- Alfabum: figuritas en la nube, álbum compartible por link.
-- Correr una vez en el SQL Editor de Supabase (o con `supabase db push`).

-- Figuritas: cada usuario (anónimo o con cuenta) tiene las suyas
create table public.alfajores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  number int not null,
  name text not null check (char_length(name) between 1 and 40),
  brand text not null check (char_length(brand) between 1 and 30),
  rating int not null check (rating between 1 and 5),
  notes text not null default '' check (char_length(notes) <= 280),
  photo_path text not null,
  thumb_path text not null,
  photo_style text not null default 'photo' check (photo_style in ('scan', 'photo')),
  created_at timestamptz not null default now(),
  unique (owner_id, number)
);

create index alfajores_owner_idx on public.alfajores (owner_id, number);

-- El número de figurita lo asigna la base: el siguiente al más alto del dueño
create function public.assign_alfajor_number() returns trigger
language plpgsql as $$
begin
  select coalesce(max(number), 0) + 1 into new.number from public.alfajores where owner_id = new.owner_id;
  return new;
end;
$$;

create trigger alfajores_number before insert on public.alfajores
  for each row execute function public.assign_alfajor_number();

alter table public.alfajores enable row level security;

create policy "Ver mis figuritas" on public.alfajores for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Pegar figuritas" on public.alfajores for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Editar mis figuritas" on public.alfajores for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Borrar mis figuritas" on public.alfajores for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- Álbum: guarda el código del link público de cada usuario
create table public.albums (
  owner_id uuid primary key default auth.uid() references auth.users on delete cascade,
  share_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_at timestamptz not null default now()
);

alter table public.albums enable row level security;

create policy "Ver mi álbum" on public.albums for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Crear mi álbum" on public.albums for insert to authenticated
  with check ((select auth.uid()) = owner_id);

-- Lectura pública por link: solo con el código se ven las figuritas de ese álbum (no se pueden listar las de todos)
create function public.shared_album(code text)
returns setof public.alfajores
language sql stable security definer set search_path = '' as $$
  select a.* from public.alfajores a
  join public.albums b on b.owner_id = a.owner_id
  where b.share_code = code
  order by a.number;
$$;

revoke execute on function public.shared_album(text) from public;
grant execute on function public.shared_album(text) to anon, authenticated;

-- Imágenes: bucket público (las rutas llevan IDs aleatorios); cada usuario solo escribe en su carpeta
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stickers', 'stickers', true, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Subir a mi carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'stickers' and (storage.foldername(name))[1] = (select auth.uid()::text));
-- Storage pide permiso de lectura además del de borrado para poder borrar
create policy "Ver mi carpeta" on storage.objects for select to authenticated
  using (bucket_id = 'stickers' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Borrar de mi carpeta" on storage.objects for delete to authenticated
  using (bucket_id = 'stickers' and (storage.foldername(name))[1] = (select auth.uid()::text));

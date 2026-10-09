-- Reacciones a figuritas de amigos, novedades (campanita) y notificaciones push.
-- Correr en el SQL Editor de Supabase ANTES de publicar la versión con reacciones.

-- Reacciones: una por persona por figurita (cambiar de emoji la reemplaza)
create table if not exists public.reactions (
  alfajor_id uuid not null references public.alfajores on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  emoji text not null check (emoji in ('😋', '🤤', '🔥', '😂', '🤢')),
  created_at timestamptz not null default now(),
  primary key (alfajor_id, user_id)
);

alter table public.reactions enable row level security;

drop policy if exists "Ver mis reacciones" on public.reactions;
create policy "Ver mis reacciones" on public.reactions for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Reaccionar" on public.reactions;
create policy "Reaccionar" on public.reactions for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Cambiar mi reacción" on public.reactions;
create policy "Cambiar mi reacción" on public.reactions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Sacar mi reacción" on public.reactions;
create policy "Sacar mi reacción" on public.reactions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Conteo de reacciones de cada figurita de un álbum (por su código) y cuál puso el usuario actual
create or replace function public.album_reactions(code text)
returns table (alfajor_id uuid, emoji text, total int, mine boolean)
language sql stable security definer set search_path = '' as $$
  select r.alfajor_id, r.emoji, count(*)::int, bool_or(r.user_id = (select auth.uid()))
  from public.reactions r
  join public.alfajores a on a.id = r.alfajor_id
  join public.albums b on b.owner_id = a.owner_id
  where b.share_code = code
  group by r.alfajor_id, r.emoji;
$$;

grant execute on function public.album_reactions(text) to anon, authenticated;

-- Novedades para la campanita: figuritas nuevas de los álbumes que sigo y reacciones a mis figuritas
create or replace function public.my_feed(lim int default 30)
returns table (
  kind text,
  share_code text,
  who text,
  emoji text,
  alfajor_name text,
  alfajor_brand text,
  thumb_path text,
  created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  (
    select 'sticker', b.share_code, b.display_name, null::text, a.name, a.brand, a.thumb_path, a.created_at
    from public.friends f
    join public.albums b on b.share_code = f.share_code
    join public.alfajores a on a.owner_id = b.owner_id
    where f.owner_id = (select auth.uid())
  )
  union all
  (
    select 'reaction', rb.share_code, rb.display_name, r.emoji, a.name, a.brand, a.thumb_path, r.created_at
    from public.reactions r
    join public.alfajores a on a.id = r.alfajor_id
    left join public.albums rb on rb.owner_id = r.user_id
    where a.owner_id = (select auth.uid()) and r.user_id <> (select auth.uid())
  )
  order by created_at desc
  limit lim;
$$;

grant execute on function public.my_feed(int) to authenticated;

-- Suscripciones push de cada celu/navegador
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Ver mis suscripciones" on public.push_subscriptions;
create policy "Ver mis suscripciones" on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Suscribirme" on public.push_subscriptions;
create policy "Suscribirme" on public.push_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Actualizar mi suscripción" on public.push_subscriptions;
create policy "Actualizar mi suscripción" on public.push_subscriptions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Desuscribirme" on public.push_subscriptions;
create policy "Desuscribirme" on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Cada figurita avisa a los amigos una sola vez
alter table public.alfajores add column if not exists notified_at timestamptz;

-- A quién avisar de una figurita nueva: solo el dueño puede pedirlo, una vez, y solo si es reciente.
-- Devuelve las suscripciones push de quienes siguen su álbum y marca la figurita como avisada.
create or replace function public.claim_new_sticker_push(sticker uuid)
returns table (endpoint text, p256dh text, auth_key text, who text, alfajor_name text, alfajor_brand text, share_code text)
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  a public.alfajores;
begin
  update public.alfajores
    set notified_at = now()
    where id = sticker
      and owner_id = (select auth.uid())
      and notified_at is null
      and created_at > now() - interval '15 minutes'
    returning * into a;
  if not found then
    return;
  end if;

  return query
    select s.endpoint, s.p256dh, s.auth as auth_key, b.display_name, a.name, a.brand, b.share_code
    from public.albums b
    join public.friends f on f.share_code = b.share_code
    join public.push_subscriptions s on s.user_id = f.owner_id
    where b.owner_id = a.owner_id and f.owner_id <> a.owner_id;
end;
$$;

grant execute on function public.claim_new_sticker_push(uuid) to authenticated;

-- Las suscripciones vencidas (el navegador las dio de baja) se borran al fallar un envío
create or replace function public.forget_push_subscription(dead_endpoint text)
returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = dead_endpoint;
$$;

grant execute on function public.forget_push_subscription(text) to authenticated;

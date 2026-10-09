"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BlobImage } from "@/components/BlobImage";
import { markFeedSeen, readFeedSeenAt } from "@/lib/feed";
import { progressOf } from "@/lib/gamification";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";
import { getFeed, getFriends, type FeedItem, type FriendAlbum } from "@/lib/repository";
import { useImageBlob } from "@/lib/useImageBlob";

const relative = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

/** "hoy", "ayer", "hace 3 días", "hace 2 meses". */
function ago(timestamp: number) {
  const days = Math.round((timestamp - Date.now()) / 86_400_000);
  if (days > -30) return relative.format(days, "day");
  if (days > -365) return relative.format(Math.round(days / 30), "month");
  return relative.format(Math.round(days / 365), "year");
}

/** Álbumes de amigos que el usuario sigue (los agrega desde el link de cada uno). */
export default function AmigosPage() {
  const [friends, setFriends] = useState<FriendAlbum[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFriends().then(
      (list) => !cancelled && setFriends(list),
      (err) => {
        console.error("No se pudieron cargar los amigos", err);
        if (!cancelled) setError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-md px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/" className="rounded-full bg-amber-900/10 px-3 py-1.5 text-amber-900" aria-label="Volver al álbum">
          ←
        </Link>
        <h1 className="font-display text-2xl text-amber-900">Amigos</h1>
      </header>

      <NotificationsToggle />
      <Feed />

      <h2 className="font-display mb-3 text-xl text-amber-900">Álbumes que seguís</h2>

      {error ? (
        <p className="py-10 text-center text-amber-900/60">No pudimos cargar tus amigos. Probá de nuevo más tarde.</p>
      ) : friends === null ? (
        <p className="py-10 text-center text-amber-900/60">Cargando…</p>
      ) : friends.length === 0 ? (
        <div className="rounded-xl bg-white/80 p-4 text-sm text-stone-700 shadow-sm">
          <p className="mb-2 font-semibold text-amber-900">Todavía no seguís a nadie</p>
          <p>
            Pedile a un amigo que toque <strong>Compartir</strong> en su álbum y te mande el link. Abrilo y tocá{" "}
            <strong>“Agregar a mis amigos”</strong>: va a aparecer acá.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {friends.map((friend) => (
            <li key={friend.shareCode}>
              <FriendCard friend={friend} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function FriendCard({ friend }: { friend: FriendAlbum }) {
  const { level, levelIndex } = progressOf(friend.breakdown);
  const thumb = useImageBlob(friend.lastThumbUrl);
  const count = friend.breakdown.stickers;

  return (
    <Link
      href={`/a/${friend.shareCode}`}
      className="flex items-center gap-3 rounded-xl bg-white/80 p-3 shadow-sm transition-transform active:scale-[0.98]"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-amber-900/10">
        {thumb ? (
          <BlobImage blob={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-2xl">{level.emoji}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display truncate text-lg leading-tight text-amber-900">
          {friend.displayName ?? "Álbum sin nombre"}
        </p>
        <p className="truncate text-xs text-amber-900/80">
          {level.emoji} Nivel {levelIndex + 1} · {level.name}
        </p>
        <p className="truncate text-xs text-stone-500">
          {count} {count === 1 ? "figurita" : "figuritas"}
          {friend.lastAdded && ` · última ${ago(friend.lastAdded)}`}
        </p>
      </div>
      <span className="text-amber-900/40">›</span>
    </Link>
  );
}

/** Novedades: figuritas nuevas de amigos y reacciones a las tuyas. Al abrir la pantalla quedan como leídas. */
function Feed() {
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [seenAt] = useState(readFeedSeenAt);

  useEffect(() => {
    let cancelled = false;
    getFeed().then(
      (items) => {
        if (cancelled) return;
        setFeed(items);
        markFeedSeen();
      },
      (err) => console.error("No se pudieron cargar las novedades", err),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (!feed || feed.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="font-display mb-3 text-xl text-amber-900">Novedades</h2>
      <ul className="divide-y divide-amber-900/10 overflow-hidden rounded-xl bg-white/80 shadow-sm">
        {feed.map((item, i) => (
          <li key={i}>
            <FeedRow item={item} unread={item.createdAt > seenAt} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeedRow({ item, unread }: { item: FeedItem; unread: boolean }) {
  const thumb = useImageBlob(item.thumbUrl);
  const who = item.who ?? (item.kind === "sticker" ? "Un amigo" : "Alguien");
  const alfajor = `${item.alfajorBrand} · ${item.alfajorName}`;
  const content = (
    <div className={`flex items-center gap-3 p-3 ${unread ? "bg-amber-100/70" : ""}`}>
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-amber-900/10">
        {thumb && <BlobImage blob={thumb} alt="" className="h-full w-full object-cover" />}
      </div>
      <p className="min-w-0 flex-1 text-sm text-stone-700">
        <strong className="text-amber-900">{who}</strong>{" "}
        {item.kind === "sticker" ? (
          <>pegó {alfajor}</>
        ) : (
          <>
            reaccionó {item.emoji} a tu {alfajor}
          </>
        )}
        <span className="block text-xs text-stone-400">{ago(item.createdAt)}</span>
      </p>
      {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" aria-label="Nuevo" />}
    </div>
  );
  return item.shareCode ? <Link href={`/a/${item.shareCode}`}>{content}</Link> : content;
}

/** Activar o desactivar las notificaciones push en este celu. */
function NotificationsToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setState, () => setState("unsupported"));
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      setState(state === "on" ? await disablePush() : await enablePush());
    } catch (err) {
      console.error("No se pudieron cambiar las notificaciones", err);
    } finally {
      setBusy(false);
    }
  }

  if (!state || state === "unsupported") return null;

  return (
    <div className="mb-6 rounded-xl bg-white/80 p-3 text-sm text-stone-700 shadow-sm">
      {state === "needs-install" ? (
        <p>
          🔔 Para que te avisemos cuando un amigo pega un alfajor, primero agregá Alfabum a tu pantalla de inicio
          (Compartir → “Agregar a inicio”) y abrila desde el ícono.
        </p>
      ) : state === "denied" ? (
        <p>🔕 Bloqueaste las notificaciones. Para recibirlas, habilitalas para Alfabum en los ajustes del celu.</p>
      ) : (
        <div className="flex items-center gap-3">
          <p className="flex-1">
            {state === "on"
              ? "🔔 Te avisamos cuando un amigo pega un alfajor nuevo."
              : "🔔 ¿Querés que te avisemos cuando un amigo pegue un alfajor?"}
          </p>
          <button
            onClick={toggle}
            disabled={busy}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
              state === "on" ? "bg-amber-900/10 text-amber-900" : "bg-amber-900 text-amber-50"
            }`}
          >
            {state === "on" ? "Desactivar" : "Activar"}
          </button>
        </div>
      )}
    </div>
  );
}

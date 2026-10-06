"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BlobImage } from "@/components/BlobImage";
import { progressOf } from "@/lib/gamification";
import { getFriends, type FriendAlbum } from "@/lib/repository";
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
        <h1 className="font-display text-2xl text-amber-900">Álbumes de amigos</h1>
      </header>

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

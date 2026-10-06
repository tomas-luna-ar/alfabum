"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlbumBook } from "@/components/AlbumBook";
import { FlipSticker } from "@/components/FlipSticker";
import { LevelCard } from "@/components/LevelCard";
import { EmptySlot } from "@/components/Sticker";
import { addFriend, getFollowStatus, getSharedAlbum, getSharedAlbumName, removeFriend } from "@/lib/repository";
import type { Alfajor } from "@/lib/types";

const PAGE_SIZE = 6;

/** Álbum de otra persona, abierto desde su link: solo para mirar. */
export default function SharedAlbumPage() {
  const { code } = useParams<{ code: string }>();
  const [alfajores, setAlfajores] = useState<Alfajor[] | null>(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [name, setName] = useState<string | null>(null);
  const [follow, setFollow] = useState<"own" | "friend" | "none" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSharedAlbum(code).then(
      (list) => !cancelled && setAlfajores(list),
      (err) => {
        console.error("No se pudo abrir el álbum compartido", err);
        if (!cancelled) setError(true);
      },
    );
    getSharedAlbumName(code).then(
      (n) => !cancelled && setName(n),
      () => {},
    );
    getFollowStatus(code).then(
      (status) => !cancelled && setFollow(status),
      (err) => console.error("No se pudo ver si ya lo seguís", err),
    );
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function toggleFollow() {
    setBusy(true);
    try {
      if (follow === "friend") {
        await removeFriend(code);
        setFollow("none");
      } else {
        await addFriend(code);
        setFollow("friend");
      }
    } catch (err) {
      console.error("No se pudo actualizar tus amigos", err);
    } finally {
      setBusy(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil((alfajores?.length ?? 0) / PAGE_SIZE));
  const average = alfajores?.length ? alfajores.reduce((sum, a) => sum + a.rating, 0) / alfajores.length : 0;

  function renderPage(index: number) {
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: PAGE_SIZE }, (_, i) => {
          const alfajor = alfajores?.at(index * PAGE_SIZE + i);
          // Los lugares sin figurita solo ocupan espacio, para que todas las hojas midan lo mismo
          return (
            <li key={alfajor?.id ?? `empty-${i}`} className={alfajor ? "" : "invisible"} aria-hidden={!alfajor}>
              {alfajor ? <FlipSticker alfajor={alfajor} /> : <EmptySlot number={0} />}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <main className="mx-auto max-w-3xl overflow-x-clip px-4 pb-28 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="mb-5">
        <h1 className="font-display flex items-center gap-2 text-4xl text-amber-900">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG local */}
          <img src="/icon.svg" alt="" className="-ml-1 h-11 w-11" />
          Alfabum
        </h1>
        <p className="text-sm text-amber-900/70">
          {name ? (
            <>
              Álbum de <strong>{name}</strong>
            </>
          ) : (
            "Un álbum de alfajores compartido con vos"
          )}
        </p>
        {follow === "own" ? (
          <p className="mt-3 text-sm text-amber-900/70">Este es tu álbum, así lo ven tus amigos.</p>
        ) : (
          follow !== null &&
          alfajores !== null &&
          !error && (
            <button
              onClick={toggleFollow}
              disabled={busy}
              className={`mt-3 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                follow === "friend" ? "bg-amber-900/10 text-amber-900" : "bg-amber-900 text-amber-50"
              }`}
            >
              {follow === "friend" ? "✓ En tus amigos · Dejar de seguir" : "＋ Agregar a mis amigos"}
            </button>
          )
        )}
      </header>

      {error ? (
        <p className="py-20 text-center text-amber-900/60">No pudimos abrir este álbum. Revisá el link o probá más tarde.</p>
      ) : alfajores === null ? (
        <p className="py-20 text-center text-amber-900/60">Abriendo el álbum…</p>
      ) : alfajores.length === 0 ? (
        <p className="py-20 text-center text-amber-900/60">Este álbum todavía no tiene figuritas (o el link no existe).</p>
      ) : (
        <>
          <LevelCard alfajores={alfajores} />
          <p className="mb-4 text-sm text-amber-900/80">
            {alfajores.length} {alfajores.length === 1 ? "figurita" : "figuritas"} · promedio {average.toFixed(1)}★
          </p>
          <AlbumBook pageCount={pageCount} page={Math.min(page, pageCount - 1)} onPageChange={setPage} renderPage={renderPage} />
        </>
      )}

      <Link
        href="/"
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-amber-900 px-6 py-3.5 font-semibold text-amber-50 shadow-lg shadow-amber-900/30 transition-transform active:scale-95"
      >
        Armá tu propio álbum
      </Link>
    </main>
  );
}

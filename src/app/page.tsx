"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlbumBook } from "@/components/AlbumBook";
import { FlipSticker } from "@/components/FlipSticker";
import { InstallPrompt } from "@/components/InstallPrompt";
import { LevelCard } from "@/components/LevelCard";
import { EmptySlot } from "@/components/Sticker";
import { useAlfajores, useUser } from "@/lib/hooks";
import { readFeedSeenAt } from "@/lib/feed";
import { getAlbumReactions, getFeed, getMyAlbum, getShareCode, type StickerReactions } from "@/lib/repository";
import type { Alfajor } from "@/lib/types";

type SortKey = "number" | "rating" | "recent";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "number", label: "Nº" },
  { key: "rating", label: "Puntaje" },
  { key: "recent", label: "Recientes" },
];

/** Cantidad de figuritas por página del álbum: siempre se completa hasta un múltiplo con espacios vacíos. */
const PAGE_SIZE = 6;
/** Página abierta, para volver a la misma después de ver una figurita. */
const PAGE_KEY = "album-page";

function readStoredPage() {
  try {
    return Number(sessionStorage.getItem(PAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function sortAlfajores(list: Alfajor[], key: SortKey) {
  const sorted = [...list];
  if (key === "number") sorted.sort((a, b) => a.number - b.number);
  if (key === "rating") sorted.sort((a, b) => b.rating - a.rating || a.number - b.number);
  if (key === "recent") sorted.sort((a, b) => b.createdAt - a.createdAt);
  return sorted;
}

export default function AlbumPage() {
  const { alfajores, error } = useAlfajores();
  const [reactions, setReactions] = useState<Map<string, StickerReactions>>(new Map());
  const [unread, setUnread] = useState(0);

  // Reacciones que recibieron mis figuritas y novedades sin leer de amigos (el globito de 👥)
  useEffect(() => {
    let cancelled = false;
    getMyAlbum()
      .then((album) => getAlbumReactions(album.shareCode))
      .then(
        (r) => !cancelled && setReactions(r),
        (err) => console.error("No se pudieron cargar las reacciones", err),
      );
    getFeed().then(
      (feed) => {
        const seenAt = readFeedSeenAt();
        if (!cancelled) setUnread(feed.filter((item) => item.createdAt > seenAt).length);
      },
      (err) => console.error("No se pudieron cargar las novedades", err),
    );
    return () => {
      cancelled = true;
    };
  }, []);
  const [sort, setSort] = useState<SortKey>("number");
  // Solo se lee en el cliente; el álbum no se pinta hasta cargar las figuritas, así que no afecta la hidratación
  const [page, setPage] = useState(readStoredPage);

  function changePage(next: number) {
    setPage(next);
    try {
      sessionStorage.setItem(PAGE_KEY, String(next));
    } catch {}
  }

  function changeSort(next: SortKey) {
    setSort(next);
    changePage(0);
  }

  const sorted = useMemo(() => (alfajores ? sortAlfajores(alfajores, sort) : []), [alfajores, sort]);
  const average = alfajores?.length
    ? alfajores.reduce((sum, a) => sum + a.rating, 0) / alfajores.length
    : 0;
  const nextNumber = (alfajores?.reduce((max, a) => Math.max(max, a.number), 0) ?? 0) + 1;
  const emptySlots = sort === "number" ? PAGE_SIZE - (sorted.length % PAGE_SIZE) : 0;
  const pageCount = Math.max(1, Math.ceil((sorted.length + emptySlots) / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);

  function renderPage(index: number) {
    const slots = Array.from({ length: PAGE_SIZE }, (_, i) => index * PAGE_SIZE + i);
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {slots.map((slot) => {
          const alfajor = sorted.at(slot);
          if (alfajor) {
            return (
              <li key={alfajor.id} className="sticker-pop">
                <AlbumSticker alfajor={alfajor} reactions={reactions.get(alfajor.id)} />
              </li>
            );
          }
          // Los espacios después del último lugar libre solo ocupan lugar, para que todas las hojas midan lo mismo
          const empty = slot - sorted.length;
          return (
            <li key={`empty-${slot}`} className={empty < emptySlots ? "" : "invisible"} aria-hidden={empty >= emptySlots}>
              <EmptySlot number={nextNumber + empty} />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <main className="mx-auto max-w-3xl overflow-x-clip px-4 pb-28 pt-[max(1.5rem,env(safe-area-inset-top))]">
      {/* Si en un celu muy angosto no entran título y botones, los botones bajan en vez de pisar el título */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className="font-display flex items-center gap-2 text-3xl text-amber-900 sm:text-4xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG local */}
            <img src="/icon.svg" alt="" className="-ml-1 h-9 w-9 shrink-0 sm:h-11 sm:w-11" />
            Alfabum
          </h1>
          <p className="text-sm text-amber-900/70">Mi álbum de alfajores</p>
        </div>
        <div className="ml-auto flex shrink-0 gap-2">
          {alfajores && alfajores.length > 0 && <ShareButton />}
          <Link
            href="/amigos"
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-amber-900/10 text-amber-900"
            aria-label={unread ? `Amigos: ${unread} novedades` : "Álbumes de amigos"}
          >
            👥
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[0.65rem] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <Link
            href="/cuenta"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-900/10 text-amber-900"
            aria-label="Tu cuenta"
          >
            👤
          </Link>
        </div>
      </header>

      <InstallPrompt />

      {alfajores && <LevelCard alfajores={alfajores} celebrate />}

      {alfajores && alfajores.length > 0 && (
        <section className="mb-5 grid grid-cols-3 gap-2 text-center">
          <Stat label="Figuritas" value={String(alfajores.length)} />
          <Stat label="Promedio" value={`${average.toFixed(1)}★`} />
          <Stat label="Marcas" value={String(new Set(alfajores.map((a) => a.brand.trim().toLowerCase())).size)} />
        </section>
      )}

      {alfajores && alfajores.length > 1 && (
        <div className="mb-4 flex gap-2" role="tablist" aria-label="Ordenar">
          {SORTS.map((s) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={sort === s.key}
              onClick={() => changeSort(s.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                sort === s.key ? "bg-amber-900 text-amber-50" : "bg-amber-900/10 text-amber-900"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <p className="py-20 text-center text-amber-900/60">No pudimos abrir el álbum. Revisá tu conexión y recargá la página.</p>
      ) : alfajores === null ? (
        <p className="py-20 text-center text-amber-900/60">Abriendo el álbum…</p>
      ) : (
        <>
          {alfajores.length === 0 && (
            <p className="mb-4 rounded-xl bg-white/70 p-4 text-center text-sm text-amber-900/80">
              Tu álbum está vacío. Sacale una foto al paquete del próximo alfajor que te comas y pegá tu primera figurita.
            </p>
          )}
          <AlbumBook pageCount={pageCount} page={currentPage} onPageChange={changePage} renderPage={renderPage} />
        </>
      )}

      <Link
        href="/nuevo"
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-900 px-6 py-3.5 font-semibold text-amber-50 shadow-lg shadow-amber-900/30 transition-transform active:scale-95"
      >
        <span className="text-xl leading-none">📷</span> Sumar figurita
      </Link>
    </main>
  );
}

/** Comparte el link público del álbum (menú nativo del celu, o copia el link). */
function ShareButton() {
  const user = useUser();
  const [status, setStatus] = useState<{ text: string; url?: string } | null>(null);

  async function share() {
    try {
      const url = `${location.origin}/a/${await getShareCode()}`;
      if (navigator.share) {
        await navigator.share({ title: "Mi álbum de alfajores", text: "Mirá mi álbum de alfajores en Alfabum", url });
        setStatus({ text: "¡Listo!" });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setStatus({ text: "Link copiado" });
      } else {
        // Sin menú de compartir ni portapapeles (por ejemplo, en http): mostramos el link para copiarlo a mano
        setStatus({ text: "Tu link:", url });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // cerró el menú de compartir
      console.error("No se pudo compartir", err);
      setStatus({ text: "No pudimos generar el link. Probá de nuevo." });
    }
  }

  return (
    <div className="relative">
      <button
        onClick={share}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-900 text-amber-50"
        aria-label="Compartir mi álbum"
        title="Compartir mi álbum"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M12 3v12M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" strokeLinecap="round" />
        </svg>
      </button>
      {status && (
        <div className="absolute right-0 top-full z-10 mt-2 w-64 rounded-xl bg-white p-3 pr-8 text-xs text-stone-700 shadow-lg">
          <button
            onClick={() => setStatus(null)}
            className="absolute right-2 top-1.5 text-base text-stone-400"
            aria-label="Cerrar"
          >
            ×
          </button>
          <p className="mb-1 font-medium text-amber-900">
            {status.text} {status.url && <span className="select-all break-all font-normal">{status.url}</span>}
          </p>
          {user?.is_anonymous && (
            <p>
              Tu álbum todavía es anónimo.{" "}
              <Link href="/cuenta" className="font-medium text-amber-800 underline underline-offset-2">
                Guardalo
              </Link>{" "}
              para no perderlo si cambiás de celu.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/80 px-2 py-3 shadow-sm">
      <p className="font-display text-2xl leading-none text-amber-900">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-amber-900/60">{label}</p>
    </div>
  );
}

function AlbumSticker({ alfajor, reactions }: { alfajor: Alfajor; reactions?: StickerReactions }) {
  return <FlipSticker alfajor={alfajor} href={`/alfajor/${alfajor.id}`} reactions={reactions} />;
}

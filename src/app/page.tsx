"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptySlot, Sticker } from "@/components/Sticker";
import { useAlfajores } from "@/lib/hooks";
import type { Alfajor } from "@/lib/types";

type SortKey = "number" | "rating" | "recent";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "number", label: "Nº" },
  { key: "rating", label: "Puntaje" },
  { key: "recent", label: "Recientes" },
];

/** Cantidad de figuritas por "página" del álbum: siempre se completa hasta un múltiplo con espacios vacíos. */
const PAGE_SIZE = 6;

function sortAlfajores(list: Alfajor[], key: SortKey) {
  const sorted = [...list];
  if (key === "number") sorted.sort((a, b) => a.number - b.number);
  if (key === "rating") sorted.sort((a, b) => b.rating - a.rating || a.number - b.number);
  if (key === "recent") sorted.sort((a, b) => b.createdAt - a.createdAt);
  return sorted;
}

export default function AlbumPage() {
  const { alfajores } = useAlfajores();
  const [sort, setSort] = useState<SortKey>("number");

  const sorted = useMemo(() => (alfajores ? sortAlfajores(alfajores, sort) : []), [alfajores, sort]);
  const average = alfajores?.length
    ? alfajores.reduce((sum, a) => sum + a.rating, 0) / alfajores.length
    : 0;
  const nextNumber = (alfajores?.reduce((max, a) => Math.max(max, a.number), 0) ?? 0) + 1;
  const emptySlots = sort === "number" ? PAGE_SIZE - (sorted.length % PAGE_SIZE) : 0;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="mb-5">
        <h1 className="font-display text-4xl text-amber-900">Alfabum</h1>
        <p className="text-sm text-amber-900/70">Mi álbum de alfajores</p>
      </header>

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
              onClick={() => setSort(s.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                sort === s.key ? "bg-amber-900 text-amber-50" : "bg-amber-900/10 text-amber-900"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {alfajores === null ? (
        <p className="py-20 text-center text-amber-900/60">Abriendo el álbum…</p>
      ) : (
        <>
          {alfajores.length === 0 && (
            <p className="mb-4 rounded-xl bg-white/70 p-4 text-center text-sm text-amber-900/80">
              Tu álbum está vacío. Sacale una foto al paquete del próximo alfajor que te comas y pegá tu primera figurita.
            </p>
          )}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sorted.map((a) => (
              <li key={a.id} className="sticker-pop">
                <AlbumSticker alfajor={a} />
              </li>
            ))}
            {Array.from({ length: emptySlots }, (_, i) => (
              <li key={`empty-${i}`}>
                <EmptySlot number={nextNumber + i} />
              </li>
            ))}
          </ul>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/80 px-2 py-3 shadow-sm">
      <p className="font-display text-2xl leading-none text-amber-900">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-amber-900/60">{label}</p>
    </div>
  );
}

function AlbumSticker({ alfajor }: { alfajor: Alfajor }) {
  return (
    <Link href={`/alfajor/${alfajor.id}`} className="block transition-transform active:scale-95">
      <Sticker number={alfajor.number} name={alfajor.name} brand={alfajor.brand} rating={alfajor.rating} photo={alfajor.photo} />
    </Link>
  );
}

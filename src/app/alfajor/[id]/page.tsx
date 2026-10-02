"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AlfajorFields, type AlfajorFormValues } from "@/components/AlfajorForm";
import { StarRating } from "@/components/StarRating";
import { Sticker } from "@/components/Sticker";
import { useAlfajor } from "@/lib/hooks";
import { repository } from "@/lib/repository";

export default function AlfajorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { alfajor, setAlfajor } = useAlfajor(id);
  const [editing, setEditing] = useState<AlfajorFormValues | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (alfajor === undefined) {
    return <p className="py-20 text-center text-amber-900/60">Buscando figurita…</p>;
  }

  if (alfajor === null) {
    return (
      <main className="px-4 py-20 text-center">
        <p className="mb-4 text-amber-900/70">Esta figurita no está en tu álbum.</p>
        <Link href="/" className="font-medium text-amber-800 underline underline-offset-4">
          Volver al álbum
        </Link>
      </main>
    );
  }

  const shown = editing ?? alfajor;

  async function save() {
    if (!editing || !editing.name.trim() || !editing.brand.trim()) return;
    const updated = await repository.update(id, {
      name: editing.name.trim(),
      brand: editing.brand.trim(),
      rating: editing.rating,
      notes: editing.notes.trim(),
    });
    setAlfajor(updated);
    setEditing(null);
  }

  async function remove() {
    await repository.remove(id);
    router.push("/");
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/" className="rounded-full bg-amber-900/10 px-3 py-1.5 text-amber-900" aria-label="Volver al álbum">
          ←
        </Link>
        <h1 className="font-display truncate text-2xl text-amber-900">{alfajor.name}</h1>
      </header>

      <div className="mx-auto mb-6 w-3/4">
        <Sticker
          number={alfajor.number}
          name={shown.name}
          brand={shown.brand}
          rating={shown.rating}
          photo={alfajor.photoUrl}
          photoStyle={alfajor.photoStyle}
          size="lg"
        />
      </div>

      {editing ? (
        <div className="space-y-6">
          <AlfajorFields values={editing} onChange={setEditing} />
          <div className="flex gap-3">
            <button
              onClick={() => setEditing(null)}
              className="flex-1 rounded-full bg-amber-900/10 py-3 font-semibold text-amber-900"
            >
              Cancelar
            </button>
            <button onClick={save} className="flex-1 rounded-full bg-amber-900 py-3 font-semibold text-amber-50">
              Guardar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-xl bg-white/80 p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm uppercase tracking-wider text-amber-900/60">{alfajor.brand}</span>
              <StarRating value={alfajor.rating} />
            </div>
            {alfajor.notes ? (
              <p className="whitespace-pre-wrap text-stone-800">{alfajor.notes}</p>
            ) : (
              <p className="text-sm italic text-stone-400">Sin notas</p>
            )}
            <p className="mt-3 text-xs text-stone-400">
              Pegada el {new Date(alfajor.createdAt).toLocaleDateString("es-AR", { dateStyle: "long" })}
            </p>
            {alfajor.photoCredit && (
              <p className="mt-1 text-xs text-stone-400">
                {alfajor.photoCredit} ·{" "}
                <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer" className="underline">
                  openfoodfacts.org
                </a>
              </p>
            )}
          </section>

          <button
            onClick={() =>
              setEditing({ name: alfajor.name, brand: alfajor.brand, rating: alfajor.rating, notes: alfajor.notes })
            }
            className="w-full rounded-full bg-amber-900 py-3 font-semibold text-amber-50"
          >
            Editar
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3">
              <span className="flex-1 text-sm text-red-800">¿Despegar esta figurita?</span>
              <button onClick={() => setConfirmDelete(false)} className="rounded-full px-3 py-1.5 text-sm text-stone-600">
                No
              </button>
              <button onClick={remove} className="rounded-full bg-red-700 px-4 py-1.5 text-sm font-semibold text-white">
                Sí, borrar
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="w-full py-2 text-sm text-red-700">
              Borrar figurita
            </button>
          )}
        </div>
      )}
    </main>
  );
}

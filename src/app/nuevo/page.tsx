"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AlfajorFields, type AlfajorFormValues } from "@/components/AlfajorForm";
import { Sticker } from "@/components/Sticker";
import { useAlfajores } from "@/lib/hooks";
import { toStickerPhoto } from "@/lib/image";
import { repository } from "@/lib/repository";

export default function NuevoPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const { alfajores } = useAlfajores();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [values, setValues] = useState<AlfajorFormValues>({ name: "", brand: "", rating: 0, notes: "" });
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brands = [...new Set(alfajores?.map((a) => a.brand) ?? [])].sort();
  const canSave = photo && values.name.trim() && values.brand.trim() && values.rating > 0 && !saving;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setProcessing(true);
    try {
      setPhoto(await toStickerPhoto(file));
    } catch {
      setError("No pudimos leer esa imagen. Probá con otra foto.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await repository.create({
        name: values.name.trim(),
        brand: values.brand.trim(),
        rating: values.rating,
        notes: values.notes.trim(),
        photo,
      });
      router.push("/");
    } catch {
      setError("No se pudo guardar la figurita. Intentá de nuevo.");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/" className="rounded-full bg-amber-900/10 px-3 py-1.5 text-amber-900" aria-label="Volver al álbum">
          ←
        </Link>
        <h1 className="font-display text-2xl text-amber-900">Nueva figurita</h1>
      </header>

      <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />

      <div className="mx-auto mb-2 w-2/3">
        <button type="button" onClick={() => fileInput.current?.click()} className="block w-full" disabled={processing}>
          <Sticker
            name={values.name}
            brand={values.brand}
            rating={values.rating}
            photo={photo}
            size="lg"
          />
        </button>
      </div>
      <div className="mb-6 text-center">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={processing}
          className="text-sm font-medium text-amber-800 underline underline-offset-4"
        >
          {processing ? "Procesando foto…" : photo ? "Cambiar foto" : "Sacar foto del paquete"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <AlfajorFields values={values} onChange={setValues} brandSuggestions={brands} />

        {error && <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p>}

        <button
          type="submit"
          disabled={!canSave}
          className="w-full rounded-full bg-amber-900 py-3.5 font-semibold text-amber-50 shadow-lg shadow-amber-900/20 transition disabled:bg-amber-900/30 disabled:shadow-none"
        >
          {saving ? "Pegando…" : "Pegar en el álbum"}
        </button>
        {!photo && <p className="-mt-3 text-center text-xs text-amber-900/60">Necesitás una foto para crear la figurita.</p>}
      </form>
    </main>
  );
}

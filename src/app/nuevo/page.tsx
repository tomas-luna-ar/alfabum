"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlfajorFields, type AlfajorFormValues } from "@/components/AlfajorForm";
import { CatalogSearch } from "@/components/CatalogSearch";
import { CornerEditor } from "@/components/CornerEditor";
import { Sticker } from "@/components/Sticker";
import { useAlfajores } from "@/lib/hooks";
import { rotateClockwise, type Quad } from "@/lib/geometry";
import { preloadModel, processPhoto, scanWithCorners, type ProcessedPhoto, type ProcessStage } from "@/lib/image";
import { notifyNewSticker } from "@/app/actions/notify";
import { repository } from "@/lib/repository";
import { supabase } from "@/lib/supabase";
import type { CatalogItem, PhotoStyle } from "@/lib/types";

/** Crédito obligatorio de las fotos del catálogo (licencia CC BY-SA). */
const CATALOG_CREDIT = "Foto: Open Food Facts (CC BY-SA)";

function stageLabel(stage: ProcessStage) {
  if (stage.kind === "cutting") return "Enderezando el paquete…";
  // Al 100% el modelo ya bajó pero todavía se está inicializando: no mostramos un porcentaje "trabado"
  return stage.percent === undefined || stage.percent >= 100
    ? "Preparando recortador…"
    : `Preparando recortador… ${stage.percent}%`;
}

export default function NuevoPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const { alfajores } = useAlfajores();
  const [source, setSource] = useState<File | null>(null);
  const [processed, setProcessed] = useState<ProcessedPhoto | null>(null);
  const [editingCorners, setEditingCorners] = useState(false);
  const [style, setStyle] = useState<PhotoStyle>("scan");
  const [photoCredit, setPhotoCredit] = useState<string | null>(null);
  const [values, setValues] = useState<AlfajorFormValues>({ name: "", brand: "", rating: 0, notes: "" });
  const [stage, setStage] = useState<ProcessStage | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Empezamos a descargar el modelo apenas se abre la pantalla, así está listo para cuando saquen la foto
  useEffect(() => {
    preloadModel().catch(() => {});
  }, []);

  const brands = [...new Set(alfajores?.map((a) => a.brand) ?? [])].sort();
  const processing = stage !== null;
  const photoStyle: PhotoStyle = processed?.scan ? style : "photo";
  const photo = processed ? (photoStyle === "scan" ? processed.scan : processed.photo) : null;
  const canSave = photo && !processing && values.name.trim() && values.brand.trim() && values.rating > 0 && !saving;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await loadPhoto(file, null);
  }

  /** Elegir del catálogo completa marca y descripción, y usa su foto como si la hubieran sacado. */
  async function pickFromCatalog(item: CatalogItem) {
    setValues((v) => ({ ...v, brand: item.brand, name: item.name }));
    setError(null);
    setStage({ kind: "preparing" });
    try {
      const res = await fetch(item.imageUrl, { mode: "cors" });
      if (!res.ok) throw new Error(`Foto del catálogo: ${res.status}`);
      const file = new File([await res.blob()], `${item.code}.jpg`, { type: "image/jpeg" });
      await loadPhoto(file, CATALOG_CREDIT);
    } catch (err) {
      console.error(err);
      setStage(null);
      setError("No pudimos bajar la foto de ese alfajor. Probá sacándole una foto.");
    }
  }

  async function loadPhoto(file: File, credit: string | null) {
    setError(null);
    setStage({ kind: "preparing" });
    try {
      const result = await processPhoto(file, setStage);
      setSource(file);
      setProcessed(result);
      setPhotoCredit(credit);
      setStyle("scan");
      if (!result.scan) {
        setError("No pudimos encontrar el paquete en esta foto. Podés marcarlo con “Ajustar esquinas” o usar la original.");
      }
    } catch {
      setError("No pudimos leer esa imagen. Probá con otra foto.");
    } finally {
      setStage(null);
    }
  }

  async function applyCorners(corners: Quad) {
    if (!source || !processed) return;
    setEditingCorners(false);
    setStage({ kind: "cutting" });
    try {
      const scan = await scanWithCorners(source, corners);
      setProcessed({ ...processed, scan, corners });
      setStyle("scan");
      setError(null);
    } catch {
      setError("No pudimos recortar con esas esquinas. Probá de nuevo.");
    } finally {
      setStage(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const created = await repository.create({
        name: values.name.trim(),
        brand: values.brand.trim(),
        rating: values.rating,
        notes: values.notes.trim(),
        photo,
        photoStyle,
        photoCredit,
      });
      // Aviso push a quienes siguen el álbum; no se espera para no demorar el guardado
      supabase.auth
        .getSession()
        .then(({ data }) => data.session && notifyNewSticker(data.session.access_token, created.id))
        .catch((err) => console.error("No se pudo avisar a los amigos", err));
      router.push("/");
    } catch (err) {
      console.error("No se pudo guardar la figurita", err);
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

      <CatalogSearch onPick={pickFromCatalog} onTakePhoto={() => fileInput.current?.click()} disabled={processing} />

      <div className="relative mx-auto mb-2 w-2/3">
        <button type="button" onClick={() => fileInput.current?.click()} className="block w-full" disabled={processing}>
          <Sticker
            name={values.name}
            brand={values.brand}
            rating={values.rating}
            photo={photo}
            photoStyle={photoStyle}
            size="lg"
          />
        </button>
        {stage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-amber-950/60 px-6 text-center text-white">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            <p className="text-sm font-medium">{stageLabel(stage)}</p>
            {stage.kind === "preparing" && (
              <p className="text-xs text-white/70">La primera vez descarga ~40MB; después queda guardado.</p>
            )}
          </div>
        )}
      </div>
      {processed?.scan && !processing && (
        <div className="mx-auto mb-3 flex w-fit rounded-full bg-amber-900/10 p-1 text-sm" role="radiogroup" aria-label="Estilo de imagen">
          {(["scan", "photo"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={style === s}
              onClick={() => setStyle(s)}
              className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
                style === s ? "bg-amber-900 text-amber-50" : "text-amber-900"
              }`}
            >
              {s === "scan" ? "Envuelto" : "Foto original"}
            </button>
          ))}
        </div>
      )}
      <div className="mb-6 flex justify-center gap-5">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={processing}
          className="text-sm font-medium text-amber-800 underline underline-offset-4"
        >
          {processing ? "Procesando foto…" : processed ? "Cambiar foto" : "Sacar foto del paquete"}
        </button>
        {processed && !processing && (
          <button
            type="button"
            onClick={() => setEditingCorners(true)}
            className="text-sm font-medium text-amber-800 underline underline-offset-4"
          >
            Ajustar esquinas
          </button>
        )}
        {processed?.corners && photoStyle === "scan" && !processing && (
          <button
            type="button"
            onClick={() => applyCorners(rotateClockwise(processed.corners!))}
            className="text-sm font-medium text-amber-800 underline underline-offset-4"
            aria-label="Girar 90 grados"
          >
            ↻ Girar
          </button>
        )}
      </div>

      {editingCorners && source && (
        <CornerEditor
          file={source}
          initial={processed?.corners ?? null}
          onCancel={() => setEditingCorners(false)}
          onConfirm={applyCorners}
        />
      )}

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
        {!processed && !processing && <p className="-mt-3 text-center text-xs text-amber-900/60">Necesitás una foto para crear la figurita.</p>}
      </form>
    </main>
  );
}

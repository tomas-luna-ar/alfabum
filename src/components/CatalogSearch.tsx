"use client";

import { useEffect, useMemo, useState } from "react";
import { getCatalog } from "@/lib/repository";
import type { CatalogItem } from "@/lib/types";

type Props = {
  onPick: (item: CatalogItem) => void;
  /** "No lo encuentro": seguir con una foto propia. */
  onTakePhoto: () => void;
  disabled?: boolean;
};

const MAX_RESULTS = 8;

/** Sin acentos ni mayúsculas, para que "guaymallen" encuentre "Guaymallén". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Miniatura de Open Food Facts: misma foto en 200 px. */
const smallImage = (url: string) => url.replace(/\.full\.jpg$/, ".200.jpg");

/** Buscador de alfajores conocidos: elegir uno completa marca, descripción y foto. */
export function CatalogSearch({ onPick, onTakePhoto, disabled }: Props) {
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    getCatalog().then(
      (items) => !cancelled && setCatalog(items),
      (err) => {
        console.error("No se pudo cargar el catálogo", err);
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (!catalog || words.length === 0) return [];
    // Todas las palabras tienen que aparecer en la marca o en la descripción
    return catalog.filter((item) => words.every((w) => fold(`${item.brand} ${item.name}`).includes(w))).slice(0, MAX_RESULTS);
  }, [catalog, query]);

  if (failed) return null;

  return (
    <div className="mb-6">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-amber-900">Buscá un alfajor conocido</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={catalog ? `Ej: Havanna, Jorgito negro… (${catalog.length} alfajores)` : "Cargando catálogo…"}
          disabled={disabled || !catalog}
          className="w-full rounded-lg border border-amber-900/20 bg-white px-3 py-2.5 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
        />
      </label>

      {query.trim() && (
        <ul className="mt-2 divide-y divide-amber-900/10 overflow-hidden rounded-lg bg-white shadow-sm">
          {results.map((item) => (
            <li key={item.code}>
              <button
                type="button"
                onClick={() => {
                  onPick(item);
                  setQuery("");
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left active:bg-amber-900/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa chica, next/image no suma */}
                <img
                  src={smallImage(item.imageUrl)}
                  alt=""
                  crossOrigin="anonymous"
                  loading="lazy"
                  className="h-10 w-10 shrink-0 rounded object-cover"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-stone-900">{item.brand}</span>
                  <span className="block truncate text-xs text-stone-500">{item.name}</span>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                onTakePhoto();
              }}
              className="w-full px-3 py-2.5 text-left text-sm font-medium text-amber-800"
            >
              {results.length ? "¿No es ninguno? Sacale una foto" : "No lo encontramos: sacale una foto 📷"}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

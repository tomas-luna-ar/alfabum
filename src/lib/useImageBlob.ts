"use client";

import { useEffect, useState } from "react";

/** Descargas ya pedidas, para no bajar de nuevo la misma imagen al pasar de página o volver al álbum. */
const cache = new Map<string, Promise<Blob>>();

function fetchBlob(url: string) {
  let promise = cache.get(url);
  if (!promise) {
    // Se baja con fetch (CORS) en vez de usar la URL directo: con COEP require-corp un <img> de otro dominio se bloquea
    promise = fetch(url, { mode: "cors" }).then((res) => {
      if (!res.ok) throw new Error(`No se pudo bajar la imagen (${res.status})`);
      return res.blob();
    });
    promise.catch(() => cache.delete(url));
    cache.set(url, promise);
  }
  return promise;
}

/** Devuelve la imagen como Blob: si ya es un Blob (foto recién sacada) tal cual, si es una URL la descarga. */
export function useImageBlob(src: Blob | string | null): Blob | null {
  const [loaded, setLoaded] = useState<{ url: string; blob: Blob } | null>(null);

  useEffect(() => {
    if (typeof src !== "string") return;
    let cancelled = false;
    fetchBlob(src)
      .then((blob) => !cancelled && setLoaded({ url: src, blob }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (src === null || src instanceof Blob) return src;
  return loaded?.url === src ? loaded.blob : null;
}

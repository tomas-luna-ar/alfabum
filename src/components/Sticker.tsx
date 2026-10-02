"use client";

import type { PhotoStyle } from "@/lib/types";
import { useImageBlob } from "@/lib/useImageBlob";
import { BlobImage } from "./BlobImage";
import { StarRating } from "./StarRating";
import { WrappedAlfajor } from "./WrappedAlfajor";

type Props = {
  number?: number;
  name: string;
  brand: string;
  rating: number;
  /** Foto recién sacada (Blob) o URL de una figurita guardada. */
  photo: Blob | string | null;
  /** "scan" se muestra como alfajor envuelto; "photo" (o ausente) como foto. */
  photoStyle?: PhotoStyle;
  size?: "sm" | "lg";
};

/** Colores del marco: cada marca tiene siempre el mismo, como los equipos en un álbum de figuritas. */
const FRAME_COLORS = [
  "#c0392b", // rojo
  "#2563eb", // azul
  "#16a34a", // verde
  "#9333ea", // violeta
  "#ea580c", // naranja
  "#0891b2", // turquesa
  "#db2777", // rosa
  "#7c4a1e", // chocolate
];

export function frameColor(brand: string) {
  const key = brand.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return FRAME_COLORS[hash % FRAME_COLORS.length];
}

export function Sticker({ number, name, brand, rating, photo, photoStyle, size = "sm" }: Props) {
  const color = frameColor(brand || "?");
  const blob = useImageBlob(photo);
  const isGolden = rating === 5;
  const large = size === "lg";

  return (
    <div
      className={`sticker relative aspect-[3/4.4] w-full select-none rounded-xl bg-white p-[5%] shadow-[0_2px_0_rgba(0,0,0,0.08),0_6px_16px_rgba(60,30,10,0.18)] ${isGolden ? "sticker-golden" : ""}`}
    >
      <div
        className="relative flex h-full flex-col overflow-hidden rounded-lg"
        style={{ backgroundColor: color }}
      >
        <div className="flex items-center justify-between px-[6%] py-[3%] text-white">
          <span className={`font-display ${large ? "text-2xl" : "text-sm"} leading-none drop-shadow`}>
            {number ? `Nº ${String(number).padStart(3, "0")}` : "Nº ???"}
          </span>
          {isGolden && (
            <span className={`${large ? "text-sm" : "text-[0.6rem]"} rounded-full bg-amber-300 px-2 py-0.5 font-bold uppercase text-amber-900`}>
              Top
            </span>
          )}
        </div>

        {blob && photoStyle === "scan" ? (
          <div className="relative mx-[2%] flex-1">
            <div className="absolute inset-0 -rotate-6">
              <WrappedAlfajor blob={blob} alt={name} />
            </div>
          </div>
        ) : (
          <div className="relative mx-[5%] flex-1 overflow-hidden rounded-md bg-black/20">
            {blob ? (
              <BlobImage blob={blob} alt={name} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            ) : photo ? (
              <div className="absolute inset-0 animate-pulse bg-white/10" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-4xl text-white/60">📷</div>
            )}
          </div>
        )}

        <div className={`mx-[5%] my-[4%] rounded-md bg-white ${large ? "px-4 py-3" : "px-2 py-1.5"} text-center`}>
          <p className={`font-display ${large ? "text-2xl" : "text-sm"} truncate leading-tight text-stone-900`}>
            {name || "Sin nombre"}
          </p>
          <p className={`${large ? "text-sm" : "text-[0.65rem]"} truncate uppercase tracking-wider text-stone-500`}>
            {brand || "Marca"}
          </p>
          <StarRating value={rating} size={large ? "md" : "sm"} />
        </div>
      </div>
      {isGolden && <div className="sticker-shine pointer-events-none absolute inset-0 rounded-xl" />}
    </div>
  );
}

/** Espacio vacío del álbum, para invitar a completar la página. */
export function EmptySlot({ number }: { number: number }) {
  return (
    <div className="flex aspect-[3/4.4] w-full items-center justify-center rounded-xl border-2 border-dashed border-amber-900/25 bg-amber-900/5">
      <span className="font-display text-2xl text-amber-900/25">{String(number).padStart(3, "0")}</span>
    </div>
  );
}

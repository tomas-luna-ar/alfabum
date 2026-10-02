"use client";

import { useRef, useState } from "react";
import { rotateClockwise, type Point, type Quad } from "@/lib/geometry";
import { BlobImage } from "./BlobImage";

type Props = {
  file: File;
  /** Esquinas iniciales normalizadas (0–1): arriba-izq, arriba-der, abajo-der, abajo-izq. */
  initial: Quad | null;
  onCancel: () => void;
  onConfirm: (corners: Quad) => void;
};

const DEFAULT_CORNERS: Quad = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
];

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Pantalla para ajustar a mano las 4 esquinas del paquete, como en las apps de escanear documentos. */
export function CornerEditor({ file, initial, onCancel, onConfirm }: Props) {
  const [corners, setCorners] = useState<Quad>(initial ?? DEFAULT_CORNERS);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);

  function moveTo(index: number, e: React.PointerEvent) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const point: Point = { x: clamp((e.clientX - rect.left) / rect.width), y: clamp((e.clientY - rect.top) / rect.height) };
    setCorners((prev) => prev.map((p, i) => (i === index ? point : p)) as Quad);
  }

  const points = corners.map((p) => `${p.x},${p.y}`).join(" ");
  const [tl, tr] = corners;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-950/95 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-white">
      <p className="px-4 py-3 text-center text-sm text-white/80">
        Arrastrá las esquinas a los bordes del paquete. La línea amarilla es el lado de arriba.
      </p>

      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-4">
        <div ref={box} className="relative touch-none select-none">
          <BlobImage blob={file} alt="Foto original" className="block max-h-[65vh] max-w-full" draggable={false} />
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
            <polygon
              points={points}
              fill="rgba(251,191,36,0.15)"
              stroke="white"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={tl.x}
              y1={tl.y}
              x2={tr.x}
              y2={tr.y}
              stroke="#fbbf24"
              strokeWidth={5}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {corners.map((p, i) => (
            <div
              key={i}
              role="button"
              aria-label={`Mover esquina ${["arriba izquierda", "arriba derecha", "abajo derecha", "abajo izquierda"][i]}`}
              className="absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-[3px] border-white bg-amber-400/40 shadow-lg active:cursor-grabbing"
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              onPointerDown={(e) => {
                dragging.current = i;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => dragging.current === i && moveTo(i, e)}
              onPointerUp={() => (dragging.current = null)}
              onPointerCancel={() => (dragging.current = null)}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-3 px-4 pb-4">
        <button type="button" onClick={onCancel} className="flex-1 rounded-full bg-white/10 py-3 font-semibold">
          Cancelar
        </button>
        <button type="button" onClick={() => setCorners(rotateClockwise)} className="rounded-full bg-white/10 px-5 py-3 font-semibold" aria-label="Girar 90 grados">
          ↻ Girar
        </button>
        <button
          type="button"
          onClick={() => onConfirm(corners)}
          className="flex-1 rounded-full bg-amber-400 py-3 font-semibold text-amber-950"
        >
          Listo
        </button>
      </div>
    </div>
  );
}

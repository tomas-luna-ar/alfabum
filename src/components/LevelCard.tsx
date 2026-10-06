"use client";

import { useEffect, useState } from "react";
import { computeProgress, LEVELS, POINTS, type Level } from "@/lib/gamification";
import type { Alfajor } from "@/lib/types";

type Props = {
  alfajores: Alfajor[];
  /** En el álbum propio se festeja al subir de nivel; en uno compartido no. */
  celebrate?: boolean;
};

const SEEN_LEVEL_KEY = "album-level";

function readSeenLevel(): number | null {
  try {
    const stored = localStorage.getItem(SEEN_LEVEL_KEY);
    return stored === null ? null : Number(stored);
  } catch {
    return null;
  }
}

function saveSeenLevel(index: number) {
  try {
    localStorage.setItem(SEEN_LEVEL_KEY, String(index));
  } catch {}
}

/** Nivel del álbum: puntos, barra hacia el próximo nivel y, al tocarla, cómo se suman puntos. */
export function LevelCard({ alfajores, celebrate = false }: Props) {
  const progress = computeProgress(alfajores);
  const { points, level, levelIndex, next, ratio, breakdown } = progress;
  const [open, setOpen] = useState(false);
  const [levelUp, setLevelUp] = useState<Level | null>(null);

  // Si el nivel es más alto que el último que vio en este navegador, se festeja una vez
  useEffect(() => {
    if (!celebrate) return;
    const seen = readSeenLevel();
    saveSeenLevel(levelIndex);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el último nivel visto vive en localStorage
    if (seen !== null && levelIndex > seen) setLevelUp(LEVELS.at(levelIndex)!);
  }, [celebrate, levelIndex]);

  return (
    <>
      <div className="mb-5 rounded-xl bg-white/80 p-3 shadow-sm">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="block w-full text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none" aria-hidden>
              {level.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-amber-900/60">
                Nivel {levelIndex + 1} · {points} pts
              </p>
              <p className="font-display truncate text-xl leading-tight text-amber-900">{level.name}</p>
            </div>
            <span className="text-sm text-amber-900/50">{open ? "▲" : "▼"}</span>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-900/10">
            <div
              className="h-full rounded-full bg-amber-400 transition-[width] duration-700"
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-amber-900/70">
            {next ? (
              <>
                Te faltan <strong>{next.minPoints - points} pts</strong> para ser {next.emoji} {next.name}
              </>
            ) : (
              "Llegaste al nivel máximo. No hay más alfajores que te paren."
            )}
          </p>
        </button>

        {open && (
          <div className="mt-3 border-t border-amber-900/10 pt-3 text-xs text-stone-700">
            <p className="mb-1 font-semibold text-amber-900">Cómo sumar puntos</p>
            <ul className="space-y-0.5">
              <li>
                +{POINTS.sticker} por figurita <span className="text-stone-400">({breakdown.stickers})</span>
              </li>
              <li>
                +{POINTS.newBrand} por cada marca distinta <span className="text-stone-400">({breakdown.brands})</span>
              </li>
              <li>
                +{POINTS.comment} si le dejás un comentario{" "}
                <span className="text-stone-400">({breakdown.comments})</span>
              </li>
              <li>
                +{POINTS.ownPhoto} si la foto es tuya <span className="text-stone-400">({breakdown.ownPhotos})</span>
              </li>
            </ul>
            <p className="mb-1 mt-3 font-semibold text-amber-900">Niveles</p>
            <ol className="space-y-0.5">
              {LEVELS.map((l, i) => (
                <li
                  key={l.name}
                  className={i === levelIndex ? "font-semibold text-amber-900" : i > levelIndex ? "text-stone-400" : ""}
                >
                  {l.emoji} {l.name} <span className="text-stone-400">· {l.minPoints} pts</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {levelUp && <LevelUpModal level={levelUp} onClose={() => setLevelUp(null)} />}
    </>
  );
}

function LevelUpModal({ level, onClose }: { level: Level; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Subiste de nivel"
      onClick={onClose}
    >
      <div
        className="sticker-pop w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-6xl leading-none">{level.emoji}</p>
        <p className="mt-3 text-sm uppercase tracking-wide text-amber-900/60">¡Subiste de nivel!</p>
        <p className="font-display mt-1 text-3xl leading-tight text-amber-900">Ahora sos {level.name}</p>
        <button onClick={onClose} className="mt-5 w-full rounded-full bg-amber-900 py-3 font-semibold text-amber-50">
          ¡Vamos!
        </button>
      </div>
    </div>
  );
}

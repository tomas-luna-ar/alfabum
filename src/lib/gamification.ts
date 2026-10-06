import type { Alfajor } from "./types";

/**
 * Puntos del álbum. Se calculan siempre a partir de las figuritas (no se guardan),
 * así cuentan las que ya estaban y si se borra una figurita también bajan.
 */
export const POINTS = {
  /** Cada figurita pegada. */
  sticker: 10,
  /** Primera figurita de una marca: premia probar marcas distintas. */
  newBrand: 15,
  /** Figurita con comentario. */
  comment: 5,
  /** Foto propia (no del catálogo). */
  ownPhoto: 5,
};

export type Level = { name: string; minPoints: number; emoji: string };

/** Niveles de menor a mayor. */
export const LEVELS: Level[] = [
  { name: "Mirón de góndola", minPoints: 0, emoji: "👀" },
  { name: "Probador de kiosco", minPoints: 30, emoji: "🏪" },
  { name: "Muerde-galletitas", minPoints: 80, emoji: "🍪" },
  { name: "Adicto al dulce de leche", minPoints: 150, emoji: "🥄" },
  { name: "Sommelier de maicena", minPoints: 250, emoji: "🍷" },
  { name: "Gordo catador de alfajores", minPoints: 400, emoji: "🐷" },
  { name: "Doctor en Alfajorología", minPoints: 600, emoji: "🎓" },
  { name: "Leyenda de la Ruta 2", minPoints: 900, emoji: "🛣️" },
  { name: "Dios del alfajor triple", minPoints: 1300, emoji: "👑" },
];

export type Breakdown = { stickers: number; brands: number; comments: number; ownPhotos: number };

export type Progress = {
  points: number;
  level: Level;
  levelIndex: number;
  next: Level | null;
  /** Avance hacia el próximo nivel, de 0 a 1 (1 en el último nivel). */
  ratio: number;
  breakdown: Breakdown;
};

/** Lo que suma puntos en un álbum. */
export function breakdownOf(alfajores: Alfajor[]): Breakdown {
  return {
    stickers: alfajores.length,
    brands: new Set(alfajores.map((a) => a.brand.trim().toLowerCase())).size,
    comments: alfajores.filter((a) => a.notes.trim()).length,
    ownPhotos: alfajores.filter((a) => !a.photoCredit).length,
  };
}

/** Nivel a partir de lo que suma puntos (también sirve para el resumen de un amigo que manda la base). */
export function progressOf(breakdown: Breakdown): Progress {
  const points =
    breakdown.stickers * POINTS.sticker +
    breakdown.brands * POINTS.newBrand +
    breakdown.comments * POINTS.comment +
    breakdown.ownPhotos * POINTS.ownPhoto;

  const levelIndex = LEVELS.findLastIndex((l) => points >= l.minPoints);
  const level = LEVELS.at(levelIndex)!;
  const next = LEVELS.at(levelIndex + 1) ?? null;
  const ratio = next ? (points - level.minPoints) / (next.minPoints - level.minPoints) : 1;
  return { points, level, levelIndex, next, ratio, breakdown };
}

export const computeProgress = (alfajores: Alfajor[]) => progressOf(breakdownOf(alfajores));

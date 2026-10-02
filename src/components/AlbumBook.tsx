"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  pageCount: number;
  page: number;
  onPageChange: (page: number) => void;
  renderPage: (index: number) => React.ReactNode;
};

/** Una vuelta de hoja en curso. dir 1 = hacia adelante, -1 = hacia atrás; progress va de 0 (sin girar) a 1 (girada). */
type Turn = { dir: 1 | -1; progress: number; animating: boolean; complete?: boolean };

/** Cuánto hay que arrastrar (relativo al ancho) para que la hoja termine de dar vuelta sola al soltar. */
const COMPLETE_AT = 0.3;
/** Velocidad (px/ms) a partir de la cual un "flick" corto alcanza para pasar de página. */
const FLICK_SPEED = 0.5;
/** Movimiento mínimo antes de decidir si el gesto es para pasar de página o para scrollear. */
const DRAG_THRESHOLD = 10;
const TURN_MS = 650;

/**
 * Álbum de hojas rígidas: la hoja gira sobre el lomo (borde izquierdo) como en un álbum de fotos.
 * Se pasa de página arrastrando con el dedo (la hoja sigue al dedo), con los botones o con las flechas del teclado.
 */
export function AlbumBook({ pageCount, page, onPageChange, renderPage }: Props) {
  const [turn, setTurn] = useState<Turn | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; t: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  const finishTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(finishTimer.current), []);

  const canTurn = (dir: 1 | -1) => !turn && page + dir >= 0 && page + dir < pageCount;

  function finish(t: Turn) {
    window.clearTimeout(finishTimer.current);
    setTurn(null);
    if (t.complete) onPageChange(page + t.dir);
  }

  function release(t: Turn, complete: boolean) {
    const target = complete ? 1 : 0;
    const next = { ...t, progress: target, animating: true, complete };
    if (t.progress === target || prefersReducedMotion()) return finish(next);
    setTurn(next);
    // Respaldo por si no llega el transitionend (pestaña en segundo plano, transición interrumpida)
    window.clearTimeout(finishTimer.current);
    finishTimer.current = window.setTimeout(() => finish(next), TURN_MS + 100);
  }

  function turnPage(dir: 1 | -1) {
    if (!canTurn(dir)) return;
    if (prefersReducedMotion()) return onPageChange(page + dir);
    const start: Turn = { dir, progress: 0, animating: false };
    setTurn(start);
    // Dos frames: primero se pinta la hoja sin girar, después arranca la transición
    requestAnimationFrame(() => requestAnimationFrame(() => release(start, true)));
  }

  // Flechas del teclado (se vuelve a suscribir en cada render para ver la página y la vuelta actuales)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") turnPage(1);
      if (e.key === "ArrowLeft") turnPage(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onPointerDown(e: React.PointerEvent) {
    if (turn || !e.isPrimary) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, active: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      const dir = dx < 0 ? 1 : -1;
      // Gesto vertical (scroll) o no hay página para ese lado: lo dejamos pasar
      if (Math.abs(dx) < Math.abs(dy) * 1.2 || !canTurn(dir)) {
        drag.current = null;
        return;
      }
      d.active = true;
      suppressClick.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      setTurn({ dir, progress: 0, animating: false });
      return;
    }
    const width = box.current?.offsetWidth ?? 1;
    setTurn((t) => t && { ...t, progress: clamp(t.dir === 1 ? -dx / width : dx / width) });
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d?.active || !turn) return;
    const dx = e.clientX - d.x;
    const speed = Math.abs(dx) / Math.max(1, e.timeStamp - d.t);
    const towardTurn = turn.dir === 1 ? dx < 0 : dx > 0;
    release(turn, e.type === "pointerup" && towardTurn && (turn.progress > COMPLETE_AT || speed > FLICK_SPEED));
  }

  // Si se arrastró para pasar de página, el "click" al soltar no tiene que abrir la figurita de abajo
  function onClickCapture(e: React.MouseEvent) {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  // Hacia adelante: la hoja actual gira hacia la izquierda y deja ver la siguiente.
  // Hacia atrás: la hoja anterior vuelve desde la izquierda y tapa la actual.
  const under = turn?.dir === 1 ? page + 1 : page;
  const leafPage = turn ? (turn.dir === 1 ? page : page - 1) : null;
  const angle = turn ? -180 * (turn.dir === 1 ? turn.progress : 1 - turn.progress) : 0;
  // 0 con la hoja apoyada, 1 con la hoja vertical: la sombra es más fuerte a mitad de camino
  const lift = Math.sin((Math.abs(angle) * Math.PI) / 180);
  const remaining = pageCount - 1 - page;

  return (
    <div>
      <div
        ref={box}
        className="relative touch-pan-y select-none"
        style={{ perspective: "1800px" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        {/* Canto de las hojas que quedan por delante */}
        <div
          className="album-page-stack pointer-events-none absolute inset-0 rounded-r-xl rounded-l-sm"
          style={{ "--stack": Math.min(remaining, 4) } as React.CSSProperties}
        />

        <Sheet number={under + 1}>{renderPage(under)}</Sheet>
        {turn && (
          <div
            className="pointer-events-none absolute inset-0 rounded-r-xl rounded-l-sm bg-gradient-to-r from-black/40 to-transparent"
            style={{ opacity: lift * 0.6 }}
          />
        )}

        {turn && leafPage !== null && (
          <div
            className="absolute inset-0 origin-left"
            style={{
              transform: `rotateY(${angle}deg)`,
              transformStyle: "preserve-3d",
              transition: turn.animating ? `transform ${TURN_MS}ms cubic-bezier(0.3, 0.1, 0.25, 1)` : "none",
            }}
            onTransitionEnd={(e) => e.target === e.currentTarget && finish(turn)}
          >
            <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
              <Sheet number={leafPage + 1}>{renderPage(leafPage)}</Sheet>
              <div
                className="pointer-events-none absolute inset-0 rounded-r-xl rounded-l-sm bg-gradient-to-l from-black/30 to-transparent"
                style={{ opacity: lift }}
              />
            </div>
            <div
              className="album-sheet-back absolute inset-0 rounded-l-xl rounded-r-sm"
              style={{
                transform: "rotateY(180deg)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            />
          </div>
        )}
      </div>

      {pageCount > 1 && (
        <nav className="mt-4 flex items-center justify-between" aria-label="Páginas del álbum">
          <button
            type="button"
            onClick={() => turnPage(-1)}
            disabled={page === 0 || !!turn}
            className="rounded-full bg-amber-900/10 px-4 py-2 text-sm font-medium text-amber-900 disabled:opacity-30"
          >
            ‹ Anterior
          </button>
          <span className="text-sm text-amber-900/70" aria-live="polite">
            Página {page + 1} de {pageCount}
          </span>
          <button
            type="button"
            onClick={() => turnPage(1)}
            disabled={page === pageCount - 1 || !!turn}
            className="rounded-full bg-amber-900/10 px-4 py-2 text-sm font-medium text-amber-900 disabled:opacity-30"
          >
            Siguiente ›
          </button>
        </nav>
      )}
    </div>
  );
}

/** Una hoja del álbum: papel, sombra del lomo a la izquierda y número de página al pie. */
function Sheet({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="album-sheet relative h-full rounded-r-xl rounded-l-sm px-4 pb-8 pt-4 pl-6">
      {children}
      <span className="absolute bottom-2 right-4 font-display text-sm text-amber-900/40">{number}</span>
    </div>
  );
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { REACTION_EMOJIS, type ReactionEmoji, type StickerReactions } from "@/lib/repository";
import type { Alfajor } from "@/lib/types";
import { StarRating } from "./StarRating";
import { frameColor, Sticker } from "./Sticker";

type Props = {
  alfajor: Alfajor;
  /** Si está, el dorso muestra un link para abrir la figurita (en el álbum propio). */
  href?: string;
  reactions?: StickerReactions;
  /** Si está, se puede reaccionar desde el dorso (álbum de un amigo); si no, solo se muestran los conteos. */
  onReact?: (emoji: ReactionEmoji | null) => void;
};

const face: React.CSSProperties = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };

/** Figurita que se da vuelta al tocarla: al dorso se lee el comentario. */
export function FlipSticker({ alfajor, href, reactions, onReact }: Props) {
  const [flipped, setFlipped] = useState(false);
  const total = Object.values(reactions?.counts ?? {}).reduce((sum, n) => sum + n, 0);
  const top = REACTION_EMOJIS.reduce<ReactionEmoji | null>(
    (best, e) => ((reactions?.counts[e] ?? 0) > (best ? (reactions?.counts[best] ?? 0) : 0) ? e : best),
    null,
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={`${alfajor.name}, ${alfajor.brand}. ${flipped ? "Mostrar el frente" : "Dar vuelta para ver el comentario"}`}
      onClick={() => setFlipped((f) => !f)}
      onKeyDown={(e) => {
        // Enter sobre el link del dorso tiene que abrir el link, no dar vuelta la figurita
        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        setFlipped((f) => !f);
      }}
      className="block cursor-pointer outline-none transition-transform focus-visible:ring-2 focus-visible:ring-amber-700 active:scale-95"
      style={{ perspective: "1000px" }}
    >
      <div
        className="relative transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : undefined }}
      >
        <div className="relative" style={face}>
          {total > 0 && (
            <span className="absolute -right-1 -top-1 z-10 rounded-full bg-white px-1.5 py-0.5 text-xs font-semibold text-stone-700 shadow">
              {top} {total}
            </span>
          )}
          <Sticker
            number={alfajor.number}
            name={alfajor.name}
            brand={alfajor.brand}
            rating={alfajor.rating}
            photo={alfajor.thumbUrl}
            photoStyle={alfajor.photoStyle}
          />
        </div>
        <div className="absolute inset-0" style={{ ...face, transform: "rotateY(180deg)" }} aria-hidden={!flipped}>
          <StickerBack alfajor={alfajor} href={href} focusable={flipped} reactions={reactions} onReact={onReact} />
        </div>
      </div>
    </div>
  );
}

/** Tamaños de letra entre los que se busca el que llena el recuadro (px). */
const MIN_FONT = 10;
const MAX_FONT = 40;

/** Comentario con la letra más grande que entra en el recuadro: uno corto se ve enorme, uno largo se achica. */
function FittedNote({ text }: { text: string }) {
  const box = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const boxEl = box.current;
    const noteEl = note.current;
    if (!boxEl || !noteEl) return;

    function fit() {
      if (!boxEl || !noteEl || boxEl.clientHeight === 0) return;
      const style = getComputedStyle(boxEl);
      const height = boxEl.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const fits = () => noteEl.scrollHeight <= height && noteEl.scrollWidth <= noteEl.clientWidth;
      // Búsqueda binaria del tamaño más grande que entra, de a medio píxel
      let lo = MIN_FONT;
      let hi = MAX_FONT;
      while (hi - lo > 0.5) {
        const mid = (lo + hi) / 2;
        noteEl.style.fontSize = `${mid}px`;
        if (fits()) lo = mid;
        else hi = mid;
      }
      noteEl.style.fontSize = `${lo}px`;
      // Si ni con la letra mínima entra, se alinea arriba y se puede scrollear (centrado cortaría el principio)
      const overflows = !fits();
      boxEl.style.alignItems = overflows ? "flex-start" : "";
      boxEl.style.overflowY = overflows ? "auto" : "";
    }

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(boxEl);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div
      ref={box}
      className="my-[6%] flex min-h-0 flex-1 items-center overflow-hidden rounded-md bg-white/95 p-[8%] text-stone-800"
    >
      <p ref={note} className="w-full whitespace-pre-wrap break-words font-medium leading-tight">
        “{text}”
      </p>
    </div>
  );
}

/** Dorso de la figurita: número, marca, comentario y fecha. */
function StickerBack({ alfajor, href, focusable, reactions, onReact }: Props & { focusable: boolean }) {
  return (
    <div className="h-full w-full select-none rounded-xl bg-white p-[5%] shadow-[0_2px_0_rgba(0,0,0,0.08),0_6px_16px_rgba(60,30,10,0.18)]">
      <div
        className="flex h-full flex-col overflow-hidden rounded-lg p-[6%] text-white"
        style={{ backgroundColor: frameColor(alfajor.brand || "?") }}
      >
        <div className="flex items-baseline justify-between gap-1">
          <span className="font-display text-sm leading-none drop-shadow">
            Nº {String(alfajor.number).padStart(3, "0")}
          </span>
          <span className="truncate text-[0.6rem] uppercase tracking-wider text-white/80">{alfajor.brand}</span>
        </div>

        {alfajor.notes ? (
          <FittedNote text={alfajor.notes} />
        ) : (
          <div className="my-[6%] flex min-h-0 flex-1 items-center justify-center rounded-md bg-white/95 p-2">
            <p className="text-sm italic text-stone-400">Sin comentario</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-1">
          <StarRating value={alfajor.rating} size="sm" />
          <span className="whitespace-nowrap text-[0.6rem] text-white/80">
            {new Date(alfajor.createdAt).toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
            })}
          </span>
        </div>

        <ReactionBar reactions={reactions} onReact={onReact} focusable={focusable} />

        {alfajor.photoCredit && <p className="mt-[3%] truncate text-[0.5rem] text-white/70">{alfajor.photoCredit}</p>}

        {href && (
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            tabIndex={focusable ? 0 : -1}
            className="mt-[6%] rounded-full bg-white/95 py-1 text-center text-xs font-semibold text-stone-800"
          >
            Ver figurita
          </Link>
        )}
      </div>
    </div>
  );
}

/** Fila de reacciones del dorso: tocables en el álbum de un amigo, solo conteos en el propio. */
function ReactionBar({
  reactions,
  onReact,
  focusable,
}: {
  reactions?: StickerReactions;
  onReact?: (emoji: ReactionEmoji | null) => void;
  focusable: boolean;
}) {
  const counts = reactions?.counts ?? {};
  const shown = onReact ? REACTION_EMOJIS : REACTION_EMOJIS.filter((e) => counts[e]);
  if (shown.length === 0) return null;

  return (
    <div className="mt-[4%] flex justify-between gap-0.5">
      {shown.map((emoji) => {
        const mine = reactions?.mine === emoji;
        const count = counts[emoji] ?? 0;
        const content = (
          <>
            <span className="text-sm leading-none">{emoji}</span>
            {count > 0 && <span className="text-[0.55rem] font-semibold leading-none">{count}</span>}
          </>
        );
        if (!onReact) {
          return (
            <span
              key={emoji}
              className="flex items-center gap-0.5 rounded-full bg-white/90 px-1.5 py-0.5 text-stone-700"
            >
              {content}
            </span>
          );
        }
        return (
          <button
            key={emoji}
            type="button"
            tabIndex={focusable ? 0 : -1}
            aria-pressed={mine}
            aria-label={`Reaccionar ${emoji}`}
            // Tocar una reacción no tiene que dar vuelta la figurita
            onClick={(e) => {
              e.stopPropagation();
              onReact(mine ? null : emoji);
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className={`flex flex-1 items-center justify-center gap-0.5 rounded-full py-0.5 text-stone-700 transition-transform active:scale-90 ${
              mine ? "bg-amber-300 ring-2 ring-white" : "bg-white/90"
            }`}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

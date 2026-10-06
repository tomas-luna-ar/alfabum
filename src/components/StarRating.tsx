"use client";

type Props = {
  /** Puntaje de 0 a 5, de a media estrella. */
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
};

const sizes = { sm: "text-sm", md: "text-xl", lg: "text-4xl" };
const STARS = [1, 2, 3, 4, 5];

/** "4,5" en vez de "4.5". */
export const formatRating = (value: number) => value.toLocaleString("es-AR", { maximumFractionDigits: 1 });

/** Cuánto se pinta la estrella n (1–5): 0, media o entera. */
const fillOf = (n: number, value: number) => Math.min(1, Math.max(0, value - (n - 1)));

/** Una estrella gris con la parte amarilla encima, recortada según cuánto está llena. */
function Star({ fill }: { fill: number }) {
  return (
    <span className="relative inline-block">
      <span className="text-black/20">★</span>
      {fill > 0 && (
        <span className="absolute inset-0 overflow-hidden text-amber-400" style={{ width: `${fill * 100}%` }}>
          ★
        </span>
      )}
    </span>
  );
}

export function StarRating({ value, onChange, size = "md" }: Props) {
  if (!onChange) {
    return (
      <span
        className={`${sizes[size]} inline-flex leading-none tracking-tight`}
        role="img"
        aria-label={`${formatRating(value)} de 5`}
      >
        {STARS.map((n) => (
          <Star key={n} fill={fillOf(n, value)} />
        ))}
      </span>
    );
  }

  return (
    <div className={`${sizes[size]} flex items-center gap-1 leading-none`} role="radiogroup" aria-label="Puntaje">
      {STARS.map((n) => (
        // Cada estrella tiene dos mitades tocables: la izquierda pone media estrella, la derecha la entera
        <span key={n} className="relative inline-block transition-transform active:scale-90">
          <Star fill={fillOf(n, value)} />
          {[n - 0.5, n].map((option, half) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={value === option}
              aria-label={`${formatRating(option)} ${option === 1 ? "estrella" : "estrellas"}`}
              onClick={() => onChange(option)}
              className={`absolute inset-y-0 w-1/2 ${half === 0 ? "left-0" : "right-0"}`}
            />
          ))}
        </span>
      ))}
      {value > 0 && <span className="ml-2 text-base font-medium text-amber-900/70">{formatRating(value)}</span>}
    </div>
  );
}

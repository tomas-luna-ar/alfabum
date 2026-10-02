"use client";

type Props = {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
};

const sizes = { sm: "text-sm", md: "text-xl", lg: "text-4xl" };

export function StarRating({ value, onChange, size = "md" }: Props) {
  const stars = [1, 2, 3, 4, 5];

  if (!onChange) {
    return (
      <span className={`${sizes[size]} leading-none tracking-tight`} aria-label={`${value} de 5`}>
        {stars.map((n) => (
          <span key={n} className={n <= value ? "text-amber-400" : "text-black/20"}>
            ★
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className={`${sizes[size]} flex gap-1 leading-none`} role="radiogroup" aria-label="Puntaje">
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
          onClick={() => onChange(n)}
          className={`transition-transform active:scale-90 ${n <= value ? "text-amber-400" : "text-black/20"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

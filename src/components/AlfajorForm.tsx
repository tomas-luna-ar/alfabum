"use client";

import { StarRating } from "./StarRating";

export type AlfajorFormValues = {
  name: string;
  brand: string;
  rating: number;
  notes: string;
};

type Props = {
  values: AlfajorFormValues;
  onChange: (values: AlfajorFormValues) => void;
  brandSuggestions?: string[];
};

const inputClass =
  "w-full rounded-lg border border-amber-900/20 bg-white px-3 py-2.5 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20";

export function AlfajorFields({ values, onChange, brandSuggestions = [] }: Props) {
  const set = <K extends keyof AlfajorFormValues>(key: K, value: AlfajorFormValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-amber-900">Nombre/Marca</span>
        <input
          className={inputClass}
          value={values.brand}
          onChange={(e) => set("brand", e.target.value)}
          placeholder="Ej: Havanna"
          list="brand-suggestions"
          required
          maxLength={30}
        />
        <datalist id="brand-suggestions">
          {brandSuggestions.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-amber-900">Descripción</span>
        <input
          className={inputClass}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Ej: Triple chocolate"
          required
          maxLength={40}
        />
      </label>

      <div>
        <span className="mb-1 block text-sm font-medium text-amber-900">Puntaje</span>
        <StarRating value={values.rating} onChange={(n) => set("rating", n)} size="lg" />
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-amber-900">
          Notas <span className="font-normal text-amber-900/50">(opcional)</span>
        </span>
        <textarea
          className={`${inputClass} min-h-20 resize-y`}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="¿Qué tal el dulce de leche? ¿La galletita?"
          maxLength={280}
        />
      </label>
    </div>
  );
}

# Alfabum

Álbum de figuritas de alfajores: sacale una foto al paquete de cada alfajor que comés, puntualo de 1 a 5 y se pega en tu álbum como figurita.

## Correr

```bash
npm install
npm run dev
```

Abrir http://localhost:3000. Para probar la cámara desde el celular, entrá desde la misma red usando la IP de tu compu (en iOS la cámara requiere HTTPS: `npx next dev --experimental-https`).

## Stack

- Next.js (App Router) + Tailwind, mobile-first, instalable como PWA (`src/app/manifest.ts`).
- Sin backend: todo se guarda en el navegador con IndexedDB (`src/lib/repository.ts`).
- La foto se recorta a 3:4 y se comprime a JPEG en el cliente (`src/lib/image.ts`).

## Estructura

```
src/
  app/
    page.tsx              Álbum (grilla, stats, orden)
    nuevo/page.tsx        Sacar foto + cargar alfajor
    alfajor/[id]/page.tsx Detalle, edición y borrado
  components/
    Sticker.tsx           Figurita (marco por marca, dorada si tiene 5★)
    AlfajorForm.tsx       Campos del formulario
    StarRating.tsx
    BlobImage.tsx
  lib/
    types.ts              Modelo + interfaz AlfajorRepository
    repository.ts         Implementación local (IndexedDB)
```

## Próximo paso: álbum global

La UI solo habla con `AlfajorRepository`. Para el álbum compartido alcanza con sumar una implementación remota (ej. Supabase: auth + tabla `alfajores` + storage para las fotos) y cambiar el export de `repository` en `src/lib/repository.ts`.

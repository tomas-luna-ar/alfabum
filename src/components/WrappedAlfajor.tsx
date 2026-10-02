"use client";

import { useEffect, useId, useState } from "react";

type Props = {
  /** Paquete recortado y enderezado (el "scan"): se usa como estampa del envoltorio. */
  blob: Blob;
  alt: string;
};

/** Largo fijo del dibujo (lado largo del paquete); el lado corto sale de la proporción del recorte. */
const W = 1000;
/** Ancho de cada cierre sellado, relativo al ancho. */
const SEAL = 0.075;
/** Cuánto se "pellizca" el envoltorio en los cierres, relativo al alto. */
const PINCH = 0.06;
/** Cantidad y profundidad de los dientes del corte en zigzag. */
const TEETH = 12;
const TOOTH_DEPTH = 0.016;
/** Margen alrededor para la sombra proyectada en el fondo. */
const PAD = 100;

/**
 * Dibuja el recorte del paquete como un alfajor envuelto: cierres sellados con corte en zigzag,
 * volumen de "almohadita" y sombra sobre el fondo. Es solo presentación: lo guardado sigue siendo el recorte.
 */
export function WrappedAlfajor({ blob, alt }: Props) {
  const id = useId().replace(/:/g, "");
  const [image, setImage] = useState<{
    url: string;
    height: number;
    portrait: boolean;
  } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    let cancelled = false;
    createImageBitmap(blob)
      .then((bitmap) => {
        if (!cancelled) {
          const portrait = bitmap.height > bitmap.width;
          const ratio = portrait ? bitmap.width / bitmap.height : bitmap.height / bitmap.width;
          setImage({ url, height: Math.round(W * ratio), portrait });
        }
        bitmap.close();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  if (!image) return null;

  // El envoltorio se dibuja siempre apaisado (W × H, cierres a los costados). Si el recorte es vertical,
  // se transpone el dibujo para que los cierres queden en los lados cortos, sin girar la imagen.
  const H = image.height;
  const width = image.portrait ? H : W;
  const height = image.portrait ? W : H;
  const transpose = image.portrait ? "matrix(0 1 1 0 0 0)" : undefined;
  const outline = wrapperPath(H);
  const seal = W * SEAL;
  const crimpLines = Array.from({ length: 7 }, (_, i) => ((i + 1) * seal) / 8);

  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${width + PAD * 2} ${height + PAD * 2}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={alt}
    >
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={outline} transform={transpose} />
        </clipPath>
        {/* Volumen: el centro del paquete se infla y los bordes de arriba y abajo quedan en sombra */}
        <linearGradient id={`${id}-pillow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <stop offset="0.12" stopColor="#000" stopOpacity="0" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.85" stopColor="#000" stopOpacity="0.08" />
          <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </linearGradient>
        {/* El paquete se hunde hacia los cierres */}
        <linearGradient id={`${id}-sides`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.25" />
          <stop offset={SEAL + 0.04} stopColor="#000" stopOpacity="0" />
          <stop offset={1 - SEAL - 0.04} stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </linearGradient>
        {/* Sombra proyectada sobre el fondo, como si el paquete estuviera apoyado y un poco levantado */}
        <filter id={`${id}-cast`} x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur stdDeviation={Math.min(W, H) * 0.045} />
        </filter>
        <filter id={`${id}-contact`} x="-10%" y="-10%" width="120%" height="140%">
          <feDropShadow dx="0" dy={H * 0.015} stdDeviation={H * 0.012} floodColor="#2b1406" floodOpacity="0.35" />
        </filter>
      </defs>

      <g transform={`translate(${W * 0.03} ${H * 0.09})`} opacity="0.45" filter={`url(#${id}-cast)`}>
        <path d={outline} transform={transpose} fill="#2b1406" />
      </g>

      <g filter={`url(#${id}-contact)`}>
        <g clipPath={`url(#${id}-clip)`}>
          <image href={image.url} x="0" y="0" width={width} height={height} preserveAspectRatio="none" />
          <g transform={transpose}>
            <rect width={W} height={H} fill={`url(#${id}-pillow)`} />
            <rect width={W} height={H} fill={`url(#${id}-sides)`} />

            {/* Cierres sellados: rayitas del sellado en caliente y el pliegue donde empieza el paquete */}
            {[0, W - seal].map((x0) => (
              <g key={x0}>
                <rect x={x0} width={seal} height={H} fill="#fff" opacity="0.12" />
                {crimpLines.map((dx) => (
                  <line
                    key={dx}
                    x1={x0 + dx}
                    x2={x0 + dx}
                    y1="0"
                    y2={H}
                    stroke="#000"
                    strokeOpacity="0.18"
                    strokeWidth="3"
                  />
                ))}
              </g>
            ))}
            <line x1={seal} x2={seal} y1="0" y2={H} stroke="#000" strokeOpacity="0.3" strokeWidth="4" />
            <line x1={W - seal} x2={W - seal} y1="0" y2={H} stroke="#000" strokeOpacity="0.3" strokeWidth="4" />

            {/* Arrugas que salen de los cierres */}
            <g fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round">
              <path d={`M${seal} ${H * 0.2} q${W * 0.05} ${H * 0.02} ${W * 0.09} ${H * 0.08}`} />
              <path d={`M${seal} ${H * 0.78} q${W * 0.04} ${-H * 0.02} ${W * 0.08} ${-H * 0.09}`} />
              <path d={`M${W - seal} ${H * 0.25} q${-W * 0.05} ${H * 0.03} ${-W * 0.08} ${H * 0.1}`} />
              <path d={`M${W - seal} ${H * 0.72} q${-W * 0.04} ${-H * 0.01} ${-W * 0.09} ${-H * 0.07}`} />
            </g>

          </g>
        </g>
        <path d={outline} transform={transpose} fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="3" />
      </g>
    </svg>
  );
}

/** Contorno del envoltorio: cuerpo inflado, cierres más angostos a los costados y corte en zigzag. */
function wrapperPath(H: number) {
  const seal = W * SEAL;
  const pinch = H * PINCH;
  const depth = W * TOOTH_DEPTH;
  const tooth = (H - pinch * 2) / TEETH;
  // Transición del cierre al cuerpo inflado
  const ease = W * 0.07;

  const right: string[] = [];
  const left: string[] = [];
  for (let i = 0; i < TEETH; i++) {
    const y = pinch + i * tooth;
    right.push(`L${W} ${y + tooth / 2} L${W - depth} ${y + tooth}`);
    const yUp = H - pinch - i * tooth;
    left.push(`L0 ${yUp - tooth / 2} L${depth} ${yUp - tooth}`);
  }

  return [
    `M${depth} ${pinch}`,
    `L${seal} ${pinch}`,
    `C${seal + ease * 0.5} ${pinch} ${seal + ease * 0.5} 0 ${seal + ease} 0`,
    `L${W - seal - ease} 0`,
    `C${W - seal - ease * 0.5} 0 ${W - seal - ease * 0.5} ${pinch} ${W - seal} ${pinch}`,
    `L${W - depth} ${pinch}`,
    ...right,
    `L${W - seal} ${H - pinch}`,
    `C${W - seal - ease * 0.5} ${H - pinch} ${W - seal - ease * 0.5} ${H} ${W - seal - ease} ${H}`,
    `L${seal + ease} ${H}`,
    `C${seal + ease * 0.5} ${H} ${seal + ease * 0.5} ${H - pinch} ${seal} ${H - pinch}`,
    `L${depth} ${H - pinch}`,
    ...left,
    "Z",
  ].join(" ");
}

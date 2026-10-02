"use client";

import { useEffect, useRef } from "react";

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & { blob: Blob };

/** Muestra un Blob como imagen, creando y liberando su object URL. */
export function BlobImage({ blob, alt, ...props }: Props) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  // eslint-disable-next-line @next/next/no-img-element -- object URL local, next/image no aplica
  return <img ref={ref} alt={alt} {...props} />;
}

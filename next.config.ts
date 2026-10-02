import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aislamiento cross-origin: habilita SharedArrayBuffer para que el modelo que quita el fondo
  // use varios hilos (mucho más rápido). Todo recurso de otro dominio necesita CORS o CORP.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;

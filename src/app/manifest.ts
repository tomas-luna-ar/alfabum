import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alfabum — Mi álbum de alfajores",
    short_name: "Alfabum",
    description: "Sacale una foto a cada alfajor que comés, puntualo y completá tu álbum.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbf3e4",
    theme_color: "#7c4a1e",
    // Android pide PNG de 192 y 512 para ofrecer "Instalar"; el maskable tiene fondo completo para recortarlo
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

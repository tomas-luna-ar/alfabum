import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alfabum — Mi álbum de alfajores",
    short_name: "Alfabum",
    description: "Sacale una foto a cada alfajor que comés, puntualo y completá tu álbum.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf3e4",
    theme_color: "#7c4a1e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

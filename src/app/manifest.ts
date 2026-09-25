import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dodio – správa firemních absencí na pár kliknutí",
    short_name: "Dodio",
    description: "Jednoduchá správa dovolených, sick days a home office pro malé a střední firmy.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F7F5F0",
    theme_color: "#0F9D7C",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

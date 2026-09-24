import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://dodio.cz";
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/obchodni-podminky`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/ochrana-osobnich-udaju`, changeFrequency: "yearly", priority: 0.3 },
  ];
}

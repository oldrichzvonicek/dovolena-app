import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://dodio.cz";
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/sablona-dochazky-2027`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/kalkulacka-dovolene`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/kalkulacka-pracovnich-dnu`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/obchodni-podminky`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/ochrana-osobnich-udaju`, changeFrequency: "yearly", priority: 0.3 },
  ];
}

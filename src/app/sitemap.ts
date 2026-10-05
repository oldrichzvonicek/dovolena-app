import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://dodio.cz";
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/evidence-dovolene`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/evidence-absenci`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/home-office`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/sick-days`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/bez-excelu`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/pro-male-firmy`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/sablona-dochazky-2027`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/kalkulacka-dovolene`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/kalkulacka-pracovnich-dnu`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/kontakt`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/obchodni-podminky`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/ochrana-osobnich-udaju`, changeFrequency: "yearly", priority: 0.3 },
  ];
}

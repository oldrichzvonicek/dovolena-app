import type { MetadataRoute } from "next";

// Site not ready for public search visibility yet — disallow everything.
// Flip back to allow: "/" once it's ready to be indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}

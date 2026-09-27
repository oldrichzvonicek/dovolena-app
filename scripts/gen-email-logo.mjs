// Vygeneruje public/brand/logo-mark.png z SVG značky (1:1 shodné s src/components/shared/AppLogo.tsx),
// protože Gmail a hlavně Outlook v e-mailu nespolehlivě zobrazují inline SVG ani CSS position:absolute
// (proto to na e-mailu vypadalo jen jako holý text "Dodio" bez značky). <img> s PNG zvládne úplně každý klient.
import sharp from "sharp";
import fs from "node:fs";

const svg = `
<svg width="256" height="256" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="clip">
      <rect x="0" y="0" width="96" height="96" rx="22" />
    </clipPath>
  </defs>
  <rect x="0" y="0" width="96" height="96" rx="22" fill="#0F9D7C" />
  <g clip-path="url(#clip)">
    <circle cx="96" cy="96" r="34" fill="#F0997B" />
  </g>
</svg>
`;

fs.mkdirSync("public/brand", { recursive: true });
await sharp(Buffer.from(svg)).png().toFile("public/brand/logo-mark.png");
console.log("written public/brand/logo-mark.png");

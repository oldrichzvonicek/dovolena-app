// Právní dokumenty, se kterými se souhlasí při založení firmy. Adresy a označení verze se nastavují v prostředí
// (Vercel → Environment Variables), ať jdou změnit bez zásahu do kódu. Bez adresy se název dokumentu zobrazí
// jen jako text — před ostrým provozem proto obě adresy nastavte.
export const LEGAL = {
  termsUrl: process.env.NEXT_PUBLIC_TERMS_URL || null,
  privacyUrl: process.env.NEXT_PUBLIC_PRIVACY_URL || null,
  /** Označení znění, které člověk odsouhlasil (uloží se u jeho účtu jako doklad). Při změně dokumentů ho zvyšte. */
  version: process.env.NEXT_PUBLIC_LEGAL_VERSION || "1",
};

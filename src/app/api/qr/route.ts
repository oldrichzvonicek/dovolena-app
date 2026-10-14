import QRCode from "qrcode";
import { czIban, spayd } from "@/lib/spayd";

export const dynamic = "force-dynamic";

// Účet, na který zákazníci platí faktury (stejný jako v e-mailech o fakturách).
const BANK_ACCOUNT = process.env.BILLING_BANK_ACCOUNT ?? "8180385003/5500 (Raiffeisenbank)";

/**
 * Obrázek QR platby pro e-mail o faktuře: /api/qr?am=1346&vs=1260001. Účet je pevný, z adresy se bere jen částka,
 * variabilní symbol a krátká zpráva — nic tajného, proto bez přihlášení (e-mailový klient obrázek načítá sám).
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const amount = Number(q.get("am"));
  const vs = (q.get("vs") ?? "").replace(/\D/g, "").slice(0, 10);
  const iban = czIban(BANK_ACCOUNT);
  if (!iban || !Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return new Response("bad request", { status: 400 });
  const png = await QRCode.toBuffer(spayd({ iban, amount, variableSymbol: vs, message: vs ? `Faktura ${vs}` : "Dodio" }), { width: 240, margin: 1, errorCorrectionLevel: "M" });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" } });
}

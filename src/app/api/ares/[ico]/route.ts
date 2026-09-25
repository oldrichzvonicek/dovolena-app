import { NextRequest, NextResponse } from "next/server";

interface AresSidlo {
  nazevUlice?: string;
  cisloDomovni?: number;
  cisloOrientacni?: number;
  nazevObce?: string;
  psc?: number;
}

interface AresResponse {
  ico: string;
  obchodniJmeno: string;
  dic?: string;
  sidlo?: AresSidlo;
}

function formatZip(psc?: number): string {
  if (!psc) return "";
  const s = String(psc).padStart(5, "0");
  return `${s.slice(0, 3)} ${s.slice(3)}`;
}

function formatStreet(sidlo?: AresSidlo): string {
  if (!sidlo?.nazevUlice) return "";
  const num = sidlo.cisloOrientacni ? `${sidlo.cisloDomovni}/${sidlo.cisloOrientacni}` : String(sidlo.cisloDomovni ?? "");
  return `${sidlo.nazevUlice} ${num}`.trim();
}

// Proxies the public (no-auth) ARES company registry so the browser doesn't
// have to deal with ARES's own CORS policy. Nothing here is sensitive — IČO
// lookups are public record.
export async function GET(_req: NextRequest, { params }: { params: { ico: string } }) {
  const ico = params.ico.replace(/\D/g, "");
  if (ico.length !== 8) {
    return NextResponse.json({ error: "IČO musí mít 8 číslic." }, { status: 400 });
  }

  const res = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`, {
    headers: { Accept: "application/json" },
  });

  if (res.status === 404) {
    return NextResponse.json({ error: "Firma s tímto IČO nebyla v ARES nalezena." }, { status: 404 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "ARES momentálně neodpovídá, zkuste to prosím znovu." }, { status: 502 });
  }

  const data = (await res.json()) as AresResponse;
  return NextResponse.json({
    name: data.obchodniJmeno,
    ico: data.ico,
    dic: data.dic ?? "",
    street: formatStreet(data.sidlo),
    city: data.sidlo?.nazevObce ?? "",
    zip: formatZip(data.sidlo?.psc),
  });
}

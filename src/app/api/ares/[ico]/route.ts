import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { allowRequest, clientIp, tooManyRequests } from "@/lib/rate-limit";

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
export async function GET(_req: NextRequest, { params }: { params: Promise<{ ico: string }> }) {
  // Only signed-in users may use the proxy (it is not an open relay to ARES).
  const {
    data: { user },
  } = await (await createRouteClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Nejste přihlášeni." }, { status: 401 });
  if (!(await allowRequest(`ares:${user.id}`, 30, 60))) return tooManyRequests();

  const ico = (await params).ico.replace(/\D/g, "");
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

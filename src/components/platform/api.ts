/** Volání API super-adminu z prohlížeče: chyby ve tvaru { error: { code, message } } se převedou na Error s českou hláškou. */
export class PlatformApiError extends Error {
  constructor(message: string, public code: string, public status: number) {
    super(message);
  }
}

export async function platformFetch<T = unknown>(path: string, init: { method?: string; json?: unknown; form?: FormData; headers?: Record<string, string> } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  let body: BodyInit | undefined;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  } else if (init.form) {
    body = init.form;
  }
  const res = await fetch(`/api/platform${path}`, { method: init.method ?? (body ? "POST" : "GET"), headers, body, credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } }).error;
    if (res.status === 401 && err?.code !== "invalid_credentials" && err?.code !== "invalid_code" && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new PlatformApiError(err?.message ?? "Něco se nepovedlo. Zkuste to prosím znovu.", err?.code ?? "error", res.status);
  }
  return data as T;
}

/** Citlivé akce: nový kód TOTP → jednorázový token na 5 minut pro danou akci (posílá se v hlavičce X-Step-Up-Token). */
export async function getStepUpToken(action: string, code: string): Promise<string> {
  const r = await platformFetch<{ token: string }>("/auth/step-up", { json: { action, code } });
  return r.token;
}

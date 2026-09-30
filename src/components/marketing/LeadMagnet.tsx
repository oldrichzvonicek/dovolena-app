"use client";

import { useState, type FormEvent } from "react";
import { Container } from "./Container";

type Status = "idle" | "loading" | "success" | "error";

export function LeadMagnet() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/lead-magnet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus("error");
        setErrorMessage(data.error ?? "Něco se nepovedlo, zkuste to prosím znovu.");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Něco se nepovedlo, zkuste to prosím znovu.");
    }
  }

  return (
    <section className="font-dodio-sans">
      <Container className="pb-8 lg:pb-12">
        <div className="flex flex-col gap-4 rounded-dodio-lg bg-[#EAF3EF] p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:p-7">
          <div className="flex flex-col gap-1">
            <h3 className="m-0 font-dodio-display text-lg font-bold text-dodio-ink lg:text-xl">
              Ještě to řešíte v Excelu?
            </h3>
            <p className="m-0 max-w-[460px] text-sm leading-[21px] text-dodio-ink-muted">
              Dáme vám aspoň naši šablonu na evidenci pracovní doby, dovolené, sick days a home office pro
              rok 2027, ať v tom máte pořádek, než se rozhodnete.
            </p>
          </div>

          {status === "success" ? (
            <div className="flex h-11 items-center gap-2 text-sm font-medium text-dodio-teal-dark">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
                <circle cx="9" cy="9" r="9" fill="#E3F2EC" />
                <path d="M5.5 9.3l2.3 2.3 4.7-4.7" fill="none" stroke="#085041" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Šablona je na cestě k vám do e-mailu.
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <label htmlFor="lead-magnet-email" className="sr-only">
                E-mail
              </label>
              <input
                id="lead-magnet-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="vas@email.cz"
                className="h-11 flex-1 rounded-dodio-md border border-dodio-border bg-white px-4 text-sm text-dodio-ink placeholder:text-dodio-ink-muted sm:w-56"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="flex h-11 items-center justify-center whitespace-nowrap rounded-dodio-md bg-dodio-teal-dark px-5 text-sm font-semibold text-white disabled:opacity-70"
              >
                {status === "loading" ? "Odesílám…" : "Poslat šablonu"}
              </button>
            </form>
          )}
        </div>
        {status === "error" && (
          <p className="m-0 mt-2 text-sm text-dodio-danger-dark">{errorMessage}</p>
        )}
      </Container>
    </section>
  );
}

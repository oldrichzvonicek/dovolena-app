"use client";

import { useId, useState, type FormEvent } from "react";

type Status = "idle" | "loading" | "success" | "error";

interface TemplateEmailFormProps {
  buttonClassName?: string;
  inputClassName?: string;
  layoutClassName?: string;
}

export function TemplateEmailForm({
  buttonClassName = "",
  inputClassName = "",
  layoutClassName = "",
}: TemplateEmailFormProps) {
  const inputId = useId();
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

  if (status === "success") {
    return (
      <div className="flex h-11 items-center gap-2 text-sm font-medium text-dodio-teal-dark">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
          <circle cx="9" cy="9" r="9" fill="#E3F2EC" />
          <path
            d="M5.5 9.3l2.3 2.3 4.7-4.7"
            fill="none"
            stroke="#085041"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Šablona je na cestě k vám do e-mailu.
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className={`flex w-full flex-col gap-2 sm:flex-row ${layoutClassName}`}>
        <label htmlFor={inputId} className="sr-only">
          E-mail
        </label>
        <input
          id={inputId}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="vas@email.cz"
          className={
            inputClassName ||
            "h-11 flex-1 rounded-dodio-md border border-dodio-border bg-white px-4 text-sm text-dodio-ink placeholder:text-dodio-ink-muted sm:w-56"
          }
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className={
            buttonClassName ||
            "flex h-11 items-center justify-center whitespace-nowrap rounded-dodio-md bg-dodio-teal-dark px-5 text-sm font-semibold text-white disabled:opacity-70"
          }
        >
          {status === "loading" ? "Odesílám…" : "Poslat šablonu"}
        </button>
      </form>
      {status === "error" && <p className="m-0 mt-2 text-sm text-dodio-danger-dark">{errorMessage}</p>}
    </div>
  );
}

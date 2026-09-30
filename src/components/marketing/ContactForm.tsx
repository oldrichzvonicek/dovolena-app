"use client";

import { useId, useState, type FormEvent } from "react";

type Status = "idle" | "loading" | "success" | "error";

const INPUT_CLASS =
  "h-11 rounded-dodio-md border border-dodio-border bg-white px-3.5 text-sm text-dodio-ink placeholder:text-dodio-ink-muted";
const TEXTAREA_CLASS =
  "min-h-[140px] resize-y rounded-dodio-md border border-dodio-border bg-white px-3.5 py-3 text-sm text-dodio-ink placeholder:text-dodio-ink-muted";
const LABEL_CLASS = "text-sm font-medium text-dodio-ink";

export function ContactForm() {
  const nameId = useId();
  const emailId = useId();
  const messageId = useId();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
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
      <div className="flex items-center gap-2 rounded-dodio-md border border-dodio-border bg-white px-4 py-4 text-sm font-medium text-dodio-teal-dark">
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
        Děkujeme, zprávu jsme přijali a brzy se ozveme.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={nameId} className={LABEL_CLASS}>
          Jméno
        </label>
        <input
          id={nameId}
          type="text"
          required
          maxLength={200}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Jan Novák"
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={emailId} className={LABEL_CLASS}>
          E-mail
        </label>
        <input
          id={emailId}
          type="email"
          required
          maxLength={200}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="vas@email.cz"
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={messageId} className={LABEL_CLASS}>
          Zpráva
        </label>
        <textarea
          id={messageId}
          required
          maxLength={5000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Napište nám, s čím vám můžeme pomoct…"
          className={TEXTAREA_CLASS}
        />
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="flex h-11 items-center justify-center whitespace-nowrap rounded-dodio-md bg-dodio-teal-dark px-5 text-sm font-semibold text-white disabled:opacity-70"
      >
        {status === "loading" ? "Odesílám…" : "Odeslat zprávu"}
      </button>

      {status === "error" && <p className="m-0 text-sm text-dodio-danger-dark">{errorMessage}</p>}
    </form>
  );
}

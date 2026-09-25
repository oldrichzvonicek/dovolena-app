"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { sendHelpQuestion } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { cn, errorMessage } from "@/lib/utils";

/** "Napsat na HR/Podporu" — delivers the message as an in-app notification to the company's managers/admins. */
export function ContactSupportBox() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ text: string; error: boolean } | null>(null);

  async function send() {
    if (!message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const n = await sendHelpQuestion(message.trim());
      setResult(
        n > 0
          ? { text: "Úspěšně odesláno — HR se vám ozve.", error: false }
          : { text: "Ve firmě není nikdo, komu by zpráva mohla dorazit.", error: true }
      );
      if (n > 0) setMessage("");
    } catch (e) {
      setResult({ text: `Nepodařilo se odeslat: ${errorMessage(e)}`, error: true });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-display text-h2">Nenašli jste odpověď?</h2>
      <p className="mt-0.5 text-xs text-muted">Napište na HR / podporu — zpráva přijde manažerům a adminům vaší firmy jako notifikace.</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Váš dotaz…" aria-label="Váš dotaz"
        className="mt-3 w-full rounded border border-line bg-white p-3 text-sm"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className={cn("text-sm", result?.error ? "text-danger-dark" : "text-teal-dark")}>{result?.text}</span>
        <Button onClick={send} disabled={sending || !message.trim()}>
          <Send size={15} /> Odeslat
        </Button>
      </div>
    </div>
  );
}

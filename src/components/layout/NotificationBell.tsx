"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, MessageCircleQuestion, PalmtreeIcon, Undo2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  NotificationRow,
  NotificationType,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const typeMeta: Record<NotificationType, { icon: typeof Bell; className: string; href: string }> = {
  request_created: { icon: Bell, className: "bg-warning-light text-warning-dark", href: "/approvals" },
  request_approved: { icon: Check, className: "bg-teal-light text-teal-dark", href: "/requests" },
  request_rejected: { icon: X, className: "bg-danger-light text-danger", href: "/requests" },
  vacation_reminder: { icon: PalmtreeIcon, className: "bg-teal-light text-teal-dark", href: "/dashboard" },
  cancellation_requested: { icon: Undo2, className: "bg-warning-light text-warning-dark", href: "/approvals" },
  cancellation_resolved: { icon: Undo2, className: "bg-teal-light text-teal-dark", href: "/requests" },
  help_question: { icon: MessageCircleQuestion, className: "bg-violet-light text-violet-dark", href: "/help" },
};

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "právě teď";
  if (min < 60) return `před ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `před ${h} h`;
  return `před ${Math.floor(h / 24)} dny`;
}

export function NotificationBell() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [emailOn, setEmailOn] = useState(true);

  useEffect(() => {
    if (profile) setEmailOn(profile.email_notifications !== false);
  }, [profile]);

  async function toggleEmail() {
    if (!profile) return;
    const next = !emailOn;
    setEmailOn(next);
    await createClient().from("profiles").update({ email_notifications: next }).eq("id", profile.id);
  }

  async function load() {
    const data = await fetchNotifications();
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    if (!profile) return;
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!profile) return null;

  const unreadCount = items.filter((n) => !n.read_at).length;

  async function handleMarkAllRead() {
    if (!profile) return;
    await markAllNotificationsRead(profile.id);
    load();
  }

  async function handleItemClick(n: NotificationRow) {
    setOpen(false);
    if (!n.read_at) {
      await markNotificationRead(n.id);
      load();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded p-2 text-muted hover:bg-white hover:text-ink"
        aria-label={unreadCount > 0 ? `Notifikace, ${unreadCount} nepřečtených` : "Notifikace"}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-line bg-white shadow-[0_8px_30px_rgba(22,35,59,0.12)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-medium">Notifikace</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-teal-dark hover:underline">
                Označit vše jako přečtené
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && <div className="p-4 text-sm text-muted">Načítám…</div>}
            {!loading && items.length === 0 && <div className="p-4 text-sm text-muted">Zatím žádné notifikace.</div>}
            {items.map((n) => {
              const meta = typeMeta[n.type];
              const Icon = meta.icon;
              return (
                <Link
                  key={n.id}
                  href={meta.href}
                  onClick={() => handleItemClick(n)}
                  className={cn(
                    "flex items-start gap-2.5 border-b border-line px-4 py-3 last:border-0 hover:bg-paper",
                    !n.read_at && "bg-teal-light/30"
                  )}
                >
                  <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", meta.className)}>
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-xs text-muted">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-muted">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal" />}
                </Link>
              );
            })}
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-muted">
            Posílat upozornění také e-mailem
            <input type="checkbox" checked={emailOn} onChange={toggleEmail} className="h-3.5 w-3.5" />
          </label>
        </div>
      )}
    </div>
  );
}

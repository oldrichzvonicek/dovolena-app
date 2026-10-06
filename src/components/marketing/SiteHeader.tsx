"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { DodioLockup } from "./DodioLogo";
import { Container } from "./Container";
import { HamburgerIcon, CloseIcon } from "./icons";
import { APP_LOGIN_URL, NAV_LINKS, SIGNUP_URL, SOLUTIONS_MENU } from "@/lib/dodio-links";

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={className}>
      <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SolutionsDropdown() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-transparent p-0 text-[15px] font-medium text-dodio-ink hover:text-dodio-teal"
      >
        {SOLUTIONS_MENU.label}
        <ChevronIcon className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-10 mt-3 w-[440px] -translate-x-1/2 rounded-dodio-lg border border-dodio-border bg-white p-6 shadow-[0_24px_48px_-20px_rgba(44,44,42,0.30)]">
          <div className="grid grid-cols-2 gap-6">
            {SOLUTIONS_MENU.columns.map((col) => (
              <div key={col.heading} className="flex flex-col gap-2.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-dodio-ink-muted">
                  {col.heading}
                </div>
                <div className="flex flex-col gap-2">
                  {col.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      data-link-location="nav-menu"
                      className="text-[15px] font-medium text-dodio-ink no-underline hover:text-dodio-teal-dark"
                      onClick={() => setOpen(false)}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SolutionsAccordion({
  onNavigate,
  buttonRef,
}: {
  onNavigate: () => void;
  buttonRef?: RefObject<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between rounded-dodio-md bg-transparent px-2 py-3 text-left text-lg font-medium text-dodio-ink"
      >
        {SOLUTIONS_MENU.label}
        <ChevronIcon className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-5 px-2 pb-3 pt-1">
          {SOLUTIONS_MENU.columns.map((col) => (
            <div key={col.heading} className="flex flex-col gap-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-dodio-ink-muted">
                {col.heading}
              </div>
              {col.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  data-link-location="nav-menu-mobile"
                  onClick={onNavigate}
                  className="rounded-dodio-md py-2 text-base text-dodio-ink no-underline"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    firstLinkRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    // The menu overlay lives outside <header> on purpose: backdrop-blur
    // makes an element a containing block for fixed descendants, which
    // would shrink `fixed inset-0` down to the header's own (short) box
    // instead of the viewport.
    <>
      <header className="sticky top-0 z-50 border-b border-dodio-border bg-dodio-surface/95 backdrop-blur">
        <Container className="flex items-center justify-between py-3.5 lg:py-6">
          <a
            href="/"
            aria-label="Dodio – úvod"
            className="flex items-center gap-2 text-dodio-ink no-underline lg:gap-2.5"
          >
            <DodioLockup markSize={28} wordmarkClassName="text-[22px] lg:text-2xl tracking-tight" />
          </a>

          <nav aria-label="Hlavní menu" className="hidden items-center gap-9 text-[15px] font-medium lg:flex">
            <SolutionsDropdown />
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="text-dodio-ink no-underline hover:text-dodio-teal">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <a href={APP_LOGIN_URL} className="px-4.5 py-3 text-[15px] font-medium text-dodio-ink no-underline">
              Přihlásit se
            </a>
            <a
              href={SIGNUP_URL}
              className="rounded-dodio-md bg-dodio-teal-dark px-5 py-3 text-[15px] font-semibold text-white no-underline hover:bg-dodio-teal"
            >
              Vyzkoušet zdarma
            </a>
          </div>

          <button
            ref={toggleRef}
            type="button"
            aria-label="Otevřít menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-dodio-md border border-dodio-border lg:hidden"
          >
            <HamburgerIcon />
          </button>
        </Container>
      </header>

      {menuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex flex-col bg-dodio-surface lg:hidden"
        >
          <div className="flex items-center justify-between border-b border-dodio-border px-5 py-3.5">
            <DodioLockup markSize={28} wordmarkClassName="text-[22px]" />
            <button
              type="button"
              aria-label="Zavřít menu"
              onClick={() => {
                setMenuOpen(false);
                toggleRef.current?.focus();
              }}
              className="flex h-11 w-11 items-center justify-center rounded-dodio-md border border-dodio-border"
            >
              <CloseIcon />
            </button>
          </div>
          <nav aria-label="Hlavní menu" className="flex flex-col gap-1 overflow-y-auto px-5 py-6 text-lg font-medium">
            <SolutionsAccordion onNavigate={() => setMenuOpen(false)} buttonRef={firstLinkRef} />
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-dodio-md px-2 py-3 text-dodio-ink no-underline"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3 border-t border-dodio-border px-5 py-6">
            <a
              href={APP_LOGIN_URL}
              onClick={() => setMenuOpen(false)}
              className="rounded-dodio-md border border-dodio-border px-0 py-3.5 text-center text-base font-semibold text-dodio-ink no-underline"
            >
              Přihlásit se
            </a>
            <a
              href={SIGNUP_URL}
              onClick={() => setMenuOpen(false)}
              className="rounded-dodio-md bg-dodio-teal-dark px-0 py-3.5 text-center text-base font-semibold text-white no-underline"
            >
              Vyzkoušet zdarma
            </a>
          </div>
        </div>
      )}
    </>
  );
}

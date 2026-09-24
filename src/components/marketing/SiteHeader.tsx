"use client";

import { useEffect, useRef, useState } from "react";
import { DodioLockup } from "./DodioLogo";
import { Container } from "./Container";
import { HamburgerIcon, CloseIcon } from "./icons";
import { APP_LOGIN_URL, NAV_LINKS, SIGNUP_URL } from "@/lib/dodio-links";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

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
            href="#"
            aria-label="Dodio – úvod"
            className="flex items-center gap-2 text-dodio-ink no-underline lg:gap-2.5"
          >
            <DodioLockup markSize={28} wordmarkClassName="text-[22px] lg:text-2xl tracking-tight" />
          </a>

          <nav aria-label="Hlavní menu" className="hidden items-center gap-9 text-[15px] font-medium lg:flex">
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
          <nav aria-label="Hlavní menu" className="flex flex-col gap-1 px-5 py-6 text-lg font-medium">
            {NAV_LINKS.map((link, i) => (
              <a
                key={link.href}
                href={link.href}
                ref={i === 0 ? firstLinkRef : undefined}
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

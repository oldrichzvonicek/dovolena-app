import type { ReactNode } from "react";

/**
 * Content width per spec: max 1200px, 120px side margins on desktop, 20px
 * on mobile. Wrapping the whole thing at max-w-[1440px] keeps the 120px
 * gutters proportional up to the desktop artboard width, then centers.
 */
export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-[1440px] px-5 md:px-10 lg:px-[120px] ${className}`}>
      {children}
    </div>
  );
}

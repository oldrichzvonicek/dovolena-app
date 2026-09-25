import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dodio – správa firemních absencí na pár kliknutí",
  description: "Jednoduchá správa dovolených, sick days a home office pro malé a střední firmy.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Dodio" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F9D7C",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Inventario Nuevo Parket",
  description: "Herramienta interna de stock de Nuevo Parket",
  icons: {
    icon: "/branding/nuevo-parket-logo.png",
    shortcut: "/branding/nuevo-parket-logo.png",
    apple: "/branding/nuevo-parket-logo.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

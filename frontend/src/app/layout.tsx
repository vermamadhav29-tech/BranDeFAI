import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "BranDeFAI — AI Marketing Platform",
  description: "AI-powered marketing, on autopilot.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}

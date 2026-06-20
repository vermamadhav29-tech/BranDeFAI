import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import "../styles/typography.css";
import Providers from "@/components/Providers";
import ThemeToggle from "@/components/ui/ThemeToggle";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

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
    <html lang="en" className="h-full antialiased">
      <body className={`${font.variable} min-h-full flex flex-col bg-[#F5F7F9]`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('brandefai-theme');if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
        <Providers>
          {children}
        </Providers>
        <ThemeToggle />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              fontFamily: "var(--font-sans)",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
            },
            classNames: {
              success: "border-l-4 border-l-green-500",
              error: "border-l-4 border-l-red-500",
              info: "border-l-4 border-l-blue-500",
            },
          }}
        />
      </body>
    </html>
  );
}

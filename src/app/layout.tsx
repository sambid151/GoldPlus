import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getSite } from "@/lib/site";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export function generateMetadata(): Metadata {
  const { location, estimate } = getSite();
  return {
    title: `GoldPulse — ${location} gold ${estimate ? "spot estimate" : "rates"}`,
    description: `Indicative 24K, 22K and 18K gold ${estimate ? "spot estimates" : "rates"} per gram for ${location}, with history, market factors and a jewellery price calculator.`,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#07130c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-bg px-4 py-2 font-medium text-brand-strong shadow-card focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GlobalWinPopup } from "@/components/global-win-popup";
import { AutoTradeEngine } from "@/components/auto-trade-engine";
import { LiveTradeEngine } from "@/components/live-trade-engine";
import { LanguageProvider } from "@/components/language-provider";
import { GoogleTranslateBridge } from "@/components/google-translate-bridge";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atlas Capital",
  description: "Atlas Capital client portal for account activity, deposits, withdrawals, and subscriptions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          {children}
          <GoogleTranslateBridge />
        </LanguageProvider>
        <AutoTradeEngine />
        <LiveTradeEngine />
        <GlobalWinPopup />
      </body>
    </html>
  );
}

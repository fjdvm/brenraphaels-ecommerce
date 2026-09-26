import type { Metadata } from "next";
import {
  Geist_Mono,
  Hanken_Grotesk,
  Libre_Caslon_Text,
} from "next/font/google";
import { AccountNav } from "@/components/shared/account-nav";
import { Footer } from "@/components/shared/footer";
import { Header } from "@/components/shared/header";
import "./globals.css";

const libreCaslon = Libre_Caslon_Text({
  variable: "--font-libre-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Bren Raphael's Ube Jam & Halaya",
    template: "%s | Bren Raphael's Ube Jam & Halaya",
  },
  description:
    "Authentic artisanal Filipino Ube Jam & Halaya handcrafted with real purple yam.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${libreCaslon.variable} ${hankenGrotesk.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header
          desktopAccount={
            <AccountNav className="hidden items-center gap-5 text-sm font-semibold text-on-surface-variant md:flex" />
          }
          mobileAccount={
            <AccountNav className="flex flex-col gap-3 border-t border-outline-variant/60 pt-3 text-sm font-semibold text-on-surface" />
          }
        />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

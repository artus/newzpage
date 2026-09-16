import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const masthead = localFont({
  src: "../fonts/traditional-gothic.ttf",
  variable: "--font-masthead",
  weight: "400",
  display: "swap",
});

const headline = localFont({
  src: [
    { path: "../fonts/playfair-display-normal-400-900.woff2", weight: "400 900", style: "normal" },
    { path: "../fonts/playfair-display-italic-400-900.woff2", weight: "400 900", style: "italic" },
  ],
  variable: "--font-headline",
  display: "swap",
});

const body = localFont({
  src: [
    { path: "../fonts/libre-caslon-text-normal-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/libre-caslon-text-normal-700.woff2", weight: "700", style: "normal" },
    { path: "../fonts/libre-caslon-text-italic-400.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://newz.page"),
  title: "Newzpage",
  description: "Your RSS feeds, typeset as the front page of an old newspaper.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${masthead.variable} ${headline.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "@/components/layout/Providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | TableGH",
    default: "TableGH — Reserve Your Table in Accra",
  },
  description:
    "Discover and book the best restaurants in Accra. From fine dining in Cantonments to chop bars in Osu — your table is waiting.",
  keywords: [
    "restaurants Accra",
    "book restaurant Ghana",
    "Accra dining",
    "restaurant reservations Ghana",
    "TableGH",
  ],
  metadataBase: new URL(
    process.env["NEXT_PUBLIC_APP_URL"] ?? "https://tablegh.com"
  ),
  openGraph: {
    siteName: "TableGH",
    locale: "en_GH",
    type: "website",
  },
  manifest: "/manifest.json",
  themeColor: "#0F7B5A",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F7B5A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Fraunces serif for headings */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className={`${inter.variable} font-sans antialiased`}>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}

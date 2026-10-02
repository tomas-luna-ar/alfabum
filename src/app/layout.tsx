import type { Metadata, Viewport } from "next";
import { Geist, Lilita_One } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const lilita = Lilita_One({
  variable: "--font-lilita",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alfabum — Mi álbum de alfajores",
  description: "Sacale una foto a cada alfajor que comés, puntualo y completá tu álbum de figuritas.",
  appleWebApp: { capable: true, title: "Alfabum", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#7c4a1e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${lilita.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

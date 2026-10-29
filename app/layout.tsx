import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: { default: "Sparkle Beauty & Cosmetics", template: "%s · Sparkle Beauty & Cosmetics" },
  description: "Wigs, braids, extensions, cosmetics, skincare and perfumes. Shop online or visit us on Moi Avenue, Nairobi.",
};

export const viewport: Viewport = { themeColor: "#d0237a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}

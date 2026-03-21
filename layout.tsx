import type { Metadata } from "next";
import { DM_Serif_Display, DM_Sans } from "next/font/google";
import "./globals.css";

const dmSerifDisplay = DM_Serif_Display({
  weight: '400',
  subsets: ["latin"],
  variable: '--font-display',
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: "MidtownMoney",
  description: "AI-Powered Cold Call Training",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSerifDisplay.variable} ${dmSans.variable}`}>
      <body className="bg-cream-50 font-body text-brand-900 antialiased">{children}</body>
    </html>
  );
}

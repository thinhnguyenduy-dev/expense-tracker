import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expense Tracker - Personal Finance Management",
  description: "Track your expenses, manage budgets, and visualize spending patterns with our modern expense management application. Features include category management, dashboard analytics, and secure authentication.",
  keywords: ["expense tracker", "personal finance", "budget management", "expense management", "money tracking"],
  authors: [{ name: "Expense Tracker Team" }],
  openGraph: {
    title: "Expense Tracker - Personal Finance Management",
    description: "Track your expenses, manage budgets, and visualize spending patterns with our modern expense management application.",
    type: "website",
    locale: "en_US",
    siteName: "Expense Tracker",
  },
  twitter: {
    card: "summary_large_image",
    title: "Expense Tracker - Personal Finance Management",
    description: "Track your expenses, manage budgets, and visualize spending patterns.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

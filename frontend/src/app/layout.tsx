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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Expense Tracker",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  }
};

export const viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

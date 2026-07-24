import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";
// Self-hosted Devanagari webfont (400–700). Bundled locally rather than
// fetched from Google Fonts at build time — no external network dependency,
// and it renders identically regardless of which locale is active, since
// member bios/posts can mix scripts even on the English view.
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/500.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "@fontsource/noto-sans-devanagari/700.css";
import { AppProvider } from "@/lib/store";
import AppShell from "@/components/AppShell";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";

// Inter (variable, self-hosted — same no-external-fetch rule as the Devanagari
// font above). Exposes --font-latin, consumed by the html font stack in
// globals.css. Latin UI text renders in Inter; Devanagari falls through to Noto.
const inter = localFont({
  src: "../fonts/inter-var.woff2",
  variable: "--font-latin",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BridgeLink",
  description: "The invite-only professional network for the US–Nepal corridor.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const messages = await getMessages();

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Apply stored theme/font before first paint — no light-then-dark flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <AppProvider>
              <AppShell>{children}</AppShell>
            </AppProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

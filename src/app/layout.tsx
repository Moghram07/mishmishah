import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans, Cairo } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { themeInitScript } from "@/lib/theme/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const arabic = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-arabic",
  display: "swap",
});

/** Arabic first, English second: the tab and link previews come before the page picks a language. */
const TITLE = "مشمشة — شاهد القماش بمقاسه الحقيقي قبل أن تقرّر | Mishmishah";
const DESCRIPTION =
  "اختر القماش وشاهده على فستان أو ثوب بمقاسه الحقيقي، قبل أن تقرّر. " +
  "Pick a fabric and see it on a dress or a thobe, at its true size, before you decide.";

export const metadata: Metadata = {
  metadataBase: new URL("https://mishmishah.app"),
  title: {
    default: TITLE,
    template: "%s · مشمشة",
  },
  description: DESCRIPTION,
  applicationName: "Mishmishah",
  keywords: [
    "أقمشة",
    "قماش",
    "معاينة الأقمشة",
    "تفصيل",
    "ثوب",
    "فستان",
    "fabric",
    "fabric visualizer",
    "true size",
    "thobe",
    "dress",
  ],
  authors: [{ name: "Mishmishah" }],
  openGraph: {
    type: "website",
    locale: "ar_SA",
    alternateLocale: "en_US",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "مشمشة | Mishmishah",
  },
  twitter: { card: "summary_large_image", title: "مشمشة | Mishmishah" },
  icons: { icon: "/favicon.png", apple: "/logo-apricot.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF7F0" },
    { media: "(prefers-color-scheme: dark)", color: "#141110" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${inter.variable} ${display.variable} ${arabic.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}

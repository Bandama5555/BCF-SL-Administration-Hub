import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthGuard } from "@/components/AuthGuard";
import { ShellWrapper } from "@/components/ShellWrapper";
import { VisitorTracker } from "@/components/analytics/VisitorTracker";
import { PrivacyNoticeBanner } from "@/components/analytics/PrivacyNoticeBanner";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F7FF" },
    { media: "(prefers-color-scheme: dark)", color: "#100826" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "BCF-SL Administration Hub",
    template: "%s | BCF-SL Admin Hub",
  },
  description:
    "The unified administration portal for Bandama Charity Foundation Sierra Leone — managing staff, donors, finance, programmes, procurement, and more.",
  keywords: [
    "BCF-SL",
    "Bandama Charity Foundation",
    "Sierra Leone",
    "NGO administration",
    "HR management",
    "donor management",
  ],
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* Favicons */}
        <link rel="icon" type="image/png" href="/icon.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />

        {/* Material Symbols — needed by existing Stitch apps AND our shell */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          {/* Global Visitor Analytics Beacon & Privacy Notice Banner */}
          <VisitorTracker />
          <PrivacyNoticeBanner />

          {/*
            AuthGuard checks sessionStorage and redirects to /login if unauthenticated.
            ShellWrapper renders the sidebar+topbar Shell only for non-login routes.
          */}
          <AuthGuard>
            <ShellWrapper>{children}</ShellWrapper>
          </AuthGuard>
        </ThemeProvider>
      </body>
    </html>
  );
}


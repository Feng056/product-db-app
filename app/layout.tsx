import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import ShutdownBanner from "@/components/ShutdownBanner";
import AutoExportCheck from "@/components/AutoExportCheck";
import SubscribeJobIndicator from "@/components/SubscribeJobIndicator";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import RouteProgress from "@/components/RouteProgress";
import TapFeedback from "@/components/TapFeedback";

// 首屏前应用主题，避免闪烁
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export const metadata: Metadata = {
  title: "产品资料库",
  description: "多用户产品资料管理",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "产品资料库",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <RouteProgress />
        <TapFeedback />
        <ThemeProvider>
          <AutoExportCheck />
          <ShutdownBanner />
          <SubscribeJobIndicator />
          {children}
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

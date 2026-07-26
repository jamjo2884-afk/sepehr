import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';
import { RouteGuard } from '@/components/common/route-guard';

const vazirmatn = localFont({
  src: '../../node_modules/vazirmatn/fonts/variable/Vazirmatn[wght].ttf',
  variable: '--font-vazirmatn',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'مدیا اواس | سیستم‌عامل رسانه‌ای هوشمند',
  description: 'سیستم‌عامل رسانه‌ای مبتنی بر هوش مصنوعی',
  themeColor: '#0a0e1a',
  viewport: {
    width: 'device-width',
    initialScale: 1,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${vazirmatn.variable} font-sans`}>
        <Providers>
          <RouteGuard>{children}</RouteGuard>
        </Providers>
      </body>
    </html>
  );
}

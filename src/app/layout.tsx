import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { RouteGuard } from '@/components/common/route-guard';

const vazirmatn = localFont({
  src: '../../node_modules/vazirmatn/fonts/variable/Vazirmatn[wght].ttf',
  variable: '--font-vazirmatn',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Media Deck | پلتفرم هوشمند مدیریت و تحلیل رسانه',
  description: 'مرکز فرماندهی هوشمند رسانه — مدیریت، تحلیل و مانیتورینگ رسانه',
  themeColor: '#071426',
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
      <body className={`${vazirmatn.variable} ${inter.variable} font-sans`}>
        <Providers>
          <RouteGuard>{children}</RouteGuard>
        </Providers>
      </body>
    </html>
  );
}

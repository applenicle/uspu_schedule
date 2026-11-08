import './globals.css';

export const metadata = {
  title: 'Расписание УрГПУ',
  description: 'Удобное расписание групп и преподавателей УрГПУ',
  applicationName: 'Расписание УрГПУ',
  icons: { icon: '/icon.png', apple: '/apple-icon.png' },
};

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return <html lang="ru" suppressHydrationWarning><body>{children}</body></html>;
}

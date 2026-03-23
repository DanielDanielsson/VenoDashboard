import type { Metadata } from 'next';
import '../styles/globals.css';

const themeInitScript = `
(() => {
  try {
    const root = document.documentElement;
    const stored = localStorage.getItem('pulse-theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored === 'light' || stored === 'dark' ? stored : systemDark ? 'dark' : 'light';
    root.classList.toggle('theme-dark', theme === 'dark');
    root.style.colorScheme = theme;
  } catch {
    document.documentElement.classList.add('theme-dark');
    document.documentElement.style.colorScheme = 'dark';
  }
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://app.veno.local'),
  title: {
    default: 'VenoDashboard',
    template: '%s | VenoDashboard'
  },
  description: 'Private dashboard for Veno API operations, glucose monitoring, and app key management.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-image-preview': 'none',
      'max-snippet': -1,
      'max-video-preview': -1
    }
  },
  openGraph: {
    title: 'VenoDashboard',
    description: 'Private dashboard for Veno API operations and glucose monitoring.',
    type: 'website'
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="theme-dark" suppressHydrationWarning>
      <head>
        <link as="image/svg+xml" href="/static_assets/iconSprite.svg" rel="preload" />
      </head>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}

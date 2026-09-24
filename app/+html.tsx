import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { BRAND } from '@/constants/brand';

const DESCRIPTION = 'Recipes, menus and staff training for bars.';
const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || '').replace(/\/$/, '');

// Matches the app's light and dark backgrounds, so there is no white flash
// before the app loads in dark mode.
const BACKGROUND_CSS = `
body { background-color: #F9F9FB; }
@media (prefers-color-scheme: dark) { body { background-color: #161618; } }
`;

/** The HTML shell for every web page (static export only; not used on native). */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* The page title is set with expo-router's Head in app/_layout.tsx: its
            head manager adds its own <title>, which would otherwise win. */}
        <meta name="description" content={DESCRIPTION} />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F9F9FB" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#161618" />

        {/* Home-screen install */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content={BRAND.productName} />

        {/* Link previews */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={BRAND.productName} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image" content={`${SITE_URL}/icon-512.png`} />
        <meta name="twitter:card" content="summary" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BACKGROUND_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

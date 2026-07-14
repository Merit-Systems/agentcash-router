import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'AgentCash Router · Fortune Demo',
  description: 'Pay-per-call fortune API on x402 and MPP, deployed in one click to Vercel.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
          background: '#0a0a0a',
          color: '#ededed',
          minHeight: '100vh',
        }}
      >
        {children}
      </body>
    </html>
  );
}

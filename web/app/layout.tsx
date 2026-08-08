import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'SSH Street Fighter — Sprites',
  description: 'Sprite gallery + regeneration admin for the SSH Street Fighter game.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

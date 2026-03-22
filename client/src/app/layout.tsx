import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'NEPSE Analyzer',
  description: 'nepse analyzer ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#0a0e1a' }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

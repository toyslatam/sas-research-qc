import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ProjectProvider } from '@/components/ProjectContext';
import { ThemeProvider } from '@/platform/components/ThemeProvider';
import { AuthProvider } from '@/platform/auth/AuthProvider';
import { LayoutRouter } from '@/platform/components/LayoutRouter';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SAS RESEARCH — Plataforma modular',
  description: 'Plataforma modular de investigación de mercado e inteligencia competitiva',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <ThemeProvider>
          <AuthProvider>
            <ProjectProvider>
              <LayoutRouter>{children}</LayoutRouter>
            </ProjectProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

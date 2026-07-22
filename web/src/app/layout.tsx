import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ProjectProvider } from '@/components/ProjectContext';
import { ThemeProvider } from '@/platform/components/ThemeProvider';
import { AuthProvider } from '@/platform/auth/AuthProvider';
import { LayoutRouter } from '@/platform/components/LayoutRouter';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
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

const themeInitScript = `(function(){try{var t=localStorage.getItem('sas-research-theme')||'dark';var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;var el=document.documentElement;el.classList.remove('dark','light');el.classList.add(r);el.style.colorScheme=r;}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen font-sans">
        <ThemeProvider>
          <QueryProvider>
            <TooltipProvider delayDuration={200}>
              <AuthProvider>
                <ProjectProvider>
                  <LayoutRouter>{children}</LayoutRouter>
                  <Toaster />
                </ProjectProvider>
              </AuthProvider>
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

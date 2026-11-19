import type { Metadata } from 'next';
import { Newsreader, Work_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import FloatingChatWidget from '@/components/FloatingChatWidget';

// Forest/brass identity from the landing redesign, loaded once here instead
// of per-page — app/page.tsx no longer needs its own font instances, it
// just inherits these CSS variables like everything else.
const display = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});
const body = Work_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});
const label = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-label',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Corpus.ai : vos documents travaillent, pas vous',
  description:
    "Corpus.ai analyse vos contrats, factures et devis, qualifie vos leads avant le premier appel, et répond à vos questions depuis vos documents internes. Trois outils, un seul corpus de documents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable} ${label.variable}`}>
      <body className="font-sans">
        {children}
        <FloatingChatWidget />
      </body>
    </html>
  );
}

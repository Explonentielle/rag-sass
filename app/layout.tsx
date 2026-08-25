import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import FloatingChatWidget from '@/components/FloatingChatWidget';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Corpus.ai : le chatbot qui connaît vos documents par cœur',
  description:
    "Uploadez vos scripts, procédures et FAQ. Corpus.ai répond à vos équipes et vos clients en citant ses sources, fidèle à vos documents et sans approximation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="font-sans">
        {children}
        <FloatingChatWidget />
      </body>
    </html>
  );
}

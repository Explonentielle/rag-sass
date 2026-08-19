import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RAG SaaS',
  description: 'Chatbot RAG sur vos documents internes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container, Card } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';

const PAGES: Record<string, string> = {
  'mentions-legales': 'Mentions légales',
  confidentialite: 'Politique de confidentialité',
  cgu: "Conditions générales d'utilisation",
};

export default function LegalPage({ params }: { params: { slug: string } }) {
  const title = PAGES[params.slug];
  if (!title) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <Container className="flex h-16 items-center">
          <Link href="/">
            <Logo />
          </Link>
        </Container>
      </header>
      <Container className="max-w-2xl py-16">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <Card className="mt-6 p-6">
          <p className="text-sm leading-relaxed text-slate-600">
            Cette page est un placeholder. Le contenu juridique réel (identité de l'éditeur,
            hébergeur, traitement des données personnelles, conditions contractuelles...) doit
            être rédigé, idéalement avec l'aide d'un professionnel du droit, avant toute ouverture
            publique du service.
          </p>
        </Card>
      </Container>
    </div>
  );
}

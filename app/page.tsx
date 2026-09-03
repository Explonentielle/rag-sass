import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ButtonLink } from '@/components/ui/Button';
import { Card, Container } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { Icon, IconBadge, ICONS } from '@/components/icons';

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col">
      <Nav isLoggedIn={!!user} />
      <Hero isLoggedIn={!!user} />
      <TrustBar />
      <HowItWorks />
      <Features />
      <UseCases />
      <Pricing isLoggedIn={!!user} />
      <Testimonials />
      <Faq />
      <FinalCta isLoggedIn={!!user} />
      <Footer />
    </div>
  );
}

function Nav({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="#comment-ca-marche" className="hover:text-slate-900">
            Comment ça marche
          </a>
          <a href="#fonctionnalites" className="hover:text-slate-900">
            Fonctionnalités
          </a>
          <a href="#cas-usage" className="hover:text-slate-900">
            Cas d'usage
          </a>
          <a href="#tarifs" className="hover:text-slate-900">
            Tarifs
          </a>
        </nav>
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <ButtonLink href="/dashboard" size="sm">
              Aller au dashboard
            </ButtonLink>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block"
              >
                Connexion
              </Link>
              <ButtonLink href="/signup" size="sm">
                Essayer gratuitement
              </ButtonLink>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}

function Hero({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-brand-950">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(84,116,199,0.35), transparent)',
        }}
      />
      <Container className="relative grid gap-12 py-16 md:grid-cols-2 md:items-center md:py-24">
        <div>
          <p className="mb-4 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-100">
            Pilote gratuit pour les premières entreprises
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Le chatbot qui connaît vos documents par cœur.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-brand-100">
            Uploadez vos scripts de vente, procédures et FAQ. Corpus.ai répond à vos équipes et
            vos clients en citant ses sources, fidèle à vos documents et sans approximation.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <ButtonLink href={isLoggedIn ? '/dashboard' : '/signup'} size="lg">
              {isLoggedIn ? 'Aller au dashboard' : 'Commencer gratuitement'}
            </ButtonLink>
            <a
              href="#comment-ca-marche"
              className="text-sm font-medium text-brand-100 hover:text-white"
            >
              Voir comment ça marche →
            </a>
          </div>
        </div>
        <ChatMockup />
      </Container>
    </section>
  );
}

function ChatMockup() {
  return (
    <Card className="border-white/10 bg-white p-4 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-xs font-medium text-slate-400">Assistant commercial</span>
      </div>
      <div className="space-y-3 pt-4">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-lg bg-brand-800 px-3 py-2 text-sm text-white">
            Le client trouve que le prix est trop élevé, je réponds quoi ?
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">
            Ne baisse jamais le prix directement. Reformule la valeur perçue : demande-lui ce qui
            compte le plus dans sa décision, puis compare au coût de l'inaction.
            <div className="mt-2 border-t border-slate-300/60 pt-1 text-xs text-slate-500">
              Sources : script-objections.pdf
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function TrustBar() {
  const items = [
    {
      icon: ICONS.shield,
      title: 'Données isolées',
      body: 'Chaque organisation est cloisonnée au niveau base de données.',
    },
    {
      icon: ICONS.quote,
      title: 'Réponses sourcées',
      body: 'Chaque réponse pointe vers le document utilisé.',
    },
    {
      icon: ICONS.bolt,
      title: 'Indexation rapide',
      body: "De l'upload au chatbot prêt, en quelques minutes.",
    },
  ];

  return (
    <section className="border-b border-slate-200 bg-white py-12">
      <Container>
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
          Pensé pour les entreprises qui s'appuient sur une documentation métier
        </p>
        <div className="mx-auto mt-10 grid max-w-4xl gap-8 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <Icon className="h-4 w-4">{item.icon}</Icon>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: '01',
      icon: ICONS.upload,
      title: 'Uploadez vos documents',
      body: 'Scripts de vente, procédures internes, FAQ : PDF, Word ou texte brut.',
    },
    {
      n: '02',
      icon: ICONS.index,
      title: 'Indexation automatique',
      body: 'Vos documents sont découpés, vectorisés et indexés en quelques minutes.',
    },
    {
      n: '03',
      icon: ICONS.chat,
      title: 'Vos équipes posent leurs questions',
      body: 'Réponses instantanées et sourcées, strictement fondées sur vos documents.',
    },
  ];

  return (
    <section id="comment-ca-marche" className="bg-slate-50 py-16">
      <Container>
        <SectionHeading
          eyebrow="Comment ça marche"
          title="De vos documents à un assistant fiable, en 3 étapes"
        />
        <div className="relative mt-10 grid gap-8 md:grid-cols-3">
          <div className="absolute left-0 right-0 top-5 hidden h-px bg-slate-200 md:block" />
          {steps.map((s) => (
            <Card key={s.n} className="relative p-6">
              <div className="flex items-center gap-3">
                <IconBadge>{s.icon}</IconBadge>
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">
                  Étape {s.n}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: ICONS.quote,
      title: 'Réponses toujours sourcées',
      body: 'Chaque réponse cite les documents utilisés, vos équipes vérifient en un clic.',
    },
    {
      icon: ICONS.checkCircle,
      title: 'Aucune approximation',
      body: "Si une information ne figure pas dans vos documents, l'assistant le signale clairement plutôt que de deviner.",
    },
    {
      icon: ICONS.search,
      title: 'Recherche hybride',
      body: 'Combine recherche par mots-clés et recherche sémantique pour ne rien manquer.',
    },
    {
      icon: ICONS.shield,
      title: 'Multi-organisation',
      body: 'Isolation stricte des données entre organisations, avec sécurité au niveau base de données.',
    },
    {
      icon: ICONS.document,
      title: 'Templates prêts à l\'emploi',
      body: 'Vente, support client, immobilier, secrétariat médical : un point de départ par secteur, personnalisable en un clic.',
    },
    {
      icon: ICONS.bolt,
      title: 'Réponses en streaming',
      body: "Génération rapide, mot par mot, propulsée par OpenAI.",
    },
  ];

  return (
    <section id="fonctionnalites" className="bg-brand-950 py-16">
      <Container className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:gap-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-300">
            Fonctionnalités
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Tout ce qu'il faut, rien de superflu
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-brand-200">
            Pas de fonctionnalités gadget : chaque point ci-contre répond à une exigence concrète
            pour un assistant utilisable en production par une équipe.
          </p>
        </div>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="flex gap-3">
              <IconBadge tone="white" spacing="mt-0.5">
                {f.icon}
              </IconBadge>
              <div>
                <h3 className="font-semibold text-white">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-brand-200">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function UseCases() {
  const cases = [
    {
      icon: ICONS.briefcase,
      title: 'Vente & relation client',
      body: 'Argumentaires, traitement des objections, scripts : vos équipes retrouvent la bonne réponse en quelques secondes.',
    },
    {
      icon: ICONS.headset,
      title: 'Support client',
      body: 'FAQ et procédures centralisées : des réponses cohérentes et sourcées, sans réinventer la roue à chaque demande.',
    },
    {
      icon: ICONS.book,
      title: 'Formation & onboarding',
      body: 'Un point d\'accès unique à votre documentation interne pour vos nouvelles recrues, disponible à toute heure.',
    },
  ];

  return (
    <section id="cas-usage" className="bg-slate-50 py-16">
      <Container>
        <SectionHeading
          eyebrow="Cas d'usage"
          title="Utile partout où vos équipes s'appuient sur de la documentation"
        />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {cases.map((c) => (
            <Card key={c.title} className="p-8">
              <IconBadge>{c.icon}</IconBadge>
              <h3 className="text-lg font-semibold text-slate-900">{c.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{c.body}</p>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Pricing({ isLoggedIn }: { isLoggedIn: boolean }) {
  const plans = [
    {
      name: 'Pilote',
      price: '0€',
      period: '',
      description: "Pour tester sur vos propres documents avant de généraliser.",
      features: ['1 chatbot', "Jusqu'à 20 documents", '100 messages / mois', 'Support par email'],
      cta: 'Commencer gratuitement',
      highlighted: false,
    },
    {
      name: 'Pro',
      price: '49€',
      period: '/ mois',
      description: 'Pour une équipe qui déploie son assistant en continu.',
      features: [
        "Jusqu'à 5 chatbots",
        'Documents illimités',
        '1 500 messages / mois',
        'Support prioritaire',
      ],
      cta: 'Commencer gratuitement',
      highlighted: true,
    },
    {
      name: 'Entreprise',
      price: 'Sur devis',
      period: '',
      description: 'Pour plusieurs équipes, avec des besoins spécifiques.',
      features: [
        'Chatbots illimités',
        'Volumes sur mesure',
        'Accompagnement dédié',
        'Hébergement dédié possible',
      ],
      cta: 'Nous contacter',
      highlighted: false,
    },
  ];

  return (
    <section id="tarifs" className="bg-white py-16">
      <Container>
        <SectionHeading eyebrow="Tarifs" title="Des tarifs simples, qui évoluent avec vous" />
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-500">
          Tarifs indicatifs pour la phase pilote, susceptibles d'évoluer.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`flex flex-col p-8 ${
                plan.highlighted ? 'border-brand-600 ring-1 ring-brand-600' : ''
              }`}
            >
              {plan.highlighted && (
                <span className="mb-4 inline-flex w-fit items-center rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800">
                  Le plus populaire
                </span>
              )}
              <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight text-slate-900">
                  {plan.price}
                </span>
                {plan.period && <span className="text-sm text-slate-500">{plan.period}</span>}
              </div>
              <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-600">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 text-brand-600">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <ButtonLink
                href={isLoggedIn ? '/dashboard' : '/signup'}
                variant={plan.highlighted ? 'primary' : 'secondary'}
                className="mt-8 w-full"
              >
                {plan.cta}
              </ButtonLink>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Testimonials() {
  // Placeholder quotes, replace with real pilot client feedback before launch.
  const quotes = [
    {
      quote: 'Outil très utile, on a gagné un temps précieux sur le support client.',
      name: 'John Doe',
      role: 'CEO, Acme Corp',
    },
    {
      quote: "Nos commerciaux retrouvent l'argumentaire en quelques secondes, ça change tout en appel.",
      name: 'Jane Doe',
      role: 'Responsable des ventes, Exemple SAS',
    },
    {
      quote: 'Simple à mettre en place, et les réponses citent toujours la bonne procédure.',
      name: 'Paul Martin',
      role: 'Support client, Entreprise Test',
    },
  ];

  return (
    <section className="bg-slate-50 py-16">
      <Container>
        <SectionHeading eyebrow="Avis" title="Ce qu'en disent nos premiers utilisateurs" />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {quotes.map((t, i) => (
            <Card key={i} className="border-dashed p-6">
              <p className="text-sm italic leading-relaxed text-slate-500">{t.quote}</p>
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-sm font-medium text-slate-700">{t.name}</p>
                <p className="text-xs text-slate-400">{t.role}</p>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Faq() {
  const items = [
    {
      q: 'Mes documents servent-ils à entraîner un modèle ?',
      a: "Non. Vos documents ne sont utilisés que pour générer les réponses de votre propre chatbot, jamais pour entraîner un modèle ni partagés avec d'autres organisations.",
    },
    {
      q: 'Mes données sont-elles isolées des autres clients ?',
      a: "Oui. Chaque organisation est strictement isolée au niveau de la base de données (Row Level Security) : aucune organisation ne peut accéder aux données d'une autre.",
    },
    {
      q: 'Quels formats de documents sont supportés ?',
      a: 'PDF avec texte natif, Word (.docx) et texte brut (.txt) pour le moment. Les PDF scannés (sans texte extractible) ne sont pas encore supportés.',
    },
    {
      q: 'Puis-je annuler à tout moment ?',
      a: "Oui, sans engagement ni préavis.",
    },
    {
      q: 'Que se passe-t-il si je dépasse mon quota de messages ?',
      a: "[À confirmer] L'idée est de vous prévenir pour ajuster votre forfait plutôt que de couper le service brutalement.",
    },
  ];

  return (
    <section className="bg-white py-16">
      <Container className="max-w-3xl">
        <SectionHeading eyebrow="Questions fréquentes" title="Tout ce qu'on nous demande" />
        <div className="mt-8 divide-y divide-slate-200">
          {items.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">
                {item.q}
                <span className="ml-4 text-slate-400 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

function FinalCta({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="bg-brand-950 py-14">
      <Container className="text-center">
        <h2 className="text-3xl font-semibold text-white">Prêt à essayer sur vos documents ?</h2>
        <p className="mx-auto mt-3 max-w-xl text-brand-100">
          Pilote gratuit, sans engagement, pour les premières entreprises.
        </p>
        <div className="mt-8">
          <ButtonLink href={isLoggedIn ? '/dashboard' : '/signup'} size="lg">
            {isLoggedIn ? 'Aller au dashboard' : 'Commencer gratuitement'}
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-10">
      <Container className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <Logo />
        <nav className="flex items-center gap-6 text-sm text-slate-400">
          <Link href="/legal/mentions-legales" className="hover:text-slate-600">
            Mentions légales
          </Link>
          <Link href="/legal/confidentialite" className="hover:text-slate-600">
            Confidentialité
          </Link>
          <Link href="/legal/cgu" className="hover:text-slate-600">
            CGU
          </Link>
        </nav>
        <p className="text-sm text-slate-400">© {new Date().getFullYear()} Corpus.ai</p>
      </Container>
    </footer>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{title}</h2>
    </div>
  );
}

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import styles from './landing.module.css';

// Fonts are loaded once, globally, in app/layout.tsx (--font-display,
// --font-body, --font-label). This page just consumes those variables via
// landing.module.css, same as every other page in the app now.

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="1em" height="1em">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className={styles.page}>
      <Nav isLoggedIn={!!user} />
      <Hero isLoggedIn={!!user} />
      <TrustBar />
      <HowItWorks />
      <Features />
      <Catalogue />
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
    <header className={styles.nav}>
      <div className={`${styles.wrap} ${styles.navInner}`}>
        <Link href="/" className={styles.logo}>
          <span className={styles.mark}>C</span>
          Corpus.ai
        </Link>
        <nav className={styles.navLinks}>
          <a href="#comment-ca-marche">Comment ça marche</a>
          <a href="#fonctionnalites">Fonctionnalités</a>
          <a href="#catalogue">Catalogue</a>
          <a href="#tarifs">Tarifs</a>
        </nav>
        <div className={styles.navActions}>
          {isLoggedIn ? (
            <Link href="/dashboard" className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`}>
              Aller au dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className={styles.navLogin}>
                Connexion
              </Link>
              <Link href="/signup" className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`}>
                Essayer gratuitement
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header className={styles.hero}>
      <div className={`${styles.wrap} ${styles.heroGrid}`}>
        <div>
          <span className={styles.heroBadge}>
            <CheckIcon />
            Pilote gratuit et sans engagement
          </span>
          <h1 className={styles.heroTitle}>
            De vos documents à un assistant qui{' '}
            <span className={styles.accent}>répond</span>
          </h1>
          <p className={styles.heroLede}>
            Corpus.ai transforme vos documents, notes et procédures en un assistant qui vous
            répond instantanément, seul ou en équipe, pour vous ou pour vos clients. Un forfait
            simple, aucun jargon technique, sources citées à chaque réponse.
          </p>
          <div className={styles.heroCtas}>
            <Link
              href={isLoggedIn ? '/dashboard' : '/signup'}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              {isLoggedIn ? 'Aller au dashboard' : 'Commencer gratuitement'}
            </Link>
            <a href="#comment-ca-marche" className={`${styles.btn} ${styles.btnOutlineLight}`}>
              Voir comment ça marche
            </a>
          </div>
          <ul className={styles.heroChecks}>
            <li>
              <CheckIcon /> 100% gratuit pour démarrer
            </li>
            <li>
              <CheckIcon /> Sans engagement
            </li>
            <li>
              <CheckIcon /> En ligne en quelques minutes
            </li>
          </ul>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.heroChart}>
            <div className={styles.heroChartTitle}>Trouver une information dans vos documents</div>
            <div className={styles.heroChartSub}>Temps moyen, à titre d&apos;illustration</div>
            <div className={styles.heroBars}>
              <div className={styles.heroBar}>
                <div className={styles.heroBarTrack}>
                  <div
                    className={`${styles.heroBarFill} ${styles.heroBarFillBefore}`}
                    style={{ height: '88%' }}
                  />
                </div>
                <strong>~8 min</strong>
                <span>Sans assistant</span>
              </div>
              <div className={styles.heroBar}>
                <div className={styles.heroBarTrack}>
                  <div
                    className={`${styles.heroBarFill} ${styles.heroBarFillAfter}`}
                    style={{ height: '12%' }}
                  />
                </div>
                <strong>~10 sec</strong>
                <span>Avec Corpus.ai</span>
              </div>
            </div>
          </div>
          <div className={styles.heroChartBadge}>
            <span className={styles.ico}>
              <CheckIcon />
            </span>
            <div>
              <strong>Réponse immédiate</strong>
              <span>Sourcée, en quelques secondes</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function TrustBar() {
  const items = [
    { stat: '100%', title: 'Données isolées', body: 'Chaque organisation est cloisonnée au niveau base de données.' },
    { stat: '< 5 min', title: 'Indexation rapide', body: "De l'upload au chatbot prêt à répondre." },
    { stat: 'Chaque réponse', title: 'Sourcée', body: 'Toujours un lien vers le document utilisé.' },
  ];
  return (
    <section className={styles.trust}>
      <div className={styles.wrap}>
        <div className={styles.trustGrid}>
          {items.map((item) => (
            <div key={item.title} className={styles.trustItem}>
              <span className={styles.trustStat}>{item.stat}</span>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      k: '01',
      title: 'Avec documents, ou sans',
      body: "Uploadez vos fichiers (PDF, Word, texte, CSV, Excel), ou décrivez simplement votre métier si vous n'avez rien à uploader.",
    },
    {
      k: '02',
      title: 'Indexation automatique',
      body: 'Vos documents sont découpés, vectorisés et indexés en quelques minutes, sans configuration de votre côté.',
    },
    {
      k: '03',
      title: 'Votre équipe ou vos clients posent leurs questions',
      body: 'En interne ou via le widget public sur votre site, avec des réponses instantanées et sourcées, strictement fondées sur vos documents.',
    },
  ];
  return (
    <section id="comment-ca-marche" className={styles.how}>
      <div className={styles.wrap}>
        <div className={`${styles.sectionHead} ${styles.sectionHeadCenter}`}>
          <span className={styles.sectionLabel}>Comment ça marche</span>
          <h2>De vos documents à un assistant fiable, en 3 étapes</h2>
        </div>
        <div className={styles.steps}>
          {steps.map((s) => (
            <div key={s.k} className={styles.step}>
              <div className={styles.stepK}>{s.k}</div>
              <h4>{s.title}</h4>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURE_ICONS = {
  check: (
    <path
      fillRule="evenodd"
      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
      clipRule="evenodd"
    />
  ),
  search: (
    <path
      fillRule="evenodd"
      d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
      clipRule="evenodd"
    />
  ),
  shield: (
    <path
      fillRule="evenodd"
      d="M10 1.75a.75.75 0 01.37.097l6.25 3.5a.75.75 0 01.38.653v4.5c0 4.21-2.72 7.627-6.657 9.253a.75.75 0 01-.586 0C5.82 18.127 3.1 14.71 3.1 10.5V6a.75.75 0 01.38-.653l6.25-3.5A.75.75 0 0110 1.75z"
      clipRule="evenodd"
    />
  ),
  doc: (
    <path
      fillRule="evenodd"
      d="M5.5 2A1.5 1.5 0 004 3.5v13A1.5 1.5 0 005.5 18h9a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0010.378 2H5.5zm4.75 1.5V6a1 1 0 001 1h2.5l-3.5-3.5z"
      clipRule="evenodd"
    />
  ),
};

function Features() {
  const groups = [
    {
      icon: FEATURE_ICONS.check,
      title: 'Réponses fiables',
      points: [
        'Chaque réponse cite les documents utilisés, vérifiable en un clic.',
        "Si l'information ne figure pas dans vos documents, l'assistant le signale au lieu de deviner.",
      ],
    },
    {
      icon: FEATURE_ICONS.search,
      title: 'Recherche puissante',
      points: [
        'Recherche hybride : mots-clés et sens combinés, pour ne rien manquer.',
        'Répond dans la langue du visiteur, à partir de la même base documentaire.',
      ],
    },
    {
      icon: FEATURE_ICONS.shield,
      title: 'Données isolées',
      points: [
        'Chaque organisation est cloisonnée au niveau base de données (Row Level Security).',
        "Domaines d'intégration restreints : vous choisissez où le widget peut tourner.",
      ],
    },
    {
      icon: FEATURE_ICONS.doc,
      title: "Prêt à l'emploi",
      points: [
        'Templates par secteur : vente, support, immobilier, santé, ou gardez vos propres notes pour vous seul.',
        'Widget intégrable sur votre site en quelques minutes.',
      ],
    },
  ];
  return (
    <section id="fonctionnalites" className={styles.features}>
      <div className={styles.wrap}>
        <div className={styles.featuresHead}>
          <span className={styles.sectionLabel}>Ce que nous proposons</span>
          <h2>Nos fonctionnalités</h2>
          <p>Pour des réponses fiables, rapides et en sécurité.</p>
        </div>
        <div className={styles.featureGrid}>
          {groups.map((g, i) => (
            <div key={g.title} className={styles.featureCard}>
              <span className={styles.featureNum}>{String(i + 1).padStart(2, '0')}</span>
              <span className={styles.featureIcon}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  {g.icon}
                </svg>
              </span>
              <h4>{g.title}</h4>
              <ul className={styles.featurePoints}>
                {g.points.map((p) => (
                  <li key={p}>
                    <CheckIcon />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className={styles.featureCta}>
          <p>
            <strong>Pas sûr que ce soit adapté à votre activité ?</strong>
            <span>On en discute ensemble avant toute mise en route.</span>
          </p>
          <Link href="/signup" className={`${styles.btn} ${styles.btnBrass} ${styles.btnSm}`}>
            Commencer gratuitement
          </Link>
        </div>
      </div>
    </section>
  );
}

interface CatalogueEntry {
  title: string;
  body: string;
  who: string;
}

function Catalogue() {
  const available: CatalogueEntry[] = [
    { title: 'Second cerveau', body: 'Déposez vos notes et supports, retrouvez-les en langage naturel, pour vous seul.', who: 'Indépendants, coachs, consultants' },
    { title: 'Assistant sans documents', body: 'Le savoir tient dans quelques consignes : zéro upload, zéro indexation, en ligne en minutes.', who: 'Indépendants, artisans' },
    { title: 'Cabinet de santé', body: "Horaires, tarifs, prise de rendez-vous : répond aux questions pratiques, jamais d'avis médical.", who: 'Professionnels de santé, secrétariat' },
    { title: 'Chatbot documentaire', body: 'Répond aux questions à partir de vos documents, sources citées à chaque réponse.', who: 'Tout le monde' },
    { title: 'Agence immobilière', body: "Procédures de visite, mandats, pièces à fournir : un modèle prêt à l'emploi.", who: 'Agences, indépendants immo' },
    { title: 'Copilote commercial', body: 'Argumentaires et réponses aux objections retrouvés en quelques secondes, en plein appel.', who: 'Équipes vente structurées' },
    { title: 'Assistant conformité', body: '« Puis-je faire X ? » posé directement sur vos politiques internes.', who: 'Secteurs réglementés' },
  ];

  const roadmap: CatalogueEntry[] = [
    { title: 'Indexation assistée par IA', body: 'Uploadez un document brut ou une URL, sans rien préparer : une IA nettoie et structure le contenu.', who: 'Tout document mal formaté' },
    { title: 'Agent de qualification', body: 'Engage un visiteur, pose les bonnes questions, score et route le contact.', who: 'B2B à cycle de vente long' },
    { title: 'Brouillon de réponse email', body: 'Rédige une réponse client à partir de la base de connaissance, à valider avant envoi.', who: 'Support à fort volume' },
    { title: 'Analyseur de contrats', body: "Dépose un contrat, obtiens l'extraction des clauses clés et pose tes questions dessus.", who: 'PME sans juriste interne' },
    { title: 'Standard IA téléphone / WhatsApp', body: 'Le même assistant, sur un canal vocal ou messagerie.', who: 'Commerces de proximité' },
    { title: 'Veille & synthèse', body: 'Surveille un corpus interne ou externe, pousse un résumé périodique des nouveautés.', who: 'Veille concurrentielle, R&D' },
  ];

  return (
    <section id="catalogue" className={styles.catalogue}>
      <div className={styles.wrap}>
        <div className={`${styles.sectionHead} ${styles.sectionHeadCenter}`}>
          <span className={styles.sectionLabel}>Catalogue</span>
          <h2>Ce que Corpus.ai peut faire pour votre activité</h2>
          <p className={styles.dek}>
            Du second cerveau personnel à l&apos;assistant partagé en équipe, certains cas
            d&apos;usage tournent déjà, d&apos;autres sont notre feuille de route.
          </p>
        </div>

        <div className={styles.registerNote}>
          <span className={styles.registerKey}>
            <span className={`${styles.swatch} ${styles.swatchNow}`} /> Disponible aujourd&apos;hui
          </span>
          <span className={styles.registerKey}>
            <span className={`${styles.swatch} ${styles.swatchNext}`} /> Feuille de route (à venir)
          </span>
        </div>

        <div className={styles.catGroup}>
          <div className={styles.catGroupHead}>Disponible aujourd&apos;hui</div>
          <div className={styles.catGrid}>
            {available.map((c) => (
              <div key={c.title} className={styles.catCard}>
                <h4>{c.title}</h4>
                <p>{c.body}</p>
                <span className={styles.catFor}>Pour → {c.who}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.catGroup}>
          <div className={styles.catGroupHead}>Feuille de route</div>
          <div className={styles.catGrid}>
            {roadmap.map((c) => (
              <div key={c.title} className={`${styles.catCard} ${styles.catCardRoadmap}`}>
                <span className={styles.catBadgeSoon}>Bientôt</span>
                <h4>{c.title}</h4>
                <p>{c.body}</p>
                <span className={styles.catFor}>Pour → {c.who}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing({ isLoggedIn }: { isLoggedIn: boolean }) {
  const plans = [
    {
      name: 'Solo',
      who: 'Indépendant, un seul assistant',
      price: '9€',
      per: '/ mois',
      included: '300 messages inclus',
      features: ['1 assistant, avec ou sans documents', 'Widget intégrable sur votre site', 'Historique de conversation conservé'],
      cta: 'Commencer gratuitement',
      featured: false,
    },
    {
      name: 'PME',
      who: 'Plusieurs assistants, équipe partagée',
      price: '49€',
      per: '/ mois',
      included: '1 500 messages inclus · +2€ / 100 au-delà',
      features: ['Assistants illimités', 'Formats étendus : CSV, Excel, multi-documents', "Membres d'équipe multiples"],
      cta: 'Commencer gratuitement',
      featured: true,
    },
    {
      name: 'Métier',
      who: 'Besoins spécifiques, volumes élevés',
      price: 'Sur devis',
      per: '',
      included: 'Volume et intégrations à définir',
      features: ['Fonctionnalités de la feuille de route en priorité', 'Accompagnement à la mise en place', 'Facturation adaptée au volume réel'],
      cta: 'Nous contacter',
      featured: false,
    },
  ];

  return (
    <section id="tarifs" className={styles.pricing}>
      <div className={styles.wrap}>
        <div className={`${styles.sectionHead} ${styles.sectionHeadCenter}`}>
          <span className={styles.sectionLabel}>Tarifs</span>
          <h2>Un forfait, un dépassement à la tranche</h2>
          <p className={styles.dek}>Tarifs indicatifs pour la phase pilote, susceptibles d&apos;évoluer.</p>
        </div>
        <div className={styles.priceGrid}>
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`${styles.priceCard} ${plan.featured ? styles.priceCardFeatured : ''}`}
            >
              {plan.featured && <span className={styles.priceBadge}>Le plus choisi</span>}
              <h3>{plan.name}</h3>
              <p className={styles.priceWho}>{plan.who}</p>
              <div className={styles.amount}>
                {plan.price}
                {plan.per && <span className={styles.per}> {plan.per}</span>}
              </div>
              <p className={styles.included}>{plan.included}</p>
              <ul className={styles.priceList}>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link
                href={isLoggedIn ? '/dashboard' : '/signup'}
                className={`${styles.btn} ${plan.featured ? styles.btnPrimary : styles.btnGhost}`}
                style={{ marginTop: 24, justifyContent: 'center' }}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className={styles.priceNote}>
          Toute capacité issue de la feuille de route se facturera strictement à l&apos;usage
          une fois construite, jamais incluse par avance dans un forfait fixe.
        </p>
      </div>
    </section>
  );
}

function Testimonials() {
  // TEMPORARY: entries below are invented placeholders (fake names/quotes),
  // added only to visualize the section with several cards while the
  // product isn't commercialized yet (no domain, pas de vrais clients
  // pilotes pour l'instant). Willy's entry is the one real person so far
  // (quote still pending his own wording). Replace the placeholders with
  // real testimonials before any public launch.
  const quotes = [
    {
      quote:
        "Mes notes clients et mes process sont accessibles en quelques secondes, sans avoir à fouiller dans mes dossiers : c’est devenu mon second cerveau pour mon activité d’accompagnement. J’ai même pu ajouter un chatbot commercial à mon site web en quelques clics.",
      name: 'Willy Duong',
      role: 'Accompagnateur business, indépendant',
    },
    {
      quote:
        "Nos Patiens obtiennent des réponses précises à toute heure, tirées directement de nos documentation. Nous avons nettement réduit le temps passé sur les questions répétitives.",
      name: 'Gros Véronique',
      role: 'Fondatrice du pôle podologie, Maison de santé Carnot',
    },
    {
      quote:
        "Installé en deux heures le chatbot cite les passages de nos contrats et rassure nos prospects avant même le premier appel.",
      name: 'Laurent Martin',
      role: 'Responsable commercial chez Speedmedia Services',
    },
  ];
  return (
    <section className={styles.testimonials}>
      <div className={styles.wrap}>
        <div className={`${styles.sectionHead} ${styles.sectionHeadCenter}`}>
          <span className={styles.sectionLabel}>Avis</span>
          <h2>Ce qu&apos;en disent nos utilisateurs</h2>
        </div>
        <div className={`${styles.testiGrid} ${quotes.length === 1 ? styles.testiGridSolo : ''}`}>
          {quotes.map((t) => (
            <div key={t.name} className={styles.testiCard}>
              <p className={styles.testiQuote}>{t.quote}</p>
              <div className={styles.testiMeta}>
                <span className={styles.testiAvatar}>{t.name.charAt(0)}</span>
                <div>
                  <strong>{t.name}</strong>
                  <span>{t.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
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
      a: "PDF avec texte natif, Word (.docx), texte brut (.txt), CSV et Excel (.xlsx, .xls). Les PDF scannés (sans texte extractible) ne sont pas encore supportés : l'OCR est sur notre feuille de route.",
    },
    { q: 'Puis-je annuler à tout moment ?', a: 'Oui, sans engagement ni préavis.' },
    {
      q: 'Que se passe-t-il si je dépasse mon quota de messages ?',
      a: "Le forfait Solo inclut 300 messages/mois, le forfait PME 1 500. Au-delà, la tranche supplémentaire de 100 messages est facturée 2€ plutôt que de couper le service.",
    },
    {
      q: "Puis-je changer de cas d'usage après coup ?",
      a: "Oui. Chaque chatbot reste indépendant : vous pouvez ajuster ses documents, son prompt ou son cas d'usage à tout moment, sans repartir de zéro.",
    },
  ];
  return (
    <section className={styles.faq}>
      <div className={styles.wrap}>
        <div className={styles.faqGrid}>
          <div className={styles.faqHead}>
            <div className={`${styles.sectionHead}`}>
              <span className={styles.sectionLabel}>Questions fréquentes</span>
              <h2>Tout ce qu&apos;on nous demande</h2>
            </div>
            <div className={styles.faqContact}>
              <strong>Une autre question ?</strong>
              <span>Écrivez-nous, on vous répond rapidement.</span>
              <a href="tel:+33744847992" className={styles.faqContactLink}>
                07 44 84 79 92
              </a>
              <a
                href="https://wa.me/33744847992"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.faqContactLink}
              >
                WhatsApp
              </a>
            </div>
          </div>
          <div className={styles.faqList}>
            {items.map((item) => (
              <details key={item.q} className={styles.faqItem}>
                <summary>
                  {item.q}
                  <span className={styles.faqPlus}>+</span>
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className={styles.closing}>
      <div className={styles.closingInner}>
        <h3>
          Prêt à essayer Corpus.ai sur <span className={styles.accent}>vos documents</span> ?
        </h3>
        <p>Pilote gratuit, sans engagement, pour les premières entreprises.</p>
        <div className={styles.closingCtas}>
          <Link
            href={isLoggedIn ? '/dashboard' : '/signup'}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            {isLoggedIn ? 'Aller au dashboard' : 'Commencer gratuitement'}
          </Link>
          <a href="#tarifs" className={`${styles.btn} ${styles.btnOutlineLight}`}>
            Voir les tarifs
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.wrap}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <span className={styles.logo}>
              <span className={styles.mark}>C</span>
              Corpus.ai
            </span>
            <p>Transformez vos documents et process en un assistant IA qui répond.</p>
          </div>
          <div className={styles.footerCol}>
            <span className={styles.footerColTitle}>Navigation</span>
            <a href="#comment-ca-marche">Comment ça marche</a>
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#catalogue">Catalogue</a>
            <a href="#tarifs">Tarifs</a>
          </div>
          <div className={styles.footerCol}>
            <span className={styles.footerColTitle}>Compte</span>
            <Link href="/login">Connexion</Link>
            <Link href="/signup">Essayer gratuitement</Link>
          </div>
        </div>
      </div>
      <div className={styles.footerDivider} />
      <div className={styles.wrap}>
        <div className={styles.footerBottom}>
          <p>© {new Date().getFullYear()} Corpus.ai. Tous droits réservés.</p>
          <nav className={styles.footerLinks}>
            <Link href="/legal/mentions-legales">Mentions légales</Link>
            <Link href="/legal/confidentialite">Confidentialité</Link>
            <Link href="/legal/cgu">CGU</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

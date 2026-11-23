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

// Document à coin plié ("dog-ear") plutôt que deux rectangles abstraits :
// un repère visuel directement lisible comme "document", cohérent avec
// "Corpus" (un ensemble de documents) et avec l'Analyseur de documents.
function LogoMark() {
  return (
    <span className={styles.mark}>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="M7 2 H15 L20 7 V19 Q20 22 17 22 H7 Q4 22 4 19 V5 Q4 2 7 2 Z" fill="currentColor" />
        <path d="M15 2 L20 7 H15 Z" fill="var(--brass)" />
      </svg>
    </span>
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
      <span className={`${styles.marginRail} ${styles.marginRailLeft}`} aria-hidden="true">
        Corpus.ai · Dossier N° 001 · Corpus.ai · Dossier N° 001
      </span>
      <span className={`${styles.marginRail} ${styles.marginRailRight}`} aria-hidden="true">
        Pilote gratuit · sans engagement · Pilote gratuit · sans engagement
      </span>
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
      <div className={`${styles.wrap} ${styles.navBar}`}>
        <Link href="/" className={`${styles.logo} ${styles.navTab}`}>
          <LogoMark />
          Corpus.ai
        </Link>
        <div className={styles.navRight}>
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
      </div>
    </header>
  );
}

function Hero({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header className={styles.hero}>
      <svg
        className={`${styles.watermark} ${styles.heroWatermark}`}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M7 2 H15 L20 7 V19 Q20 22 17 22 H7 Q4 22 4 19 V5 Q4 2 7 2 Z" fill="currentColor" />
      </svg>
      <div className={styles.wrap}>
        <span className={styles.stampBadge}>
          <CheckIcon />
          Pilote gratuit et sans engagement
        </span>
        <h1 className={styles.heroTitle}>
          Vos documents travaillent,
          <br />
          <span className={styles.accent}>pas vous</span>
        </h1>
        <p className={styles.heroLede}>
          Corpus.ai analyse vos contrats, factures et devis, qualifie vos leads avant même le
          premier appel, et répond à vos questions depuis vos documents internes. Trois outils,
          un seul corpus de documents.
        </p>
        <div className={styles.heroCtas}>
          <Link
            href={isLoggedIn ? '/dashboard' : '/signup'}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            {isLoggedIn ? 'Aller au dashboard' : 'Commencer gratuitement'}
          </Link>
          <a href="#comment-ca-marche" className={`${styles.btn} ${styles.btnGhost}`}>
            Voir comment ça marche
          </a>
        </div>

        <div className={styles.caseFile}>
          <div className={styles.paperclip} aria-hidden="true" />
          <div className={styles.fileCard}>
            <span className={styles.ribbon}>Sourcé</span>
            <div className={styles.fileCardLabel}>Dossier · contrat-dupont.pdf</div>
            <div className={styles.heroChatBubbleUser}>
              Quelle est la durée de préavis sur le contrat Dupont ?
            </div>
            <div className={styles.heroChatBubbleBot}>
              <span>3 mois, résiliable à la date anniversaire du contrat.</span>
              <span className={styles.heroChatCite}>contrat-dupont.pdf · clause 4.2</span>
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
      title: 'Vos documents travaillent pour vous',
      body: 'Réponses sourcées à vos questions, factures et contrats extraits automatiquement, leads qualifiés et routés : en interne ou via le widget public sur votre site.',
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
              <div className={styles.stepBody}>
                <h4>{s.title}</h4>
                <p>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const groups = [
    {
      title: 'Analyseur de documents',
      points: [
        'Factures, devis, contrats, bons de commande, bons de livraison, notes de frais, fiches de paie : les champs clés sont extraits et listés automatiquement, au fil de vos uploads, exportables en CSV.',
        "Posez vos questions en langage naturel directement sur vos documents, réponses sourcées. Sur un contrat : clauses résumées en plus (durée, résiliation, pénalités).",
      ],
    },
    {
      title: 'Leads qualifiés, pas juste des conversations',
      points: [
        'Le chatbot pose les bonnes questions à vos visiteurs, note le lead et prévient votre équipe automatiquement.',
        "Lead chaud : partage direct d'un lien de rendez-vous, ou notification vers votre CRM par webhook.",
      ],
    },
    {
      title: 'Réponses fiables, toujours sourcées',
      points: [
        'Chaque réponse cite les documents utilisés, vérifiable en un clic.',
        "Si l'information ne figure pas dans vos documents, l'assistant le signale au lieu de deviner.",
      ],
    },
  ];
  return (
    <section id="fonctionnalites" className={styles.features}>
      <div className={styles.wrap}>
        <div className={styles.featuresHead}>
          <span className={styles.sectionLabel}>Ce que nous proposons</span>
          <h2>Plus qu&apos;un chatbot</h2>
          <p>Un assistant qui analyse vos documents et qualifie vos leads, pas juste vos questions.</p>
        </div>
        <div className={styles.featureGrid}>
          {groups.map((g) => (
            <div key={g.title} className={styles.folder}>
              <span className={styles.fTab}>{g.title}</span>
              <div className={styles.fBody}>
                <ul className={styles.featurePoints}>
                  {g.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
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
  // Cas d'usage par métier volontairement retirés d'ici (2026-10-30) — liste
  // à part, générale par capacité plutôt que par secteur : le détail par
  // industrie (santé, immobilier, vente, conformité...) ira sur une page
  // dédiée plus tard, pas ici.
  const available: CatalogueEntry[] = [
    { title: 'Analyseur de documents', body: 'Factures, devis, contrats, bons de commande ou fiches de paie : les champs clés sont extraits automatiquement au fil de vos uploads, exportables en CSV, et interrogeables en chat.', who: 'PME, comptabilité, administratif' },
    { title: 'Agent de qualification', body: 'Engage un visiteur, pose les bonnes questions, score et route le contact vers votre équipe ou votre CRM.', who: 'B2B à cycle de vente long' },
    { title: 'Chatbot documentaire & support client', body: 'Répond aux questions à partir de vos documents (PDF natifs ou scannés, images) ou de vos FAQ et procédures, sources citées à chaque réponse.', who: 'Sites publics, SaaS, équipes support' },
    { title: 'Transcription de réunions', body: 'Enregistrez une réunion depuis le dashboard, elle est transcrite et indexée automatiquement : posez vos questions dessus ensuite.', who: 'Équipes, assistant interne' },
    { title: 'Assistant interne / second cerveau', body: 'Déposez vos notes, procédures ou documents internes au fil du temps, retrouvez-les en langage naturel : pour vous seul ou pour toute votre équipe.', who: 'Indépendants, consultants, équipes' },
    { title: 'Assistant sans documents', body: 'Le savoir tient dans quelques consignes : zéro upload, zéro indexation, en ligne en minutes.', who: 'Indépendants, artisans' },
    { title: 'Indexation assistée par IA', body: 'Déposez un document brut, sans rien préparer : une IA nettoie et structure le contenu avant indexation.', who: 'Tout document mal formaté' },
  ];

  const roadmap: CatalogueEntry[] = [
    { title: 'Brouillon de réponse email', body: 'Rédige une réponse client à partir de la base de connaissance, à valider avant envoi.', who: 'Support à fort volume' },
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
            De l&apos;analyse de documents automatisée au second cerveau personnel, certains cas
            d&apos;usage tournent déjà, d&apos;autres sont notre feuille de route.
          </p>
        </div>

        <div className={styles.catGroup}>
          <div className={styles.catGroupHead}>Disponible aujourd&apos;hui</div>
          <div className={styles.catRows}>
            {available.map((c) => (
              <div key={c.title} className={styles.catRow}>
                <span className={styles.catStamp}>Dispo</span>
                <div>
                  <strong>{c.title}</strong>
                  <p>{c.body}</p>
                  <span className={styles.catFor}>Pour → {c.who}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.catGroup}>
          <div className={styles.catGroupHead}>Feuille de route</div>
          <div className={styles.catRows}>
            {roadmap.map((c) => (
              <div key={c.title} className={`${styles.catRow} ${styles.catRowRoadmap}`}>
                <span className={styles.catStamp}>Bientôt</span>
                <div>
                  <strong>{c.title}</strong>
                  <p>{c.body}</p>
                  <span className={styles.catFor}>Pour → {c.who}</span>
                </div>
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
      name: 'Gratuit',
      who: 'Pour tester sans engagement',
      price: '0€',
      per: '',
      included: '30 messages inclus / mois',
      features: ['1 assistant, idéal pour tester', 'Widget intégrable sur votre site', 'Historique de conversation limité'],
      cta: 'Commencer gratuitement',
      featured: false,
    },
    {
      name: 'Solo',
      who: 'Indépendant, un seul assistant',
      price: '9€',
      per: '/ mois',
      included: '400 messages inclus',
      features: ['1 assistant, avec ou sans documents', 'Widget intégrable sur votre site', 'Historique de conversation conservé'],
      cta: 'Commencer gratuitement',
      featured: false,
    },
    {
      name: 'PME',
      who: 'Plusieurs assistants, équipe partagée',
      price: '49€',
      per: '/ mois',
      included: '3 000 messages inclus · +2€ / 100 au-delà',
      features: [
        'Assistants illimités',
        'Formats étendus : CSV, Excel, multi-documents',
        "Membres d'équipe multiples",
        'Analyseur de documents (IA)',
        'Transcription de réunions (IA)',
      ],
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
  // Les trois personnes sont réelles (Willy Duong, Laurent Martin, Véronique),
  // ont réellement utilisé le produit, et les citations sont des retours
  // oraux reformulés par le fondateur, pas des placeholders inventés de
  // toutes pièces. Willy est le seul dont la citation reste encore à
  // valider avec lui avant publication ; Laurent et Véronique ont déjà
  // donné leur retour sous cette forme.
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
      a: "Le forfait Gratuit inclut 30 messages/mois, Solo 400, PME 3 000. Au-delà, la tranche supplémentaire de 100 messages est facturée 2€ plutôt que de couper le service (sur Solo et PME).",
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
        <svg
          className={`${styles.watermark} ${styles.closingWatermark}`}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M7 2 H15 L20 7 V19 Q20 22 17 22 H7 Q4 22 4 19 V5 Q4 2 7 2 Z" fill="currentColor" />
        </svg>
        <div className={styles.closingContent}>
          <div className={styles.approved}>Approuvé</div>
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
            <a href="#tarifs" className={`${styles.btn} ${styles.btnGhost}`}>
              Voir les tarifs
            </a>
          </div>
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
              <LogoMark />
              Corpus.ai
            </span>
            <p>L&apos;IA qui analyse vos documents, qualifie vos leads et répond à vos questions, depuis votre corpus.</p>
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

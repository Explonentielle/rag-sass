import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import styles from './landing.module.css';

// Fonts are loaded once, globally, in app/layout.tsx (--font-display,
// --font-body, --font-label) — this page just consumes those variables via
// landing.module.css, same as every other page in the app now.

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
      <Thesis />
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
          <span className={styles.eyebrow}>Pilote gratuit pour les premières entreprises</span>
          <h1 className={styles.heroTitle}>
            De vos documents
            <br />à un assistant qui <em>répond</em><br />
            et, qui <em>agit</em>.
          </h1>
          <p className={styles.heroLede}>
            Corpus.ai transforme les documents et process de n&apos;importe quelle PME ou
            indépendant en un assistant IA opérationnel dès aujourd&apos;hui. Un forfait simple,
            aucun jargon technique, sources citées à chaque réponse.
          </p>
          <div className={styles.heroCtas}>
            <Link
              href={isLoggedIn ? '/dashboard' : '/signup'}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              {isLoggedIn ? 'Aller au dashboard' : 'Commencer gratuitement →'}
            </Link>
            <a href="#comment-ca-marche" className={`${styles.btn} ${styles.btnGhost}`}>
              Voir comment ça marche
            </a>
          </div>
          <p className={styles.heroNote}>Sans engagement, sans carte bancaire pour démarrer.</p>
        </div>

        <div className={styles.dossier} aria-hidden="true">
          <div className={`${styles.docCard} ${styles.doc1}`}>
            <div className={styles.docLabel}>Procédures.pdf</div>
            <div className={styles.docLine}></div>
            <div className={styles.docLine}></div>
            <div className={styles.docLine}></div>
            <div className={styles.docLine}></div>
          </div>
          <div className={`${styles.docCard} ${styles.doc2}`}>
            <div className={styles.docLabel}>Tarifs.xlsx</div>
            <div className={styles.docLine}></div>
            <div className={styles.docLine}></div>
            <div className={styles.docLine}></div>
          </div>
          <div className={`${styles.docCard} ${styles.doc3}`}>
            <div className={styles.docLabel}>Script-objections.pdf</div>
            <div className={styles.docLine}></div>
            <div className={styles.docLine}></div>
            <div className={styles.docLine}></div>
            <div className={styles.docLine}></div>
          </div>
          <div className={styles.chatBubble}>
            <div className={styles.chatBubbleWho}>Assistant</div>
            Ne baisse jamais le prix directement — reformule la valeur perçue, comparée au coût
            de l&apos;inaction.
          </div>
        </div>
      </div>
    </header>
  );
}

function TrustBar() {
  const items = [
    { title: 'Données isolées', body: 'Chaque organisation est cloisonnée au niveau base de données.' },
    { title: 'Réponses sourcées', body: 'Chaque réponse pointe vers le document utilisé.' },
    { title: 'Indexation rapide', body: "De l'upload au chatbot prêt, en quelques minutes." },
  ];
  return (
    <section className={styles.trust}>
      <div className={styles.wrap}>
        <div className={styles.trustGrid}>
          {items.map((item) => (
            <div key={item.title} className={styles.trustItem}>
              <span className={styles.trustDot} />
              <div>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Thesis() {
  return (
    <section className={styles.thesis}>
      <div className={`${styles.wrap} ${styles.thesisInner}`}>
        <span className={styles.tag}>Vision produit</span>
        <blockquote className={styles.thesisQuote}>
          Corpus.ai est la plateforme qui transforme les documents et process de
          n&apos;importe quelle PME ou indépendant en un assistant IA qui répond dès
          aujourd&apos;hui, et qui agira demain — vendue simplement, sans jargon technique
          ni promesse au-delà de ce qui est construit.
        </blockquote>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      k: 'Étape 01',
      title: 'Avec documents, ou sans',
      body: "Uploadez vos fichiers (PDF, Word, texte, CSV, Excel) — ou décrivez simplement votre métier si vous n'avez rien à uploader.",
    },
    {
      k: 'Étape 02',
      title: 'Indexation automatique',
      body: 'Vos documents sont découpés, vectorisés et indexés en quelques minutes, sans configuration de votre côté.',
    },
    {
      k: 'Étape 03',
      title: 'Votre équipe ou vos clients posent leurs questions',
      body: 'En interne ou via le widget public sur votre site — réponses instantanées et sourcées, strictement fondées sur vos documents.',
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

function Features() {
  const features = [
    { title: 'Réponses toujours sourcées', body: 'Chaque réponse cite les documents utilisés, vos équipes vérifient en un clic.' },
    { title: 'Aucune approximation', body: "Si une information ne figure pas dans vos documents, l'assistant le signale plutôt que de deviner." },
    { title: 'Recherche hybride', body: 'Combine recherche par mots-clés et recherche sémantique pour ne rien manquer.' },
    { title: 'Multi-organisation', body: 'Isolation stricte des données entre organisations, sécurité au niveau base de données.' },
    { title: "Templates prêts à l'emploi", body: 'Vente, support, immobilier, secrétariat médical : un point de départ par secteur.' },
    { title: 'Répond dans la langue du visiteur', body: 'Une même base documentaire, des réponses en français, anglais ou toute autre langue.' },
  ];
  return (
    <section id="fonctionnalites" className={styles.features}>
      <div className={`${styles.wrap} ${styles.featuresGrid}`}>
        <div className={styles.featuresIntro}>
          <span className={styles.sectionLabel}>Fonctionnalités</span>
          <h2>Tout ce qu&apos;il faut, rien de superflu</h2>
          <p>
            Pas de fonctionnalités gadget : chaque point ci-contre répond à une exigence
            concrète pour un assistant utilisable en production.
          </p>
        </div>
        <div className={styles.featureList}>
          {features.map((f) => (
            <div key={f.title} className={styles.featureItem}>
              <span className={styles.featureDot} />
              <div>
                <strong>{f.title}</strong>
                <span>{f.body}</span>
              </div>
            </div>
          ))}
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
    { title: 'Chatbot documentaire', body: 'Répond aux questions à partir de vos documents, sources citées à chaque réponse.', who: 'Tout le monde' },
    { title: 'Assistant sans documents', body: 'Le savoir tient dans quelques consignes — zéro upload, zéro indexation, en ligne en minutes.', who: 'Indépendants, artisans' },
    { title: 'Copilote commercial', body: 'Argumentaires et réponses aux objections retrouvés en quelques secondes, en plein appel.', who: 'Équipes vente structurées' },
    { title: 'Assistant conformité', body: '« Puis-je faire X ? » posé directement sur vos politiques internes.', who: 'Secteurs réglementés' },
    { title: 'Agence immobilière', body: "Procédures de visite, mandats, pièces à fournir — un modèle prêt à l'emploi.", who: 'Agences, indépendants immo' },
    { title: 'Second cerveau', body: 'Déposez vos notes et supports, retrouvez-les en langage naturel — pour vous seul.', who: 'Coachs, consultants, formateurs' },
  ];

  const roadmap: CatalogueEntry[] = [
    { title: 'Indexation assistée par IA', body: 'Uploadez un document brut ou une URL, sans rien préparer — une IA nettoie et structure le contenu.', who: 'Tout document mal formaté' },
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
            Une base large de cas d&apos;usage — certains tournent déjà, d&apos;autres sont
            notre feuille de route.
          </p>
        </div>

        <div className={styles.registerNote}>
          <span className={styles.registerKey}>
            <span className={`${styles.swatch} ${styles.swatchNow}`} /> Disponible aujourd&apos;hui
          </span>
          <span className={styles.registerKey}>
            <span className={`${styles.swatch} ${styles.swatchNext}`} /> Feuille de route — à venir
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
  // Placeholder quotes, replace with real pilot client feedback before launch.
  const quotes = [
    { quote: 'Outil très utile, on a gagné un temps précieux sur le support client.', name: 'John Doe', role: 'CEO, Acme Corp' },
    { quote: "Nos commerciaux retrouvent l'argumentaire en quelques secondes, ça change tout en appel.", name: 'Jane Doe', role: 'Responsable des ventes, Exemple SAS' },
    { quote: 'Simple à mettre en place, et les réponses citent toujours la bonne procédure.', name: 'Paul Martin', role: 'Support client, Entreprise Test' },
  ];
  return (
    <section className={styles.testimonials}>
      <div className={styles.wrap}>
        <div className={`${styles.sectionHead} ${styles.sectionHeadCenter}`}>
          <span className={styles.sectionLabel}>Avis</span>
          <h2>Ce qu&apos;en disent nos premiers utilisateurs</h2>
        </div>
        <div className={styles.testiGrid}>
          {quotes.map((t) => (
            <div key={t.name} className={styles.testiCard}>
              <p className={styles.testiQuote}>{t.quote}</p>
              <div className={styles.testiMeta}>
                <strong>{t.name}</strong>
                <span>{t.role}</span>
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
      a: "PDF avec texte natif, Word (.docx), texte brut (.txt), CSV et Excel (.xlsx, .xls). Les PDF scannés (sans texte extractible) ne sont pas encore supportés — l'OCR est sur notre feuille de route.",
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
        <div className={`${styles.sectionHead} ${styles.sectionHeadCenter}`}>
          <span className={styles.sectionLabel}>Questions fréquentes</span>
          <h2>Tout ce qu&apos;on nous demande</h2>
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
    </section>
  );
}

function FinalCta({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className={styles.closing}>
      <div className={styles.wrap}>
        <div className={styles.closingInner}>
          <div>
            <h3>Prêt à essayer sur vos documents ?</h3>
            <p>Pilote gratuit, sans engagement, pour les premières entreprises.</p>
          </div>
          <Link
            href={isLoggedIn ? '/dashboard' : '/signup'}
            className={`${styles.btn} ${styles.btnBrass}`}
          >
            {isLoggedIn ? 'Aller au dashboard' : 'Commencer gratuitement'}
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.wrap} ${styles.footerInner}`}>
        <span className={styles.logo}>
          <span className={styles.mark}>C</span>
          Corpus.ai
        </span>
        <nav className={styles.footerLinks}>
          <Link href="/legal/mentions-legales">Mentions légales</Link>
          <Link href="/legal/confidentialite">Confidentialité</Link>
          <Link href="/legal/cgu">CGU</Link>
        </nav>
        <p className={styles.footerCopy}>© {new Date().getFullYear()} Corpus.ai</p>
      </div>
    </footer>
  );
}

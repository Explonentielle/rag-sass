import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container, Card } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';

const LAST_UPDATED = '4 novembre 2026';
const CONTACT_EMAIL = 'adv.dev.france@gmail.com';
const CONTACT_PHONE = '07 44 84 79 92';
const APP_URL = 'https://rag-sass-seven.vercel.app';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

function DraftNotice() {
  return (
    <div className="mb-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Document rédigé pour le pilote, pas un avis juridique. À faire relire par un professionnel
      du droit avant toute ouverture commerciale à grande échelle.
    </div>
  );
}

function MentionsLegales() {
  return (
    <>
      <Section title="Éditeur">
        <p>Le site et l'application Corpus.ai sont édités par :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Alexandre DE BONNIÈRES, entrepreneur individuel (micro-entreprise)</li>
          <li>SIREN : 820 451 656</li>
          <li>SIRET : 820 451 656 00012</li>
          <li>Adresse : 53 cours du Docteur Long, 69003 Lyon, France</li>
          <li>
            Numéro de TVA intracommunautaire : non applicable, franchise en base de TVA (art. 293
            B du Code général des impôts)
          </li>
          <li>
            Email de contact : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </li>
          <li>Téléphone : {CONTACT_PHONE}</li>
        </ul>
        <p>Directeur de la publication : Alexandre DE BONNIÈRES.</p>
      </Section>

      <Section title="Hébergement">
        <p>L'application est hébergée par :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Vercel Inc.</li>
          <li>440 N Barranca Ave #4133, Covina, CA 91723, États-Unis</li>
          <li>
            <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">
              vercel.com
            </a>
          </li>
        </ul>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          L'ensemble des éléments techniques, graphiques et textuels du site et de l'application
          Corpus.ai (hors contenus et documents déposés par les clients) est la propriété de
          l'éditeur, sauf mention contraire. Toute reproduction ou représentation totale ou
          partielle sans autorisation préalable est interdite.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Pour toute question relative au site ou à l'application, écrire à{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </>
  );
}

function CGU() {
  return (
    <>
      <Section title="1. Objet">
        <p>
          Corpus.ai (« le Service ») est une application permettant de créer des chatbots fondés
          sur l'intelligence artificielle, capables de répondre à partir de documents fournis par
          le client. Les présentes conditions générales d'utilisation et de vente (« CGU »)
          régissent l'accès et l'usage du Service par tout utilisateur créant un compte (« le
          Client »), ainsi que les conditions de souscription aux offres payantes.
        </p>
        <p>
          L'éditeur du Service est identifié dans les{' '}
          <Link href="/legal/mentions-legales">mentions légales</Link>.
        </p>
      </Section>

      <Section title="2. Acceptation">
        <p>
          La création d'un compte sur {APP_URL} vaut acceptation pleine et entière des présentes
          CGU. Le Client s'engage à fournir des informations exactes et à utiliser le Service
          conformément à sa destination et à la réglementation en vigueur.
        </p>
      </Section>

      <Section title="3. Offres et tarifs">
        <p>Le Service propose les paliers suivants, hors taxes applicables le cas échéant :</p>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-1.5 pr-3 font-medium text-slate-700">Palier</th>
              <th className="py-1.5 pr-3 font-medium text-slate-700">Prix</th>
              <th className="py-1.5 font-medium text-slate-700">Inclus</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-1.5 pr-3">Gratuit</td>
              <td className="py-1.5 pr-3">0 €</td>
              <td className="py-1.5">30 messages / mois</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-1.5 pr-3">Solo</td>
              <td className="py-1.5 pr-3">9 € / mois</td>
              <td className="py-1.5">300 messages / mois</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-1.5 pr-3">PME</td>
              <td className="py-1.5 pr-3">49 € / mois</td>
              <td className="py-1.5">1 500 messages / mois, +2 € par tranche de 100 au-delà</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-3">Métier</td>
              <td className="py-1.5 pr-3">Sur devis</td>
              <td className="py-1.5">Volume et intégrations à définir</td>
            </tr>
          </tbody>
        </table>
        <p>
          Ces tarifs sont indicatifs pour la phase pilote et susceptibles d'évoluer. Toute
          modification de tarif applicable à un abonnement en cours sera communiquée au Client
          avec un préavis raisonnable avant son entrée en vigueur.
        </p>
      </Section>

      <Section title="4. Paiement">
        <p>
          Le paiement des offres Solo et PME s'effectue par carte bancaire via Stripe, prestataire
          de paiement tiers. L'abonnement donne lieu à un prélèvement mensuel automatique et
          récurrent tant qu'il n'a pas été résilié. Le Client peut activer, dans ses paramètres, le
          débit automatique des messages consommés au-delà de son quota inclus, sur le moyen de
          paiement déjà enregistré.
        </p>
      </Section>

      <Section title="5. Durée et résiliation">
        <p>
          L'abonnement est sans engagement de durée. Le Client peut le résilier à tout moment
          depuis le portail de gestion d'abonnement accessible dans son espace Corpus.ai. La
          résiliation prend effet à la fin de la période déjà payée : le mois en cours reste dû
          dans son intégralité et aucun remboursement au prorata n'est effectué pour la période
          déjà entamée.
        </p>
      </Section>

      <Section title="6. Droit de rétractation">
        <p>
          Le Service s'adresse à des professionnels agissant dans le cadre de leur activité, pour
          lesquels le droit de rétractation du Code de la consommation ne s'applique pas. Si un
          Client non professionnel venait à souscrire, il reconnaît, en accédant au Service
          immédiatement après paiement, renoncer expressément à son droit de rétractation pour un
          service numérique pleinement exécuté avant la fin du délai légal de 14 jours
          (art. L221-28 du Code de la consommation).
        </p>
      </Section>

      <Section title="7. Disponibilité et responsabilité">
        <p>
          L'éditeur met en œuvre des moyens raisonnables pour assurer la disponibilité et le bon
          fonctionnement du Service, sans garantie de disponibilité continue (maintenance,
          incidents techniques, dépendance à des services tiers).
        </p>
        <p>
          Les réponses générées par l'intelligence artificielle du Service sont produites
          automatiquement à partir des documents fournis par le Client et peuvent, comme tout
          système d'IA générative, contenir des erreurs, approximations ou omissions. Le Client
          reste responsable de la vérification des réponses avant toute utilisation dans un
          contexte sensible (juridique, médical, financier).
        </p>
        <p>
          La responsabilité de l'éditeur, en cas de faute prouvée, est limitée aux sommes versées
          par le Client au titre de son abonnement au cours des douze derniers mois. Les dommages
          indirects (perte d'exploitation, perte de données, préjudice commercial) sont exclus.
        </p>
      </Section>

      <Section title="8. Propriété des contenus">
        <p>
          Le Client reste pleinement propriétaire des documents et données qu'il dépose sur le
          Service. L'éditeur ne les utilise que pour fournir le Service au Client et ne les
          réutilise à aucune autre fin (notamment pas pour entraîner un modèle d'intelligence
          artificielle). L'éditeur reste propriétaire du code, de la plateforme et de la marque
          Corpus.ai.
        </p>
      </Section>

      <Section title="9. Données personnelles">
        <p>
          Le traitement des données personnelles est décrit dans la{' '}
          <Link href="/legal/confidentialite">politique de confidentialité</Link>.
        </p>
      </Section>

      <Section title="10. Droit applicable et litiges">
        <p>
          Les présentes CGU sont soumises au droit français. En cas de litige, les parties
          rechercheront une solution amiable avant toute action judiciaire ; à défaut, les
          tribunaux français compétents seront saisis.
        </p>
      </Section>
    </>
  );
}

function Confidentialite() {
  return (
    <>
      <Section title="1. Responsable de traitement">
        <p>
          Le responsable du traitement des données personnelles collectées via Corpus.ai est
          identifié dans les <Link href="/legal/mentions-legales">mentions légales</Link>. Pour
          toute question, contact : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>

      <Section title="2. Données collectées">
        <ul className="list-disc space-y-1 pl-5">
          <li>Données de compte : email, mot de passe (géré par le prestataire d'authentification), nom de l'organisation.</li>
          <li>Documents déposés par le Client pour alimenter ses chatbots.</li>
          <li>Conversations échangées entre les chatbots et leurs utilisateurs ou visiteurs (contenu des messages, horodatage).</li>
          <li>Identifiant anonyme de visiteur pour les chatbots publics (sans compte), stocké côté navigateur.</li>
        </ul>
      </Section>

      <Section title="3. Finalités et bases légales">
        <ul className="list-disc space-y-1 pl-5">
          <li>Fourniture du Service et gestion du compte : exécution du contrat.</li>
          <li>Facturation des offres payantes : exécution du contrat et obligations légales comptables.</li>
          <li>Support et amélioration du Service : intérêt légitime de l'éditeur.</li>
        </ul>
      </Section>

      <Section title="4. Destinataires et sous-traitants">
        <p>Les données sont traitées par les prestataires techniques suivants :</p>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-1.5 pr-3 font-medium text-slate-700">Prestataire</th>
              <th className="py-1.5 pr-3 font-medium text-slate-700">Rôle</th>
              <th className="py-1.5 font-medium text-slate-700">Localisation</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-1.5 pr-3">Supabase</td>
              <td className="py-1.5 pr-3">Base de données, authentification, stockage de fichiers</td>
              <td className="py-1.5">Union européenne</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-1.5 pr-3">OpenAI</td>
              <td className="py-1.5 pr-3">Génération des réponses et des embeddings</td>
              <td className="py-1.5">États-Unis (clauses contractuelles types)</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-1.5 pr-3">Stripe</td>
              <td className="py-1.5 pr-3">Traitement des paiements et abonnements</td>
              <td className="py-1.5">Union européenne / États-Unis (clauses contractuelles types)</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-3">OVH</td>
              <td className="py-1.5 pr-3">Hébergement du moteur de recherche documentaire et de l'OCR</td>
              <td className="py-1.5">Canada</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="5. Durées de conservation">
        <ul className="list-disc space-y-1 pl-5">
          <li>Compte utilisateur : pendant toute la durée de vie du compte.</li>
          <li>Conversations : 90 jours, purgées automatiquement.</li>
          <li>Documents déposés : pendant toute la durée de vie du chatbot auquel ils sont rattachés.</li>
        </ul>
      </Section>

      <Section title="6. Transferts hors Union européenne">
        <p>
          Certains prestataires (OpenAI, Stripe pour une partie de ses traitements) sont établis
          hors de l'Union européenne. Ces transferts sont encadrés par les clauses contractuelles
          types de la Commission européenne.
        </p>
      </Section>

      <Section title="7. Sécurité">
        <p>
          Le contenu des messages est chiffré (AES-256-GCM) avant stockage. L'isolation entre
          organisations clientes repose sur des règles d'accès au niveau de la base de données et
          du moteur de recherche documentaire.
        </p>
      </Section>

      <Section title="8. Cookies">
        <p>
          Le Service utilise uniquement des cookies strictement nécessaires à l'authentification
          et au fonctionnement du compte, exemptés de consentement préalable au titre de la
          réglementation applicable. Aucun cookie publicitaire ou de mesure d'audience tiers n'est
          déposé.
        </p>
      </Section>

      <Section title="9. Droits des personnes concernées">
        <p>
          Toute personne dispose d'un droit d'accès, de rectification, d'effacement, de
          portabilité, d'opposition et de limitation sur ses données personnelles. Ces droits
          s'exercent en écrivant à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, avec
          une réponse apportée dans un délai d'un mois.
        </p>
        <p>
          Toute personne peut également introduire une réclamation auprès de la Commission
          nationale de l'informatique et des libertés (CNIL, www.cnil.fr).
        </p>
      </Section>

      <Section title="10. Mise à jour">
        <p>
          Cette politique de confidentialité peut être mise à jour pour refléter une évolution du
          Service ou de la réglementation. Dernière mise à jour : {LAST_UPDATED}.
        </p>
      </Section>
    </>
  );
}

const PAGES: Record<string, { title: string; Content: () => React.ReactNode }> = {
  'mentions-legales': { title: 'Mentions légales', Content: MentionsLegales },
  confidentialite: { title: 'Politique de confidentialité', Content: Confidentialite },
  cgu: { title: "Conditions générales d'utilisation et de vente", Content: CGU },
};

export default function LegalPage({ params }: { params: { slug: string } }) {
  const page = PAGES[params.slug];
  if (!page) notFound();

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
        <h1 className="text-2xl font-semibold text-slate-900">{page.title}</h1>
        <p className="mt-1 text-xs text-slate-400">Dernière mise à jour : {LAST_UPDATED}</p>
        <Card className="mt-6 p-6">
          <DraftNotice />
          <page.Content />
        </Card>
      </Container>
    </div>
  );
}

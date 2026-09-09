import { Card } from '@/components/ui/Card';
import { Icon, IconBadge, ICONS } from '@/components/icons';

export default function DocsPage() {
  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Documentation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Documentation technique du produit, complétée au fur et à mesure. Revenez ici en cas de
          question sur comment brancher ou déployer un chatbot.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Icon className="h-4 w-4 text-brand-600">{ICONS.chat}</Icon>
          Widget flottant (landing + app)
        </h2>
        <Card className="p-6">
          <p className="text-sm leading-relaxed text-slate-600">
            Une bulle de chat en bas à droite, visible sur toutes les pages (landing publique et
            intérieur de l'app), activée en configurant <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPPORT_CHATBOT_ID</code> dans
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs"> .env</code>. Vide par défaut : le widget ne s'affiche pas tant que la variable n'est
            pas renseignée.
          </p>
          <ol className="mt-4 list-inside list-decimal space-y-1.5 text-sm text-slate-600">
            <li>Créez un chatbot dédié (ex. "Support Corpus.ai").</li>
            <li>
              Uploadez-lui de la documentation produit : vous pouvez directement uploader le{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">README.md</code> ou{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">docs/integration.md</code>{' '}
              du projet, le format <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">.md</code> est supporté à l'upload.
            </li>
            <li>Récupérez son ID (dans l'URL de sa page : <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/dashboard/chatbots/&#123;id&#125;</code>).</li>
            <li>
              Ajoutez <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPPORT_CHATBOT_ID=&#123;id&#125;</code> dans <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">.env</code>.
            </li>
            <li>Redémarrez <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">npm run dev</code>.</li>
          </ol>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Icon className="h-4 w-4 text-brand-600">{ICONS.layers}</Icon>
          Embed iframe pour sites tiers
        </h2>
        <Card className="p-6">
          <p className="text-sm leading-relaxed text-slate-600">
            N'importe quel chatbot peut être embarqué sur un site externe via une iframe pointant
            vers sa page d'embed :
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
{`<iframe
  src="https://votre-domaine.com/embed/{chatbotId}"
  width="380"
  height="560"
  style="border:none;"
></iframe>`}
          </pre>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            La page <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/embed/[chatbotId]</code> est un chat minimal sans navigation, prévu pour
            être chargé en iframe.
          </p>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Icon className="h-4 w-4 text-brand-600">{ICONS.bolt}</Icon>
          Endpoint public
        </h2>
        <Card className="p-6">
          <p className="text-sm leading-relaxed text-slate-600">
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">POST /api/public-chat</code> : même pipeline RAG que le chat authentifié
            (<code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/api/chat</code>), mais sans vérification de session. Utilisé par le widget
            flottant et par <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/embed/[chatbotId]</code>.
          </p>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <IconBadge tone="green" size="sm" spacing="">
            {ICONS.shield}
          </IconBadge>
          Contrôles d'accès pour les embeds publics
        </h2>
        <Card className="p-6">
          <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-slate-700">
            <li>
              <strong>Toggle public / privé</strong> : chaque chatbot a un interrupteur "Accessible
              via le widget public et l'embed" (section "Accès public / embed" de sa page). Désactivé,
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/api/public-chat</code> et{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/embed/[chatbotId]</code> renvoient 404,
              quel que soit le site appelant.
            </li>
            <li>
              <strong>Restriction par domaine</strong> : liste optionnelle de domaines autorisés à
              embarquer le chatbot. Vide = pas de restriction (comportement historique). Appliquée via
              un header CSP <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">frame-ancestors</code> au
              chargement de la page d'embed (bloque le navigateur lui-même sur les sites non listés),
              plus une vérification d'origine sur l'API pour les appels directs.
            </li>
          </ul>
          <p className="mt-3 text-sm text-slate-600">
            Les deux sont opt-in (désactivés par défaut) — un chatbot existant reste accessible comme
            avant tant que son propriétaire n'active pas la restriction.
          </p>
        </Card>
        <p className="text-sm text-emerald-700">
          <strong>Rate limiting : fait.</strong> 20 req/min par (chatbot, IP), blacklist automatique
          24h en cas d'abus soutenu — voir <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">lib/rateLimit.ts</code>.
          Contrôle *combien* d'accès, orthogonal aux deux points ci-dessus qui contrôlent *qui* accède.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900">Idées pour la suite (non fait)</h2>
        <Card className="p-6">
          <ul className="list-inside list-disc space-y-1.5 text-sm text-slate-600">
            <li>Personnalisation visuelle du widget embed (couleurs, position) par client.</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}

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
          <Icon className="h-4 w-4 text-brand-600">{ICONS.layers}</Icon>
          Intégrer un chatbot sur un site tiers
        </h2>
        <Card className="space-y-4 p-6">
          <div>
            <p className="text-sm font-medium text-slate-900">
              Option recommandée : bulle flottante prête à l'emploi
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Une seule ligne à coller avant <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">&lt;/body&gt;</code> :
            </p>
            <pre className="mt-3 overflow-x-auto rounded-md bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
{`<script src="https://votre-domaine.com/widget.js" data-chatbot-id="{chatbotId}"></script>`}
            </pre>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Affiche une bulle en bas à droite qui s'ouvre sur le chat au clic. Le script crée
              lui-même son iframe (pointant vers <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/embed/[chatbotId]?widget=1</code>) et la
              redimensionne selon qu'elle est ouverte ou fermée — rien d'autre à écrire côté client.
            </p>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-900">
              Option alternative : iframe brute, wrapper géré par le client
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Pour un client qui veut son propre positionnement/style (pas de bulle, panneau
              toujours visible dans une sidebar, etc.) :
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
              Cette page (<code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/embed/[chatbotId]</code> sans <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">?widget=1</code>) n'a aucun chrome — elle
              remplit exactement le cadre de l'iframe telle que dimensionnée par le client.
            </p>
          </div>
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
            flottant interne, par <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/embed/[chatbotId]</code> et par le mode bulle
            (<code className="rounded bg-slate-100 px-1 py-0.5 text-xs">?widget=1</code>, voir <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">widget.js</code> ci-dessus).
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

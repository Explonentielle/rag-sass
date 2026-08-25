import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';
import { Card } from '@/components/ui/Card';
import { IconBadge, ICONS } from '@/components/icons';
import { PROMPT_TEMPLATES } from '@/lib/prompts';
import CreateTemplateForm from '@/components/CreateTemplateForm';
import DeleteTemplateButton from '@/components/DeleteTemplateButton';

export default async function TemplatesPage() {
  const org = await getCurrentOrg();
  if (!org) notFound();

  const supabase = createClient();
  const { data: customTemplates } = await supabase
    .from('custom_templates')
    .select('id, label, template, created_at')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Templates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Points de départ pour le comportement de vos chatbots, applicables depuis la page de
            chaque chatbot.
          </p>
        </div>
        <CreateTemplateForm organizationId={org.id} />
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900">Mes templates</h2>
        {(customTemplates ?? []).length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-2 border-dashed p-10 text-center">
            <p className="text-sm font-medium text-slate-600">Aucun template personnalisé</p>
            <p className="text-sm text-slate-400">
              Enregistre un prompt personnalisé depuis la page d'un chatbot, ou crée-en un ici pour
              le réutiliser sur plusieurs chatbots.
            </p>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {(customTemplates ?? []).map((t) => (
              <Card key={t.id} className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <IconBadge size="sm" spacing="">
                      {ICONS.layers}
                    </IconBadge>
                    <h3 className="font-semibold text-slate-900">{t.label}</h3>
                  </div>
                  <DeleteTemplateButton templateId={t.id} />
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-600">
                  {t.template}
                </pre>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900">Templates par défaut</h2>
        <p className="text-sm text-slate-500">
          Fournis avec l'app, non modifiables directement. Utilisez-les comme point de départ, puis
          enregistrez votre version comme template personnalisé si vous voulez la réutiliser.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          {PROMPT_TEMPLATES.map((t) => (
            <Card key={t.id} className="p-6">
              <div className="flex items-center gap-3">
                <IconBadge size="sm" spacing="">
                  {ICONS.document}
                </IconBadge>
                <h3 className="font-semibold text-slate-900">{t.label}</h3>
              </div>
              <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-600">
                {t.template}
              </pre>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

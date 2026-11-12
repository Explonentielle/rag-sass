import { Card } from '@/components/ui/Card';
import type { ChatbotStats, QuestionCount } from '@/lib/chatbotStats';

function formatDay(isoDay: string): string {
  const [, month, day] = isoDay.split('-');
  return `${day}/${month}`;
}

function excerpt(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

function DailyChart({ daily }: { daily: ChatbotStats['daily'] }) {
  const max = Math.max(1, ...daily.map((d) => d.questions));
  const middle = daily[Math.floor(daily.length / 2)];

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-medium text-slate-900">Questions par jour</p>
        <p className="text-xs text-slate-400">max {max}</p>
      </div>
      <div className="flex h-32 items-end gap-[3px] border-b border-slate-200">
        {daily.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-[4px] bg-brand-600 group-hover:bg-brand-800"
              style={{ height: d.questions === 0 ? 0 : `${Math.max((d.questions / max) * 100, 4)}%` }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-card group-hover:block">
              {formatDay(d.date)} : {d.questions} question{d.questions > 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-slate-400">
        <span>{formatDay(daily[0].date)}</span>
        <span>{formatDay(middle.date)}</span>
        <span>{formatDay(daily[daily.length - 1].date)}</span>
      </div>
      <table className="sr-only">
        <caption>Questions par jour</caption>
        <thead>
          <tr>
            <th>Jour</th>
            <th>Questions</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.date}>
              <td>{formatDay(d.date)}</td>
              <td>{d.questions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function QuestionList({
  title,
  description,
  empty,
  items,
}: {
  title: string;
  description: string;
  empty: string;
  items: QuestionCount[];
}) {
  return (
    <Card className="p-4">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.question} className="flex items-start justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 break-words text-slate-700">{excerpt(item.question, 160)}</span>
              {item.count > 1 && (
                <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  ×{item.count}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function ChatbotStatsPanel({
  stats,
  useDocuments,
}: {
  stats: ChatbotStats;
  useDocuments: boolean;
}) {
  if (stats.questions === 0) {
    return (
      <Card className="px-5 py-10 text-center text-sm text-slate-400">
        Aucune question sur les {stats.days} derniers jours. Les statistiques apparaissent dès les premières conversations.
      </Card>
    );
  }

  const unansweredRate = Math.round((stats.unansweredQuestions / stats.questions) * 100);
  const rated = stats.thumbsUp + stats.thumbsDown;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Conversations" value={String(stats.conversations)} hint={`sur ${stats.days} jours`} />
        <StatTile label="Questions" value={String(stats.questions)} />
        {useDocuments && (
          <StatTile
            label="Sans réponse"
            value={String(stats.unansweredQuestions)}
            hint={`${unansweredRate} % des questions`}
          />
        )}
        <StatTile
          label="Retours"
          value={rated === 0 ? '–' : `${stats.thumbsUp} / ${stats.thumbsDown}`}
          hint={rated === 0 ? 'Aucune réponse notée' : 'utiles / pas utiles'}
        />
      </div>

      <DailyChart daily={stats.daily} />

      <div className="grid gap-4 lg:grid-cols-2">
        {useDocuments && (
          <QuestionList
            title="Questions sans réponse"
            description="Le chatbot n'a trouvé aucun passage pertinent dans vos documents. Ajoutez ces informations pour qu'il puisse répondre."
            empty="Aucune question sans réponse sur la période."
            items={stats.unanswered}
          />
        )}
        <QuestionList
          title="Questions les plus posées"
          description="Questions répétées à l'identique (casse et ponctuation mises à part)."
          empty="Aucune question n'a encore été posée plusieurs fois."
          items={stats.topQuestions}
        />
      </div>

      <Card className="p-4">
        <p className="text-sm font-medium text-slate-900">Réponses jugées pas utiles</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Les visiteurs ont cliqué sur « pas utile » : ce sont les réponses à améliorer, en précisant vos documents ou le prompt.
        </p>
        {stats.downvoted.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Aucune réponse mal notée sur la période.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {stats.downvoted.map((item, i) => (
              <li key={`${item.createdAt}-${i}`} className="space-y-1 py-2.5 text-sm">
                <p className="break-words font-medium text-slate-800">
                  {item.question ? excerpt(item.question, 160) : 'Question introuvable'}
                </p>
                <p className="break-words text-slate-500">{excerpt(item.answer, 240)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {stats.truncated && (
        <p className="text-xs text-amber-600">
          Période très active : seuls les messages les plus récents ont été analysés.
        </p>
      )}
    </div>
  );
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, MessageFeedback, MessageRole } from '@/types/database';
import { decryptText } from '@/lib/crypto';
import { ATTACHMENT_MESSAGE_PREFIX } from '@/lib/conversationFiles';
import { logError } from '@/lib/logger';

// Statistiques par chatbot (docs/roadmap.md item 59). Tout est calculé à la
// lecture à partir des messages stockés : pas de table d'agrégats à tenir à jour.

export const STATS_WINDOW_DAYS = 30;
const MAX_ROWS = 6000;
const MAX_LIST_ITEMS = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface StatsMessageRow {
  id: string;
  conversation_id: string;
  role: MessageRole;
  /** Déjà déchiffré. Vide pour une réponse de l'assistant sauf si elle est mal notée. */
  content: string;
  no_context: boolean;
  feedback: MessageFeedback | null;
  created_at: string;
}

export interface QuestionCount {
  question: string;
  count: number;
  lastAskedAt: string;
}

export interface DownvotedAnswer {
  question: string;
  answer: string;
  createdAt: string;
}

export interface ChatbotStats {
  days: number;
  conversations: number;
  questions: number;
  unansweredQuestions: number;
  thumbsUp: number;
  thumbsDown: number;
  /** Une entrée par jour, la plus ancienne en premier. */
  daily: { date: string; questions: number }[];
  /** Questions posées au moins deux fois (formulations identiques à la casse et la ponctuation près). */
  topQuestions: QuestionCount[];
  unanswered: QuestionCount[];
  downvoted: DownvotedAnswer[];
  /** Vrai si la période contenait plus de messages que la limite lue. */
  truncated: boolean;
}

/** Casse, accents et ponctuation neutralisés pour regrouper les formulations identiques. */
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Jour calendaire (YYYY-MM-DD) à l'heure de Paris, pour que "aujourd'hui" parle au client. */
function dayKey(date: Date): string {
  return dayFormatter.format(date);
}

function isQuestionRow(row: StatsMessageRow): boolean {
  return row.role === 'user' && !row.content.startsWith(ATTACHMENT_MESSAGE_PREFIX);
}

function groupByQuestion(entries: { question: string; createdAt: string }[]): QuestionCount[] {
  const groups = new Map<string, QuestionCount>();
  for (const { question, createdAt } of entries) {
    const key = normalizeQuestion(question);
    if (!key) continue;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { question, count: 1, lastAskedAt: createdAt });
    } else {
      existing.count += 1;
      if (createdAt > existing.lastAskedAt) {
        existing.lastAskedAt = createdAt;
        existing.question = question;
      }
    }
  }
  return Array.from(groups.values()).sort(
    (a, b) => b.count - a.count || (a.lastAskedAt < b.lastAskedAt ? 1 : -1)
  );
}

export function computeChatbotStats(
  rows: StatsMessageRow[],
  opts: { days: number; now: Date; truncated?: boolean }
): ChatbotStats {
  const { days, now } = opts;

  const questionRows = rows.filter(isQuestionRow);
  const questionsByConversation = new Map<string, StatsMessageRow[]>();
  for (const row of questionRows) {
    const list = questionsByConversation.get(row.conversation_id) ?? [];
    list.push(row);
    questionsByConversation.set(row.conversation_id, list);
  }
  for (const list of questionsByConversation.values()) {
    list.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  }

  // La question de cette réponse : la dernière question du fil postée au plus
  // tard au moment de la réponse (les deux lignes d'un tour sont écrites dans
  // la même requête, donc avec le même horodatage).
  function questionFor(answer: StatsMessageRow): StatsMessageRow | null {
    const list = questionsByConversation.get(answer.conversation_id);
    if (!list) return null;
    let found: StatsMessageRow | null = null;
    for (const q of list) {
      if (q.created_at <= answer.created_at) found = q;
      else break;
    }
    return found;
  }

  const answerRows = rows.filter((r) => r.role === 'assistant');
  const unansweredEntries: { question: string; createdAt: string }[] = [];
  const downvoted: DownvotedAnswer[] = [];
  let thumbsUp = 0;
  let thumbsDown = 0;

  for (const answer of answerRows) {
    if (answer.feedback === 1) thumbsUp += 1;
    if (answer.feedback === -1) thumbsDown += 1;

    if (answer.no_context) {
      const q = questionFor(answer);
      if (q) unansweredEntries.push({ question: q.content, createdAt: answer.created_at });
    }
    if (answer.feedback === -1 && answer.content && downvoted.length < MAX_LIST_ITEMS) {
      downvoted.push({
        question: questionFor(answer)?.content ?? '',
        answer: answer.content,
        createdAt: answer.created_at,
      });
    }
  }
  downvoted.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const perDay = new Map<string, number>();
  for (const row of questionRows) {
    const key = dayKey(new Date(row.created_at));
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const daily: { date: string; questions: number }[] = [];
  const seen = new Set<string>();
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * MS_PER_DAY));
    if (seen.has(key)) continue;
    seen.add(key);
    daily.push({ date: key, questions: perDay.get(key) ?? 0 });
  }

  return {
    days,
    conversations: questionsByConversation.size,
    questions: questionRows.length,
    unansweredQuestions: unansweredEntries.length,
    thumbsUp,
    thumbsDown,
    daily,
    topQuestions: groupByQuestion(questionRows.map((r) => ({ question: r.content, createdAt: r.created_at })))
      .filter((q) => q.count >= 2)
      .slice(0, MAX_LIST_ITEMS),
    unanswered: groupByQuestion(unansweredEntries).slice(0, MAX_LIST_ITEMS),
    downvoted,
    truncated: opts.truncated ?? false,
  };
}

/**
 * Lit les messages du chatbot sur la période (une requête SQL, la RLS du
 * client s'applique) et calcule les statistiques. `visitorsOnly` écarte les
 * conversations de test des membres de l'équipe : pour un chatbot public, ce
 * sont les visiteurs qui comptent ; pour un assistant interne, tout compte.
 */
export async function loadChatbotStats(
  supabase: SupabaseClient<Database>,
  chatbotId: string,
  opts: { visitorsOnly: boolean; days?: number }
): Promise<ChatbotStats> {
  const days = opts.days ?? STATS_WINDOW_DAYS;
  const now = new Date();
  const since = new Date(now.getTime() - days * MS_PER_DAY).toISOString();

  const { data, error } = await supabase.rpc('chatbot_stats_messages', {
    p_chatbot_id: chatbotId,
    p_since: since,
    p_visitors_only: opts.visitorsOnly,
    p_limit: MAX_ROWS,
  });

  if (error) {
    logError('chatbot_stats.query_failed', { chatbotId, error: error.message });
    throw new Error(`Impossible de charger les statistiques: ${error.message}`);
  }

  const raw = (data ?? []) as Database['public']['Functions']['chatbot_stats_messages']['Returns'];
  // `raw` est trié du plus récent au plus ancien : on ne déchiffre que les
  // réponses mal notées les plus récentes, les autres réponses sont inutiles ici.
  let downvotedDecrypted = 0;
  const rows: StatsMessageRow[] = raw.map((row) => {
    let content = '';
    if (row.role === 'user') {
      content = decryptText(row.content);
    } else if (row.feedback === -1 && downvotedDecrypted < MAX_LIST_ITEMS) {
      downvotedDecrypted += 1;
      content = decryptText(row.content);
    }
    return {
      id: row.id,
      conversation_id: row.conversation_id,
      role: row.role,
      content,
      no_context: row.no_context,
      feedback: row.feedback,
      created_at: row.created_at,
    };
  });

  return computeChatbotStats(rows, { days, now, truncated: raw.length >= MAX_ROWS });
}

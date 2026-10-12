// Agentic tools the chat LLM can call mid-answer (docs/roadmap.md item
// 33, first version — the function-calling pattern validated before
// adding MCP on top). Business logic for each tool lives here; lib/openai.ts
// only knows how to run the generic tool-call loop.
import type { ChatTool } from '@/lib/openai';
import { sendEmail } from '@/lib/email';
import { logInfo, logWarn } from '@/lib/logger';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Appended to the system prompt (lib/prompts.ts's `toolsNote`) whenever
 * this tool is enabled — see buildSystemPrompt's doc comment for why this
 * is necessary: without it, the "answer strictly from documents" framing
 * (every template, plus buildSystemPrompt's own grounding instruction)
 * reads to the model as "never take any action", and it refuses to call
 * the tool even when it's technically offered via the API.
 */
export const SEND_FOLLOW_UP_EMAIL_PROMPT_NOTE = `Tu as aussi accès à un outil, send_follow_up_email, pour envoyer un email de suivi/récapitulatif. Ce n'est PAS une connaissance externe interdite par la règle ci-dessus : c'est une action que tu es explicitement autorisé à réaliser en plus de répondre aux questions. Utilise cet outil quand la personne te demande de lui envoyer quelque chose par email, ou quand un récap par email serait clairement utile — uniquement si elle a donné son adresse email noir sur blanc dans la conversation, jamais une adresse que tu devines ou inventes.`;

/**
 * Sends a follow-up/recap email — chosen as the first agentic action
 * specifically because it needs no third-party OAuth per organization
 * (unlike a calendar), just RESEND_API_KEY (see lib/email.ts). The model
 * is instructed to only use an address the visitor explicitly gave in the
 * conversation, never to invent one; `to` is additionally validated as a
 * plausible email shape here before anything is sent — the instruction
 * alone isn't trusted.
 */
export function createSendFollowUpEmailTool(logCtx: Record<string, unknown>): ChatTool {
  return {
    name: 'send_follow_up_email',
    description:
      "Envoie un email de suivi/récapitulatif à une adresse que la personne a explicitement donnée dans la conversation. N'invente jamais d'adresse : n'utilise cet outil que si une adresse email a été fournie noir sur blanc.",
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: "Adresse email du destinataire, telle que donnée par la personne dans la conversation.",
        },
        subject: { type: 'string', description: "Objet de l'email." },
        body: { type: 'string', description: "Corps de l'email, en texte simple." },
      },
      required: ['to', 'subject', 'body'],
      additionalProperties: false,
    },
    async execute(args) {
      const to = String(args.to ?? '').trim();
      const subject = String(args.subject ?? '').trim();
      const body = String(args.body ?? '').trim();

      if (!EMAIL_RE.test(to)) {
        logWarn('agentic_tool.invalid_email', { ...logCtx, tool: 'send_follow_up_email' });
        return "Échec : l'adresse fournie n'est pas une adresse email valide. Dis-le à la personne sans détail technique.";
      }

      try {
        await sendEmail({ to, subject, body });
        logInfo('agentic_tool.email_sent', { ...logCtx, tool: 'send_follow_up_email' });
        return `Email envoyé avec succès à ${to}.`;
      } catch (err) {
        logWarn('agentic_tool.email_failed', {
          ...logCtx,
          tool: 'send_follow_up_email',
          error: err instanceof Error ? err.message : String(err),
        });
        return "Échec de l'envoi de l'email. Informe la personne que ça n'a pas fonctionné, sans détail technique, et propose une alternative si pertinent.";
      }
    },
  };
}

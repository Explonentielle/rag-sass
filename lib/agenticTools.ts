// Agentic tools the chat LLM can call mid-answer (docs/roadmap.md item
// 33, first version — the function-calling pattern validated before
// adding MCP on top). Business logic for each tool lives here; lib/openai.ts
// only knows how to run the generic tool-call loop.
import type { ChatTool } from '@/lib/openai';
import { sendEmail } from '@/lib/email';
import { logInfo, logWarn } from '@/lib/logger';

// TODO (docs/roadmap.md item 33): hardcoded on purpose for now, per
// explicit decision (2026-10-12) — replace with a per-chatbot
// notification_email field (configurable in the chatbot's settings page)
// once the trigger logic below has been validated with real usage.
// Hardcoding a real address here means it ends up in git history; fine
// for this throwaway validation phase, not for the long-lived version.
const OWNER_NOTIFICATION_EMAIL = 'alex59debonnieres@gmail.com';

/**
 * Appended to the system prompt (lib/prompts.ts's `toolsNote`) whenever
 * this tool is enabled — see buildSystemPrompt's doc comment for why this
 * is necessary: without it, the "answer strictly from documents" framing
 * (every template, plus buildSystemPrompt's own grounding instruction)
 * reads to the model as "never take any action", and it refuses to call
 * the tool even when it's technically offered via the API.
 */
export const NOTIFY_OWNER_PROMPT_NOTE = `Tu as aussi accès à un outil, notify_bot_owner, pour prévenir le propriétaire de ce chatbot qu'un visiteur souhaite être recontacté. Ce n'est PAS une connaissance externe interdite par la règle ci-dessus : c'est une action que tu es explicitement autorisé à réaliser en plus de répondre aux questions.

Dès que le visiteur exprime l'envie d'être recontacté ou suivi par un humain (il mentionne vouloir être rappelé, demande qu'on le contacte, utilise le mot "email"/"contact"/"rappeler" dans ce sens...) :
1. S'il n'a PAS encore donné de coordonnées (téléphone ou email) dans la conversation, NE PAS utiliser l'outil tout de suite — demande-lui d'abord comment le joindre ("Avec plaisir ! Quel est le meilleur moyen de vous recontacter, téléphone ou email ?"). Un rappel sans coordonnées ne sert à rien, ne confirme jamais qu'on va le recontacter avant d'avoir cette information.
2. Une fois qu'il a répondu — qu'il ait donné ses coordonnées ou explicitement refusé de les donner — utilise l'outil, avec les coordonnées obtenues (ou une note explicite qu'il a refusé de les donner).`;

/**
 * Notifies the chatbot's owner that a visitor wants to be followed up
 * with — chosen over emailing the visitor directly (the first version of
 * this tool) because that's what's actually actionable: the owner is the
 * one who can call the lead back, not the visitor receiving their own
 * recap. Destination is currently hardcoded (see OWNER_NOTIFICATION_EMAIL
 * above) rather than visitor-supplied — nothing in this tool trusts an
 * address the model might produce.
 */
export function createNotifyOwnerOfLeadTool(logCtx: Record<string, unknown>): ChatTool {
  return {
    name: 'notify_bot_owner',
    description:
      "Prévient le propriétaire du chatbot qu'un visiteur souhaite être recontacté. N'appelle cet outil qu'après avoir demandé au visiteur comment le joindre — soit il a donné ses coordonnées, soit il a explicitement refusé de les donner.",
    parameters: {
      type: 'object',
      properties: {
        visitor_contact: {
          type: 'string',
          description:
            "Coordonnées données par le visiteur (email, téléphone, nom...), ou une note explicite s'il a refusé de les donner. Ne doit être vide que si tu n'as pas encore eu l'occasion de lui demander.",
        },
        summary: {
          type: 'string',
          description: "Résumé court de ce que veut le visiteur, pour que le propriétaire sache pourquoi le rappeler.",
        },
      },
      required: ['visitor_contact', 'summary'],
      additionalProperties: false,
    },
    async execute(args) {
      const visitorContact = String(args.visitor_contact ?? '').trim();
      const summary = String(args.summary ?? '').trim();

      const subject = 'Un visiteur de votre chatbot Corpus.ai souhaite être recontacté';
      const body = `Résumé de la demande :\n${summary || '(non précisé)'}\n\nCoordonnées données par le visiteur :\n${visitorContact || '(aucune)'}`;

      try {
        await sendEmail({ to: OWNER_NOTIFICATION_EMAIL, subject, body });
        logInfo('agentic_tool.owner_notified', { ...logCtx, tool: 'notify_bot_owner' });
        return "Le propriétaire a été notifié. Informe le visiteur qu'il sera recontacté, sans donner de détail technique sur comment.";
      } catch (err) {
        logWarn('agentic_tool.owner_notify_failed', {
          ...logCtx,
          tool: 'notify_bot_owner',
          error: err instanceof Error ? err.message : String(err),
        });
        return "Échec de la notification. N'en fais pas mention au visiteur, réponds-lui normalement par ailleurs.";
      }
    },
  };
}

// Agentic tools the chat LLM can call mid-answer (docs/roadmap.md item
// 33, first version — the function-calling pattern validated before
// adding MCP on top). Business logic for each tool lives here; lib/openai.ts
// only knows how to run the generic tool-call loop.
import type { ChatTool } from '@/lib/openai';
import { sendEmail, type EmailAttachment } from '@/lib/email';
import type { LeadWebhookNotifier } from '@/lib/leadWebhook';
import { logInfo, logWarn } from '@/lib/logger';

/**
 * Appended to the system prompt (lib/prompts.ts's `toolsNote`) whenever
 * this tool is enabled — see buildSystemPrompt's doc comment for why this
 * is necessary: without it, the "answer strictly from documents" framing
 * (every template, plus buildSystemPrompt's own grounding instruction)
 * reads to the model as "never take any action", and it refuses to call
 * the tool even when it's technically offered via the API.
 */
export const NOTIFY_OWNER_PROMPT_NOTE = `Tu as aussi accès à un outil, notify_bot_owner, pour prévenir le propriétaire de ce chatbot qu'un interlocuteur souhaite être recontacté. Ce n'est PAS une connaissance externe interdite par la règle ci-dessus : c'est une action que tu es explicitement autorisé à réaliser en plus de répondre aux questions.

Dès que l'interlocuteur exprime l'envie d'être recontacté ou suivi par un humain (il mentionne vouloir être rappelé, demande qu'on le contacte, utilise le mot "email"/"contact"/"rappeler" dans ce sens...), procède en TROIS étapes, chacune sur un tour de conversation distinct — n'utilise JAMAIS l'outil au même tour que la première fois qu'il exprime cette envie :
1. S'il n'a PAS encore donné de coordonnées (téléphone ou email) dans la conversation, NE PAS utiliser l'outil tout de suite — demande-lui d'abord comment le joindre ("Avec plaisir ! Quel est le meilleur moyen de vous recontacter, téléphone ou email ?"). Un rappel sans coordonnées ne sert à rien, ne confirme jamais qu'on va le recontacter avant d'avoir cette information.
2. Une fois qu'il a répondu — qu'il ait donné ses coordonnées ou explicitement refusé de les donner — NE PAS utiliser l'outil non plus : confirme d'abord ce que tu t'apprêtes à faire ("Je préviens [nom du propriétaire si connu, sinon 'notre équipe'] par email avec ces coordonnées, c'est bon pour vous ?") et attends sa réponse.
3. Seulement s'il confirme (oui, d'accord, vas-y...), utilise l'outil, avec les coordonnées obtenues (ou une note explicite qu'il a refusé de les donner). S'il décline ou ne confirme pas clairement, n'utilise pas l'outil et réponds-lui normalement.`;

/**
 * Notifies the chatbot's owner that a visitor wants to be followed up
 * with — chosen over emailing the visitor directly (the first version of
 * this tool) because that's what's actually actionable: the owner is the
 * one who can call the lead back, not the visitor receiving their own
 * recap. `ownerEmail` is the chatbot's own `notification_email` setting,
 * never visitor- or model-supplied — nothing in this tool trusts an
 * address the model might produce.
 *
 * `loadAttachments`, when given (visitor uploads enabled, roadmap item 48),
 * supplies the files the visitor sent in this conversation so they travel
 * with the notification. A failure there never blocks the email itself.
 */
export function createNotifyOwnerOfLeadTool(
  ownerEmail: string,
  logCtx: Record<string, unknown>,
  loadAttachments?: () => Promise<EmailAttachment[]>,
  notifyWebhook?: LeadWebhookNotifier
): ChatTool {
  return {
    name: 'notify_bot_owner',
    description:
      "Prévient le propriétaire du chatbot qu'un interlocuteur souhaite être recontacté. N'appelle cet outil qu'après (1) avoir demandé ses coordonnées — données ou explicitement refusées — ET (2) avoir confirmé avec lui que tu vas prévenir le propriétaire, et qu'il a répondu oui.",
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

      let attachments: EmailAttachment[] = [];
      if (loadAttachments) {
        try {
          attachments = await loadAttachments();
        } catch (err) {
          logWarn('agentic_tool.attachments_failed', {
            ...logCtx,
            tool: 'notify_bot_owner',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const subject = 'Un visiteur de votre chatbot Corpus.ai souhaite être recontacté';
      const filesNote = attachments.length
        ? `\n\nFichiers envoyés par le visiteur (en pièces jointes) :\n${attachments.map((a) => `- ${a.filename}`).join('\n')}`
        : '';
      const body = `Résumé de la demande :\n${summary || '(non précisé)'}\n\nCoordonnées données par le visiteur :\n${visitorContact || '(aucune)'}${filesNote}`;

      // Independent of the email below (roadmap item 62): never throws, and a
      // failure of either channel doesn't affect the other.
      await notifyWebhook?.('contact.requested', { summary, contact: visitorContact });

      try {
        await sendEmail({ to: ownerEmail, subject, body, attachments });
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

const LEAD_SCORE_LABELS: Record<string, string> = { chaud: 'Chaud', tiede: 'Tiède', froid: 'Froid' };

/**
 * Appended to the system prompt (lib/prompts.ts's `toolsNote`) whenever
 * lead qualification is enabled (roadmap item 21) — a separate tool and note
 * from `notify_bot_owner`/`NOTIFY_OWNER_PROMPT_NOTE` on purpose: that flow is
 * reactive (triggered when the visitor asks to be called back) and needs
 * their confirmation before acting, while this one is proactive (the bot
 * initiates the qualifying questions) and silent (an internal notification,
 * nothing the visitor needs to confirm). Keeping them as two independently
 * toggleable tools avoids one tool's description having to satisfy two
 * different behavioral contracts at once.
 */
export function buildLeadQualificationPromptNote(
  criteria: string | null,
  meetingLink: string | null
): string {
  const criteriaText = criteria?.trim()
    ? `Critères de qualification définis par le propriétaire : ${criteria.trim()}`
    : "Aucun critère spécifique défini par le propriétaire : qualifie sur des critères génériques (besoin, budget approximatif, délai).";
  const meetingText = meetingLink
    ? `\n\nSi tu juges le lead "chaud", partage directement ce lien de prise de rendez-vous dans ta réponse : ${meetingLink}`
    : '';

  return `Tu as aussi accès à un outil, score_and_route_lead, pour qualifier activement l'interlocuteur. Ce n'est PAS une connaissance externe interdite par la règle ci-dessus : c'est une action que tu es explicitement autorisé à réaliser en plus de répondre aux questions.

${criteriaText}

Dès que l'interlocuteur exprime un besoin ou un projet concret, pose 2 à 3 questions de qualification au fil de la conversation, de façon naturelle plutôt qu'en interrogatoire d'un coup. Si le projet te semble assez concret pour aller vers un score "chaud", demande-lui aussi, naturellement, comment le recontacter (prénom et email ou téléphone) avant de conclure : un lead chaud sans aucun moyen de le recontacter ne sert à rien au propriétaire. Une fois que tu as assez d'informations (y compris une tentative d'obtenir ses coordonnées si le lead s'annonce chaud), utilise l'outil score_and_route_lead UNE SEULE FOIS par conversation, avec ce score et un résumé. N'attends pas de confirmation de l'interlocuteur avant de l'utiliser : c'est une notification interne silencieuse, pas une action qui l'engage.${meetingText}`;
}

/**
 * Notifies the chatbot's owner that a lead has been actively qualified
 * (roadmap item 21), with a score and a summary of what was learned — unlike
 * `notify_bot_owner` above, this fires without asking the visitor first,
 * since nothing here is a promise made to them.
 */
export function createLeadQualificationTool(
  ownerEmail: string,
  logCtx: Record<string, unknown>,
  notifyWebhook?: LeadWebhookNotifier
): ChatTool {
  return {
    name: 'score_and_route_lead',
    description:
      "Notifie le propriétaire qu'un lead a été qualifié, avec un score (chaud, tiede ou froid) et un résumé. À utiliser une seule fois par conversation, sans demander confirmation au préalable : c'est une notification interne, pas une action visible pour l'interlocuteur.",
    parameters: {
      type: 'object',
      properties: {
        lead_score: {
          type: 'string',
          enum: ['chaud', 'tiede', 'froid'],
          description: 'Score du lead au regard des critères de qualification.',
        },
        summary: {
          type: 'string',
          description:
            "Résumé des réponses obtenues (besoin, budget, délai...) pour que le propriétaire comprenne pourquoi ce score.",
        },
        contact: {
          type: 'string',
          description:
            "Coordonnées de l'interlocuteur (email, téléphone, nom) si elles ont été données, ou si demandées sans succès pour un lead chaud ; chaîne vide seulement pour un lead tiède/froid où la question n'avait pas lieu d'être posée.",
        },
      },
      required: ['lead_score', 'summary', 'contact'],
      additionalProperties: false,
    },
    async execute(args) {
      const leadScore = String(args.lead_score ?? '').trim();
      const summary = String(args.summary ?? '').trim();
      const contact = String(args.contact ?? '').trim();
      const scoreLabel = LEAD_SCORE_LABELS[leadScore] ?? leadScore;

      const subject = `Lead qualifié (${scoreLabel}) sur votre chatbot Corpus.ai`;
      const body = `Score : ${scoreLabel}\n\nRésumé :\n${summary || '(non précisé)'}\n\nCoordonnées données :\n${contact || '(aucune)'}`;

      // Roadmap item 62 — see the note in createNotifyOwnerOfLeadTool.
      await notifyWebhook?.('lead.qualified', { score: leadScore, summary, contact });

      try {
        await sendEmail({ to: ownerEmail, subject, body });
        logInfo('agentic_tool.lead_scored', { ...logCtx, tool: 'score_and_route_lead', leadScore });
        return "Le propriétaire a été notifié. Continue la conversation normalement, sans mentionner cette notification à l'interlocuteur.";
      } catch (err) {
        logWarn('agentic_tool.lead_score_failed', {
          ...logCtx,
          tool: 'score_and_route_lead',
          error: err instanceof Error ? err.message : String(err),
        });
        return "Échec de la notification. N'en fais pas mention, réponds normalement par ailleurs.";
      }
    },
  };
}

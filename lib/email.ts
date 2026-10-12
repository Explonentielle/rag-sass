// Transactional email sending for app-triggered content (docs/roadmap.md
// item 33's first agentic tool) — distinct from Supabase Auth's own SMTP
// config (invitations, email change, see docs/deployment.md §3): those
// are Supabase's own emails, sent by Supabase itself. This is our app
// sending arbitrary content directly, via Resend's REST API.
export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Envoi d'email non configuré (RESEND_API_KEY manquante).");
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'no-reply@corpus-ai.fr',
      to: params.to,
      subject: params.subject,
      text: params.body,
      ...(params.attachments?.length
        ? {
            attachments: params.attachments.map((a) => ({
              filename: a.filename,
              content: a.content.toString('base64'),
            })),
          }
        : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend a répondu ${res.status}: ${detail}`);
  }
}

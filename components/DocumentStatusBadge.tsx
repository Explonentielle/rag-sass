import { Badge } from '@/components/ui/Card';
import type { DocumentStatus } from '@/types/database';

const TONES = {
  pending: 'neutral',
  processing: 'blue',
  indexed: 'green',
  error: 'red',
} as const;

const LABELS: Record<DocumentStatus, string> = {
  pending: 'En attente',
  processing: 'Traitement...',
  indexed: 'Indexé',
  error: 'Erreur',
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={TONES[status]}>{LABELS[status]}</Badge>;
}

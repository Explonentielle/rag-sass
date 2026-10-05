'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Card';

export default function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (email.trim().toLowerCase() === currentEmail.toLowerCase()) {
      setError("C'est déjà votre adresse actuelle.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    // Supabase sends a confirmation email to the new address — the change
    // only takes effect once that link is clicked (see Supabase Auth
    // settings > "Secure email change", on by default). Needs a custom
    // SMTP provider configured in Supabase to actually reach the inbox in
    // production — see docs/deployment.md.
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setEmail('');
    setSuccess(true);
    setOpen(false);
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <Button size="sm" onClick={() => setOpen(true)}>
          Changer l&apos;email
        </Button>
        {success && (
          <p className="text-sm text-emerald-600">
            Vérifiez votre nouvelle boîte mail pour confirmer le changement.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Nouvelle adresse email</Label>
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nouveau@exemple.com"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? 'Envoi...' : 'Envoyer la confirmation'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setOpen(false);
            setError(null);
            setEmail('');
          }}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, Input, Label } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';

// Landing page for someone who just accepted a team invite (see
// app/auth/callback/route.ts, which redirects type=invite links here
// instead of straight to /dashboard). An invited account has no password
// yet — only this one-time session from the invite link — so this has to
// be the first stop, or the person could never log back in afterwards.
export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Logo />
          </Link>
        </div>

        <Card className="p-8">
          <h1 className="text-lg font-semibold text-slate-900">Bienvenue sur Corpus.ai</h1>
          <p className="mt-1 text-sm text-slate-500">
            Choisissez un mot de passe pour votre compte avant de continuer.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Mot de passe</Label>
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Confirmer le mot de passe</Label>
              <Input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Enregistrement...' : 'Continuer'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

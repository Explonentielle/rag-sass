'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, Input, Label } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';

export default function SignupPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    // If email confirmation is disabled in the Supabase project (recommended
    // for the pilot), signUp() returns an active session immediately and we
    // can create the organization right away. Otherwise the user must
    // confirm their email first; org creation happens after they log in
    // for the first time (see dashboard page's onboarding check).
    if (data.session) {
      const { error: orgError } = await supabase.rpc('create_organization', {
        org_name: orgName,
      });
      setLoading(false);
      if (orgError) {
        setError(orgError.message);
        return;
      }
      router.push('/dashboard');
      router.refresh();
      return;
    }

    setLoading(false);
    setPendingConfirmation(true);
  }

  if (pendingConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <Logo />
          </div>
          <Card className="p-8 text-center">
            <h1 className="text-lg font-semibold text-slate-900">Vérifiez votre boîte mail</h1>
            <p className="mt-2 text-sm text-slate-500">
              Un email de confirmation a été envoyé à <span className="font-medium">{email}</span>.
              Cliquez sur le lien pour activer votre compte, puis connectez-vous.
            </p>
          </Card>
        </div>
      </div>
    );
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
          <h1 className="text-lg font-semibold text-slate-900">Créer un compte</h1>
          <p className="mt-1 text-sm text-slate-500">Démarrez votre pilote gratuit.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Nom de l'entreprise</Label>
              <Input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

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

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Création...' : 'Créer le compte'}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-500">
          Déjà un compte ?{' '}
          <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

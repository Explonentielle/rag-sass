'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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
    // confirm their email first — org creation happens after they log in
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-sm space-y-2 rounded-lg border bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Vérifie ta boîte mail</h1>
          <p className="text-sm text-gray-600">
            Un email de confirmation a été envoyé à {email}. Clique sur le lien pour activer ton
            compte, puis connecte-toi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Créer un compte</h1>

        <div className="space-y-1">
          <label className="text-sm font-medium">Nom de l'entreprise</label>
          <input
            type="text"
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Mot de passe</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-gray-900 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Création...' : 'Créer le compte'}
        </button>

        <p className="text-center text-sm text-gray-600">
          Déjà un compte ?{' '}
          <Link href="/login" className="font-medium text-gray-900 underline">
            Se connecter
          </Link>
        </p>
      </form>
    </div>
  );
}

"use client";
import { useEffect, useState } from 'react';
import { useFirebaseUser } from '@/hooks/useFirebaseUser';
import { promoteCurrentUserToAdmin } from '@/lib/user';

export default function PromoteAdminPage() {
  const { user, loading } = useFirebaseUser();
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>( 'idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      try {
        setStatus('working');
        await promoteCurrentUserToAdmin();
        setStatus('done');
        setMessage('Your account has been promoted to admin. You can now access /admin.');
      } catch (e: any) {
        setStatus('error');
        setMessage(e?.message || 'Failed to promote to admin');
      }
    })();
  }, [loading, user]);

  if (loading) return null;

  if (!user) {
    return (
      <main className="max-w-md mx-auto p-6">
        <p className="text-sm text-gray-600">Please sign in first.</p>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-2">Promote to Admin</h1>
      <p className="text-sm mb-4">Signed in as {user.email || user.uid}</p>
      <div className="rounded border p-4">
        <p className="text-sm">{status === 'working' ? 'Updating role…' : message || 'Preparing…'}</p>
      </div>
    </main>
  );
}



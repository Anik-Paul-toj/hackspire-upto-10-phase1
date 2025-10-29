"use client";
import { signInWithGoogle, signOutUser } from '@/lib/auth';
import { useFirebaseUser } from '@/hooks/useFirebaseUser';

export default function FirebaseAuthButtons() {
  const { user, loading } = useFirebaseUser();

  if (loading) return null;

  if (!user) {
    return (
      <button
        onClick={() => signInWithGoogle()}
        className="inline-flex items-center rounded-md bg-black px-3 py-2 text-white hover:bg-gray-800"
      >
        Continue with Google
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <img src={user.photoURL ?? ''} alt="avatar" className="h-8 w-8 rounded-full" />
      <span className="text-sm">{user.displayName ?? user.email}</span>
      <button
        onClick={() => signOutUser()}
        className="inline-flex items-center rounded-md border px-3 py-2 hover:bg-gray-50"
      >
        Sign out
      </button>
    </div>
  );
}



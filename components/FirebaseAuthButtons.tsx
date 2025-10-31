"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle, signOutUser } from '@/lib/auth';
import { useFirebaseUser } from '@/hooks/useFirebaseUser';
import UserAvatar from './UserAvatar';

export default function FirebaseAuthButtons() {
  const { user, loading } = useFirebaseUser();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const router = useRouter();

  const handleSignIn = async () => {
    if (isSigningIn) return;

    try {
      setIsSigningIn(true);
      const { user, role } = await signInWithGoogle();
      
      // Route based on role
      if (role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/tourist');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      if (error instanceof Error && error.message.includes('popup is already open')) {
        alert('Please complete or close the existing login popup first.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) return null;

  if (!user) {
    return (
      <button
        onClick={handleSignIn}
        disabled={isSigningIn}
        className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSigningIn ? 'Signing in...' : 'Continue with Google'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <UserAvatar user={user} size={32} />
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



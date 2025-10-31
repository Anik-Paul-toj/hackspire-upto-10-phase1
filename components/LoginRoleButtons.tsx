"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle } from '@/lib/auth';
import { setUserRole } from '@/lib/user';

interface LoginRoleButtonsProps {
  isMobile?: boolean;
}

export default function LoginRoleButtons({ isMobile = false }: LoginRoleButtonsProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const router = useRouter();

  const signInAsAdmin = async () => {
    // Prevent multiple simultaneous sign-in attempts
    if (isSigningIn) {
      return;
    }

    try {
      setIsSigningIn(true);
      const { user } = await signInWithGoogle();
      await setUserRole(user.uid, 'admin');
      router.push('/admin');
    } catch (error) {
      console.error('Sign in error:', error);
      // Show a user-friendly error message if needed
      if (error instanceof Error && error.message.includes('popup is already open')) {
        alert('Please complete or close the existing login popup first.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };
  
  if (isMobile) {
    // Mobile layout: stacked buttons, full width, smaller text
    return (
      <div className="flex flex-col gap-2 w-full">
        <button 
          onClick={signInAsAdmin}
          disabled={isSigningIn}
          className="w-full rounded-md bg-green-600 px-3 py-2 text-xs text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSigningIn ? 'Signing in...' : 'Login as Admin'}
        </button>
      </div>
    );
  }
  
  // Desktop layout: side by side
  return (
    <div className="flex items-center gap-2">
      <button 
        onClick={signInAsAdmin}
        disabled={isSigningIn}
        className="rounded-md bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSigningIn ? 'Signing in...' : 'Login as Admin'}
      </button>
    </div>
  );
}



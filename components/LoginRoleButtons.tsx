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

  const signInAs = async (role: 'tourist' | 'admin') => {
    // Prevent multiple simultaneous sign-in attempts
    if (isSigningIn) {
      return;
    }

    try {
      setIsSigningIn(true);
      const { user } = await signInWithGoogle();
      await setUserRole(user.uid, role);
      
      // Route based on role
      if (role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/tourist');
      }
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
          onClick={() => signInAs('tourist')}
          disabled={isSigningIn}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSigningIn ? 'Signing in...' : 'Login as Tourist'}
        </button>
        <button 
          onClick={() => signInAs('admin')}
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
        onClick={() => signInAs('tourist')}
        disabled={isSigningIn}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSigningIn ? 'Signing in...' : 'Login as Tourist'}
      </button>
      <button 
        onClick={() => signInAs('admin')}
        disabled={isSigningIn}
        className="rounded-md bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSigningIn ? 'Signing in...' : 'Login as Admin'}
      </button>
    </div>
  );
}



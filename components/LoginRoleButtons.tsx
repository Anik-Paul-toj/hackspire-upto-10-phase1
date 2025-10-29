"use client";
import { signInWithGoogle } from '@/lib/auth';
import { setUserRole } from '@/lib/user';

export default function LoginRoleButtons() {
  const signInAs = async (role: 'tourist' | 'admin') => {
    try {
      const user = await signInWithGoogle();
      await setUserRole(user.uid, role);
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };
  
  return (
    <div className="flex items-center gap-2">
      <button 
        onClick={() => signInAs('tourist')} 
        className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
      >
        Login as Tourist
      </button>
      <button 
        onClick={() => signInAs('admin')} 
        className="rounded-md bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 transition-colors"
      >
        Login as Admin
      </button>
    </div>
  );
}



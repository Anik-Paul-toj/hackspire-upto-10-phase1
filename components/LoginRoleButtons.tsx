"use client";
import { signInWithGoogle } from '@/lib/auth';
import { setUserRole } from '@/lib/user';

export default function LoginRoleButtons() {
  const signInAs = async (role: 'tourist' | 'admin') => {
    const user = await signInWithGoogle();
    await setUserRole(user.uid, role);
  };
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => signInAs('tourist')} className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">Login as Tourist</button>
      <button onClick={() => signInAs('admin')} className="rounded-md bg-black px-3 py-2 text-sm text-white hover:bg-gray-800">Login as Admin</button>
    </div>
  );
}



"use client";
import { useUserProfileContext } from '@/contexts/UserProfileProvider';
import { setUserRole } from '@/lib/user';

export default function RoleSwitcher() {
  const { user, profile } = useUserProfileContext();
  if (!user) return null;
  const current = profile?.role ?? 'tourist';
  const onSet = async (role: 'tourist' | 'admin') => {
    await setUserRole(user.uid, role);
  };
  return (
    <div className="flex items-center gap-2 text-sm">
      <span>Role: <b>{current}</b></span>
      <button onClick={() => onSet('tourist')} className="rounded-md border px-2 py-1 hover:bg-gray-50">Tourist</button>
      <button onClick={() => onSet('admin')} className="rounded-md border px-2 py-1 hover:bg-gray-50">Admin</button>
    </div>
  );
}



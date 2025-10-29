"use client";
import { useUserProfileContext } from '@/contexts/UserProfileProvider';
import { setUserRole } from '@/lib/user';

interface RoleSwitcherProps {
  isMobile?: boolean;
}

export default function RoleSwitcher({ isMobile = false }: RoleSwitcherProps) {
  const { user, profile } = useUserProfileContext();
  
  if (!user) return null;
  
  const current = profile?.role ?? 'tourist';
  
  // Only show role switcher for admins
  if (current !== 'admin') {
    return (
      <div className={`flex items-center gap-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
        <span className="text-gray-600">
          Role: <span className="font-semibold text-green-600">{current}</span>
        </span>
      </div>
    );
  }
  
  const onSet = async (role: 'tourist' | 'admin') => {
    try {
      await setUserRole(user.uid, role);
    } catch (error) {
      console.error('Role switch error:', error);
    }
  };
  
  if (isMobile) {
    // Mobile: stack buttons vertically for better touch targets
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-600">
          Role: <span className="font-semibold text-green-600">{current}</span>
        </span>
        <div className="flex gap-1">
          <button 
            onClick={() => onSet('tourist')} 
            className="flex-1 border border-gray-300 hover:bg-gray-50 rounded px-2 py-1 text-xs transition-colors"
          >
            Tourist
          </button>
          <button 
            onClick={() => onSet('admin')} 
            className="flex-1 bg-green-600 text-white rounded px-2 py-1 text-xs transition-colors"
          >
            Admin
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-600">
        Role: <span className="font-semibold text-green-600">{current}</span>
      </span>
      <div className="flex gap-1">
        <button 
          onClick={() => onSet('tourist')} 
          className="border border-gray-300 hover:bg-gray-50 rounded px-2 py-1 text-xs transition-colors"
        >
          Tourist
        </button>
        <button 
          onClick={() => onSet('admin')} 
          className="bg-green-600 text-white rounded px-2 py-1 text-xs transition-colors"
        >
          Admin
        </button>
      </div>
    </div>
  );
}



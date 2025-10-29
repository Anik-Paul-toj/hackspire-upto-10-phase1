"use client";
import Image from "next/image";
import { useState } from "react";
import type { User } from "firebase/auth";

interface UserAvatarProps {
  user: User;
  size?: number;
  className?: string;
}

export default function UserAvatar({ user, size = 32, className = "" }: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  
  const initials = (user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase();
  
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      {user.photoURL && !imageError ? (
        <Image
          src={user.photoURL}
          alt={`${user.displayName || 'User'} avatar`}
          width={size}
          height={size}
          className="rounded-full object-cover border border-gray-200"
          unoptimized={true}
          onError={() => setImageError(true)}
          priority={false}
        />
      ) : (
        <div 
          className="rounded-full bg-green-600 flex items-center justify-center text-white font-semibold border border-gray-200"
          style={{ 
            width: size, 
            height: size, 
            fontSize: size < 40 ? '12px' : '16px' 
          }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}
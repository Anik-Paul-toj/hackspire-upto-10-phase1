"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfileContext } from '@/contexts/UserProfileProvider';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });
const LocationSync = dynamic(() => import('@/components/LocationSync'), { ssr: false });
const SOSPanel = dynamic(() => import('@/components/SOSPanel'), { ssr: false });

export default function TouristPage() {
  const { user, profile, userLoading, profileLoading } = useUserProfileContext();
  const router = useRouter();

  useEffect(() => {
    if (userLoading || profileLoading) return;
    if (!user) {
      router.replace('/');
      return;
    }
    if (profile && profile.role !== 'tourist') {
      router.replace('/admin');
    }
  }, [user, profile, userLoading, profileLoading, router]);

  return (
    <main className="min-h-screen px-0 py-0">
      <LocationSync />
      <MapView fullScreen />
      <SOSPanel />
    </main>
  );
}



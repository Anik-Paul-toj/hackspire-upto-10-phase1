"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfileContext } from '@/contexts/UserProfileProvider';
import dynamic from 'next/dynamic';

const AdminDashboard = dynamic(() => import('@/components/AdminDashboard'), { ssr: false });

export default function AdminPage() {
  const { user, profile, userLoading, profileLoading } = useUserProfileContext();
  const router = useRouter();

  useEffect(() => {
    if (userLoading || profileLoading) return;
    if (!user) {
      router.replace('/');
      return;
    }
    if (profile && profile.role !== 'admin') {
      router.replace('/tourist');
    }
  }, [user, profile, userLoading, profileLoading, router]);

  return (
    <main className="min-h-screen py-6">
      <AdminDashboard />
    </main>
  );
}



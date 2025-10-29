"use client";
import dynamic from 'next/dynamic';

const StatusDashboard = dynamic(() => import('@/components/StatusDashboard'), { ssr: false });
const MeshPanel = dynamic(() => import('@/components/MeshPanel'), { ssr: false });

export default function StatusPage() {
  return (
    <main className="min-h-screen py-6">
      <div className="container mx-auto px-6 space-y-6">
        <StatusDashboard />
        <MeshPanel />
      </div>
    </main>
  );
}



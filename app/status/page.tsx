"use client";
import dynamic from 'next/dynamic';

const StatusDashboard = dynamic(() => import('@/components/StatusDashboard'), { ssr: false });
const MeshPanel = dynamic(() => import('@/components/MeshPanel'), { ssr: false });

export default function StatusPage() {
  return (
    <main className="min-h-screen py-4 sm:py-6">
      <div className="container mx-auto px-4 sm:px-6 space-y-4 sm:space-y-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            System Status Dashboard
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Monitor your safety profile, location, and emergency mesh network
          </p>
        </div>
        <StatusDashboard />
        <MeshPanel />
      </div>
    </main>
  );
}



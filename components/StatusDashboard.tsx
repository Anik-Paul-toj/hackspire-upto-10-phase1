"use client";
import Link from 'next/link';
import { useUserProfileContext } from '@/contexts/UserProfileProvider';
import { useUserLocationDoc } from '@/hooks/useUserLocationDoc';
import dynamic from 'next/dynamic';

const FirebaseAuthButtons = dynamic(() => import('@/components/FirebaseAuthButtons'), { ssr: false });
const LocationSync = dynamic(() => import('@/components/LocationSync'), { ssr: false });
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function StatusDashboard() {
  const { user, profile, userLoading, profileLoading } = useUserProfileContext();
  const { data: locationDoc, loading: locationLoading } = useUserLocationDoc(user);

  return (
    <div className="container mx-auto px-6 py-8 grid gap-6 lg:grid-cols-3">
      <section className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Authentication</h2>
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {userLoading ? 'Loading...' : user ? `Signed in as ${user.email}` : 'Signed out'}
          </div>
          <FirebaseAuthButtons />
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Profile</h2>
        {profileLoading ? (
          <div className="text-sm text-gray-700">Loading...</div>
        ) : profile ? (
          <ul className="text-sm text-gray-800 space-y-1">
            <li>Name: {profile.name}</li>
            <li>Email: {profile.email}</li>
            <li>Role: {profile.role}</li>
            <li>Verified: {profile.verified ? 'Yes' : 'No'}</li>
          </ul>
        ) : (
          <div className="text-sm text-gray-700">No profile</div>
        )}
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Utilities</h2>
        <div className="flex gap-3">
          <Link href="/seed" className="inline-flex items-center rounded-md border px-3 py-2 hover:bg-gray-50 text-sm">Seed data</Link>
          <Link href="/map" className="inline-flex items-center rounded-md border px-3 py-2 hover:bg-gray-50 text-sm">Open map</Link>
        </div>
      </section>

      <section className="rounded-lg border p-4 lg:col-span-2">
        <h2 className="font-semibold mb-3">Location</h2>
        <LocationSync />
        {locationLoading ? (
          <div className="text-sm text-gray-700">Loading...</div>
        ) : locationDoc ? (
          <div className="text-sm text-gray-800">
            <div>Latest: lat {locationDoc.latestLocation?.lat?.toFixed?.(6)}, lng {locationDoc.latestLocation?.lng?.toFixed?.(6)}</div>
            <div>History size: {Array.isArray(locationDoc.history) ? locationDoc.history.length : 0}</div>
          </div>
        ) : (
          <div className="text-sm text-gray-700">No location yet</div>
        )}
      </section>

      <section className="rounded-lg border p-2 lg:col-span-3">
        <MapView fullScreen={false} />
      </section>
    </div>
  );
}



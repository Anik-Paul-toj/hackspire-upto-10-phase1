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
    <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
      <section className="rounded-lg border bg-white shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <h2 className="font-semibold text-lg">Authentication</h2>
        </div>
        <div className="space-y-3">
          <div className="text-sm text-gray-700">
            {userLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-green-600 rounded-full"></div>
                Loading...
              </div>
            ) : user ? (
              <div className="space-y-1">
                <div className="font-medium text-green-600">✓ Signed in</div>
                <div className="text-xs text-gray-500 truncate">{user.email}</div>
              </div>
            ) : (
              <div className="text-red-600">✗ Signed out</div>
            )}
          </div>
          <div className="pt-2 border-t">
            <FirebaseAuthButtons />
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full ${profile ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
          <h2 className="font-semibold text-lg">Profile</h2>
        </div>
        {profileLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
            Loading...
          </div>
        ) : profile ? (
          <div className="space-y-2">
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Name:</span>
                <span className="text-sm font-medium">{profile.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Role:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  profile.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                }`}>
                  {profile.role}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Verified:</span>
                <span className={`text-sm ${profile.verified ? 'text-green-600' : 'text-red-600'}`}>
                  {profile.verified ? '✓ Yes' : '✗ No'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-4">
            No profile data available
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-white shadow-sm p-4 sm:p-6 md:col-span-2 lg:col-span-1">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
          <h2 className="font-semibold text-lg">Quick Actions</h2>
        </div>
        <div className="space-y-3">
          <Link 
            href="/map" 
            className="flex items-center justify-center gap-2 w-full rounded-md bg-green-600 px-4 py-3 text-white hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Open Safety Map
          </Link>
          <Link 
            href="/seed" 
            className="flex items-center justify-center gap-2 w-full rounded-md border border-gray-300 px-4 py-3 hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Seed Test Data
          </Link>
        </div>
      </section>

      <section className="rounded-lg border bg-white shadow-sm p-4 sm:p-6 md:col-span-2 lg:col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full ${locationDoc ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          <h2 className="font-semibold text-lg">Location Status</h2>
        </div>
        <div className="space-y-4">
          <LocationSync />
          {locationLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-green-600 rounded-full"></div>
              Loading location data...
            </div>
          ) : locationDoc ? (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <span className="text-xs text-gray-500">Latest Position:</span>
                <span className="text-sm font-mono">
                  {locationDoc.latestLocation?.lat?.toFixed?.(6)}, {locationDoc.latestLocation?.lng?.toFixed?.(6)}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <span className="text-xs text-gray-500">History Size:</span>
                <span className="text-sm font-medium">
                  {Array.isArray(locationDoc.history) ? locationDoc.history.length : 0} entries
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div className="text-sm">No location data available</div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-white shadow-sm p-2 sm:p-4 md:col-span-2 lg:col-span-3">
        <div className="flex items-center gap-2 mb-3 px-2">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <h2 className="font-semibold text-lg">Live Map</h2>
        </div>
        <div className="rounded-lg overflow-hidden">
          <MapView fullScreen={false} />
        </div>
      </section>
    </div>
  );
}



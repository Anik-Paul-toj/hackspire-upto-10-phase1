/**
 * Type definitions for the admin collection in Firestore
 */

export interface AdminDoc {
  userId: string;
  name: string;
  email: string;
  photoURL?: string;
  verified: boolean;
  promotedAt: unknown; // Firestore Timestamp
  lastActive: unknown; // Firestore Timestamp
  isActive: boolean;
}

export interface AdminWithId extends AdminDoc {
  id: string;
}
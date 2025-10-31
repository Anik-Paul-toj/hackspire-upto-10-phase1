# Admin Collection Documentation

## Overview
The `admin` collection in Firestore stores information about users who have admin privileges. This collection is automatically populated when a user is promoted to admin role.

## Collection Structure

### Document ID
- The document ID is the same as the user's UID from Firebase Authentication

### Document Fields

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | The Firebase Auth UID of the admin user |
| `name` | string | Display name of the admin |
| `email` | string | Email address of the admin |
| `photoURL` | string (optional) | Profile photo URL |
| `verified` | boolean | Whether the admin account is verified |
| `promotedAt` | Timestamp | When the user was promoted to admin |
| `lastActive` | Timestamp | Last time the admin was active |
| `isActive` | boolean | Whether the admin is currently active |

## Automatic Population

The admin collection is automatically populated in the following scenarios:

1. **Login as Admin**: When a user signs in using the "Login as Admin" button
2. **User Promotion**: When a user is promoted to admin using `promoteCurrentUserToAdmin()`
3. **Admin Activity**: The `lastActive` field is updated when an admin accesses the admin dashboard

## Security Rules

- **Read**: Only admins can read from the admin collection
- **Create/Update**: Only admins can create or update their own document
- **Delete**: Only admins can delete documents from the collection

## Usage Examples

### Getting All Active Admins
```typescript
import { useAdmins } from '@/hooks/useAdmins';

const { admins, loading } = useAdmins();
```

### Getting Specific Admin
```typescript
import { getAdminById } from '@/lib/user';

const admin = await getAdminById(userId);
```

### Updating Admin Activity
```typescript
import { updateAdminActivity } from '@/lib/user';

await updateAdminActivity(userId);
```

## Related Files

- `lib/user.ts` - Admin-related functions
- `hooks/useAdmins.ts` - React hook for real-time admin data
- `types/admin.ts` - TypeScript type definitions
- `firestore.rules` - Security rules for the admin collection
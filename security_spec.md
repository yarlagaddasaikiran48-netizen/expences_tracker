# Security Specification — Kerala Trip Expense Tracker

## 1. Data Invariants
1. **Authenticated & Verified Access Only**: Every read and write requires an authenticated user with a verified email (`request.auth != null && request.auth.token.email_verified == true`).
2. **No Blanket Reads**: Users can only `get` or `list` trips where they are the `ownerId`, in `memberUids`, or explicitly listed in `invitedEmails`.
3. **Master Gate on Subcollections**: Every `get`, `create`, `update`, and `delete` on `/trips/{tripId}/expenses/{expenseId}` and `/trips/{tripId}/settlements/{settlementId}` verifies parent trip existence and membership via `get()`.
4. **Secure List Queries**: `allow list` on `trips`, `expenses`, and `settlements` validates `resource.data` directly against `request.auth.uid` (or `request.auth.token.email` for trip invites) with zero `get()` or `exists()` calls inside `allow list`.
5. **Identity & Temporal Integrity**: `ownerId` and `authorId` must equal `request.auth.uid` on create and remain immutable on update. `createdAt` must equal `request.time` on create and remain immutable on update. `updatedAt` must equal `request.time` on create and update.
6. **Bounded Arrays & String Lengths**: Every string enforces `.size()` limits, every ID enforces `^[a-zA-Z0-9_\\-]+$`, and every array enforces `.size() <= 20` with first-element type validation.
7. **Strict Key Allowlisting**: Create enforces `hasAll` + `hasOnly` to reject shadow fields. Update uses action-based branches with `affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Trip Create**: `{ name: "Kerala", ... }` with `auth = null`.
2. **Unverified Email Trip Create**: Valid Trip payload with `auth.token.email_verified = false`.
3. **Identity Spoofing on Trip Create**: `ownerId: "victim-uid"` while `auth.uid = "attacker-uid"`.
4. **Shadow Field Injection on Trip Create**: Valid Trip payload plus `isAdmin: true`.
5. **Client Timestamp Forgery**: `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
6. **ID Poisoning**: Document ID `tripId` containing >128 chars or `/` / `$` characters.
7. **Orphan Expense Create**: Creating `/trips/nonexistent/expenses/e1` when parent trip does not exist.
8. **Unauthorized Expense Create**: Creating an expense in another user's trip when not in `memberUids`.
9. **Negative or Zero Expense Amount**: `{ ..., amount: -500 }` or `amount: 0`.
10. **Oversized Array / Denial of Wallet**: `splitAmong` array with 25 elements (`> 20`).
11. **Immutable Field Mutation on Expense Update**: Updating `authorId` or `createdAt` on an existing expense.
12. **Blanket List Query Scraping**: Listing `/trips/{tripId}/expenses` without filtering to `tripOwnerId` or `tripMemberUids`.

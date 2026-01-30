# Partner Dashboard Loading Issue - Root Cause Analysis

## Executive Summary

Partner dashboards are experiencing infinite loading states because the assignment deduplication logic filters out assignments that only have `companyCode` without `organizationId`. This leaves partners with zero assignments, causing empty organization and user lists.

---

## Architecture Overview

### Data Flow
```
User Login (Partner Role)
    ↓
usePartnerAdminSnapshot
    ├→ Listen to partners/{uid} document (Legacy source)
    └→ Query organizations where transformationPartnerId == uid (Source of Truth)
    ↓
Merge & Deduplicate assignments
    ↓
usePartnerOrganizations (uses assignedOrganizationIds)
    ↓
usePartnerUsers (uses assignedOrgKeys)
    ↓
Partner Dashboard Displays Data
```

### Assignment Data Structure

Partners can be assigned to organizations in two ways:

#### 1. Legacy: Partner Document
**Collection:** `partners/{partnerId}`
**Field:** `assignedOrganizations`
**Format:** Array of strings OR objects
```typescript
// String format (organization document ID)
assignedOrganizations: ["s1nzr7yaee16x4fdhztd", "abc123xyz"]

// Object format (with metadata)
assignedOrganizations: [
  { organizationId: "s1nzr7yaee16x4fdhztd", companyCode: "wmxhop", status: "active" },
  { organizationId: "abc123xyz", companyCode: "acme", status: "active" }
]

// Mixed format (some only have companyCode)
assignedOrganizations: [
  { organizationId: "s1nzr7yaee16x4fdhztd", companyCode: "wmxhop", status: "active" },
  { companyCode: "acme", status: "active" } // ← Missing organizationId!
]
```

#### 2. Source of Truth: Organizations Collection
**Collection:** `organizations`
**Field:** `transformationPartnerId`
**Query:** `where('transformationPartnerId', '==', partnerId)`
```typescript
// Organization document structure
{
  id: "s1nzr7yaee16x4fdhztd", // Firestore document ID
  code: "wmxhop",              // Human-readable code
  name: "WMX Hospitality",
  transformationPartnerId: "partner-uid-123",
  status: "active"
}
```

---

## Critical Bugs Identified

### Bug #1: Assignment Deduplication Filters Out `companyCode`-only Assignments

**Location:** [usePartnerAdminSnapshot.ts:65-71](src/hooks/partner/usePartnerAdminSnapshot.ts#L65-L71)

**Current Code:**
```typescript
allAssignments.forEach((assignment) => {
  const id = assignment.organizationId
  if (id && !seenIds.has(id)) {  // ← BUG HERE
    seenIds.add(id)
    uniqueAssignments.push(assignment)
  }
})
```

**Problem:**
- Only assignments with `organizationId` are kept
- Assignments with only `companyCode` are silently dropped
- This results in empty `assignedOrganizationIds` array

**Example Scenario:**
```typescript
// Partner document contains:
assignedOrganizations: [
  { companyCode: "wmxhop", status: "active" }  // No organizationId
]

// Organizations query returns empty (no transformationPartnerId match)

// After deduplication:
uniqueAssignments: []  // ← Empty! companyCode-only assignment was filtered out
```

**Impact:**
- Partner sees infinite loading
- No organizations displayed
- No users displayed
- Dashboard appears broken

### Bug #2: Incorrect Loading State Calculation

**Location:** [usePartnerAdminSnapshot.ts:165](src/hooks/partner/usePartnerAdminSnapshot.ts#L165)

**Current Code:**
```typescript
const loading = docLoading && queryLoading
```

**Problem:**
- `loading` is only `true` when BOTH sources are loading
- Once either source completes, `loading` becomes `false`
- This is semantically correct for "wait for at least one source"
- But it doesn't account for empty results from both sources

**Better Approach:**
```typescript
const loading = docLoading || queryLoading
```
This ensures we're loading until BOTH sources have completed.

### Bug #3: Silent Failure When Both Sources Return Empty

**Location:** [usePartnerAdminSnapshot.ts:86-163](src/hooks/partner/usePartnerAdminSnapshot.ts#L86-L163)

**Current Code:**
```typescript
// Partner doc doesn't exist
if (!docSnap.exists()) {
  setAssignmentsFromDoc([])
  setDocLoading(false)
  // Don't error here, rely on the query ← Silent failure
  return
}

// Query returns empty
const fromQuery: PartnerAssignment[] = querySnap.docs.map(...)
setAssignmentsFromQuery(fromQuery)  // Empty array, no error
```

**Problem:**
- No error state when both sources return empty results
- Partner has no feedback about why they see no organizations
- Could be a legitimate "no assignments" case OR a configuration error

**Better Approach:**
Set an error or warning when snapshot resolves to empty assignments:
```typescript
if (snapshot && snapshot.assignedOrganizations.length === 0) {
  setError("No organizations assigned. Contact your administrator.")
}
```

---

## Identifier Mismatch Issue

### The Problem
Partners may be assigned using **Firestore document IDs** while users are stored with **human-readable company codes**.

**Example:**
```typescript
// Partner assignment uses document ID
assignedOrganizationIds: ["s1nzr7yaee16x4fdhztd"]

// User profile uses company code
user.organizationId: "wmxhop"

// Query will fail because "s1nzr7yaee16x4fdhztd" !== "wmxhop"
```

### The Solution (Already Implemented)
The hooks use **bidirectional lookup maps** to handle this:

```typescript
// In usePartnerOrganizations
const organizationLookup = useMemo(() => {
  const mapping = new Map<string, string>()
  organizations.forEach((org) => {
    const orgId = org.id?.toLowerCase()
    const orgCode = org.code?.toLowerCase()
    if (orgId && orgCode) {
      mapping.set(orgId, orgCode)   // ID → Code
      mapping.set(orgCode, orgId)   // Code → ID (bidirectional)
    }
  })
  return mapping
}, [organizations])
```

**BUT:** This only works if organizations are successfully loaded. If Bug #1 prevents organizations from loading, the lookup map is empty, and user matching fails.

---

## User Query Logic

### Query Fields
Users are queried using THREE organization identifier fields:
```typescript
const queryFields = ['organizationId', 'organization_id', 'companyId'] as const
```

This handles different naming conventions in the Firestore schema.

### Chunking for Firestore Limits
Firestore `in` queries support max 30 values:
```typescript
const FIRESTORE_IN_QUERY_LIMIT = 30

// If partner has > 30 orgs, split into multiple queries
for (let i = 0; i < uniqueKeys.length; i += FIRESTORE_IN_QUERY_LIMIT) {
  const chunk = uniqueKeys.slice(i, i + FIRESTORE_IN_QUERY_LIMIT)
  queryFields.forEach((field) => {
    queries.push(query(USERS_COLLECTION, where(field, 'in', chunk)))
  })
}
```

**Important:** This logic is sound, but it depends on having valid `assignedOrganizationIds` from Bug #1.

---

## Hardcoded Filters Audit

### Result: No Hardcoded Organization Filters Found

**Files Checked:**
- ✅ `src/hooks/partner/usePartnerAdminSnapshot.ts` - No hardcoded values
- ✅ `src/hooks/partner/usePartnerOrganizations.ts` - No hardcoded values
- ✅ `src/hooks/partner/usePartnerUsers.ts` - No hardcoded values
- ✅ `src/hooks/partner/usePartnerMetrics.ts` - No hardcoded values
- ✅ `src/utils/permissions.ts` - Proper identifier handling, no hardcoded values

**Conclusion:** The loading issue is NOT caused by hardcoded filters. It's purely a logic bug in assignment deduplication.

---

## Fix Strategy

### Fix #1: Update Assignment Deduplication Logic

**File:** `src/hooks/partner/usePartnerAdminSnapshot.ts`
**Lines:** 60-78

**Change:**
```typescript
// OLD: Only keeps assignments with organizationId
allAssignments.forEach((assignment) => {
  const id = assignment.organizationId
  if (id && !seenIds.has(id)) {
    seenIds.add(id)
    uniqueAssignments.push(assignment)
  }
})

// NEW: Keep assignments with either organizationId OR companyCode
allAssignments.forEach((assignment) => {
  // Use organizationId as primary key, fall back to companyCode
  const key = assignment.organizationId || assignment.companyCode
  if (key && !seenIds.has(key)) {
    seenIds.add(key)
    uniqueAssignments.push(assignment)
  }
})
```

### Fix #2: Update Loading State Calculation

**File:** `src/hooks/partner/usePartnerAdminSnapshot.ts`
**Line:** 165

**Change:**
```typescript
// OLD: Loading only when both sources are loading
const loading = docLoading && queryLoading

// NEW: Loading until both sources complete
const loading = docLoading || queryLoading
```

### Fix #3: Add Error State for Empty Assignments

**File:** `src/hooks/partner/usePartnerAdminSnapshot.ts`
**Lines:** 56-78

**Change:**
```typescript
const snapshot = useMemo<PartnerAdminSnapshot | null>(() => {
  if (!user?.uid) return null
  if (docLoading || queryLoading) return null

  // Merge assignments with deduplication
  const allAssignments = [...assignmentsFromDoc, ...assignmentsFromQuery]
  const seenIds = new Set<string>()
  const uniqueAssignments: PartnerAssignment[] = []

  allAssignments.forEach((assignment) => {
    const key = assignment.organizationId || assignment.companyCode
    if (key && !seenIds.has(key)) {
      seenIds.add(key)
      uniqueAssignments.push(assignment)
    }
  })

  // NEW: Set error if no assignments found
  if (uniqueAssignments.length === 0 && !isSuperAdmin) {
    setError('No organizations assigned. Please contact your administrator.')
  } else if (error && uniqueAssignments.length > 0) {
    setError(null) // Clear error if assignments are found
  }

  return {
    partnerId: user.uid,
    role: 'partner',
    assignedOrganizations: uniqueAssignments,
  }
}, [user?.uid, assignmentsFromDoc, assignmentsFromQuery, docLoading, queryLoading, isSuperAdmin])
```

### Fix #4: Update `assignedOrganizationIds` to Include CompanyCodes

**File:** `src/hooks/partner/usePartnerAdminSnapshot.ts`
**Lines:** 80-84

**Change:**
```typescript
// OLD: Only returns organizationId values
const assignedOrganizationIds = useMemo(() => {
  return snapshot?.assignedOrganizations
    .map((a) => a.organizationId)
    .filter((id): id is string => !!id) ?? []
}, [snapshot])

// NEW: Returns organizationId OR companyCode
const assignedOrganizationIds = useMemo(() => {
  return snapshot?.assignedOrganizations
    .map((a) => a.organizationId || a.companyCode)
    .filter((id): id is string => !!id) ?? []
}, [snapshot])
```

---

## Testing Strategy

### Console Logging for Debugging

Add temporary debug logging to verify fixes:

```typescript
// In usePartnerAdminSnapshot, after snapshot creation
console.log('[DEBUG] Partner Assignment Snapshot', {
  partnerId: user?.uid,
  assignmentsFromDoc: assignmentsFromDoc.length,
  assignmentsFromQuery: assignmentsFromQuery.length,
  uniqueAssignments: snapshot?.assignedOrganizations.length,
  assignedIds: assignedOrganizationIds,
  docLoading,
  queryLoading,
  loading,
  error,
})
```

### Test Scenarios

1. **Partner with document-only assignments**
   - Partner document has `assignedOrganizations: ["org-id-123"]`
   - No organizations have `transformationPartnerId` set
   - Expected: Organizations load via `listenToOrganizationsByIds(["org-id-123"])`

2. **Partner with query-only assignments**
   - No partner document exists
   - Organizations have `transformationPartnerId: "partner-uid"`
   - Expected: Organizations load from query results

3. **Partner with companyCode-only assignments**
   - Partner document has `assignedOrganizations: [{ companyCode: "acme" }]`
   - Expected: Assignment NOT filtered out during deduplication

4. **Partner with no assignments**
   - No partner document
   - No organizations with `transformationPartnerId`
   - Expected: Error message displayed, no infinite loading

5. **Partner with mixed identifier types**
   - Some assignments use `organizationId`, some use `companyCode`
   - Expected: All assignments preserved, users matched correctly

---

## Success Criteria

- ✅ All partners see their assigned organizations (no data loss)
- ✅ Partners with only `companyCode` assignments load successfully
- ✅ Loading state resolves properly (no infinite loading)
- ✅ Error state displays when partner has no assignments
- ✅ Organization identifier matching works (ID ↔ code lookup)
- ✅ Users are correctly filtered by organization identifier
- ✅ Dashboard updates in real-time when assignments change
- ✅ No console errors or infinite loops
- ✅ No hardcoded organization filters remain

---

## Files to Modify

1. **src/hooks/partner/usePartnerAdminSnapshot.ts** (Primary fix)
   - Update deduplication logic (lines 60-78)
   - Update loading state calculation (line 165)
   - Add error state for empty assignments (lines 56-78)
   - Update `assignedOrganizationIds` to include companyCodes (lines 80-84)

2. **No changes needed for:**
   - `src/hooks/partner/usePartnerOrganizations.ts` (Already correct)
   - `src/hooks/partner/usePartnerUsers.ts` (Already correct)
   - `src/hooks/partner/usePartnerMetrics.ts` (Already correct)

---

## Deployment Notes

### Before Deployment
1. Review Firestore data to identify partners with `companyCode`-only assignments
2. Consider backfilling `organizationId` for all assignments (optional, not required)
3. Test with multiple partner accounts with different assignment formats

### After Deployment
1. Monitor partner dashboard loading times
2. Check console logs for assignment resolution debug info
3. Verify no partners see "no organizations assigned" error incorrectly
4. Remove debug logging after validation period

---

## Long-Term Recommendations

### 1. Data Migration: Standardize Assignments
**Goal:** Ensure all partner assignments have both `organizationId` AND `companyCode`

```typescript
// Migration script
const partners = await db.collection('partners').get()
partners.forEach(async (partnerDoc) => {
  const assignments = partnerDoc.data().assignedOrganizations
  const normalized = await Promise.all(assignments.map(async (assignment) => {
    if (typeof assignment === 'string') {
      // String format: lookup organization to get code
      const org = await db.collection('organizations').doc(assignment).get()
      return {
        organizationId: assignment,
        companyCode: org.data()?.code || assignment,
        status: 'active'
      }
    }
    if (assignment.organizationId && !assignment.companyCode) {
      // Has ID but no code: lookup organization
      const org = await db.collection('organizations').doc(assignment.organizationId).get()
      return {
        ...assignment,
        companyCode: org.data()?.code || assignment.organizationId
      }
    }
    if (assignment.companyCode && !assignment.organizationId) {
      // Has code but no ID: query by code
      const orgQuery = await db.collection('organizations')
        .where('code', '==', assignment.companyCode)
        .limit(1)
        .get()
      const orgId = orgQuery.empty ? null : orgQuery.docs[0].id
      return {
        ...assignment,
        organizationId: orgId || assignment.companyCode
      }
    }
    return assignment
  }))

  await partnerDoc.ref.update({ assignedOrganizations: normalized })
})
```

### 2. Validation: Add Firestore Rules
```javascript
// Ensure new assignments have proper structure
match /partners/{partnerId} {
  allow write: if request.auth != null &&
    request.resource.data.assignedOrganizations is list &&
    request.resource.data.assignedOrganizations.hasAll(['organizationId', 'companyCode']) ||
    request.resource.data.assignedOrganizations[0] is string;
}
```

### 3. Admin UI: Assignment Management
Create a Super Admin UI for managing partner assignments that:
- Shows current assignments with validation warnings
- Allows adding/removing assignments
- Automatically resolves both `organizationId` and `companyCode`
- Validates assignments before saving

---

## Timeline

| Task | Time Estimate | Priority |
|------|---------------|----------|
| Implement Fix #1-4 | 30 minutes | P0 |
| Add debug logging | 15 minutes | P0 |
| Test with 3+ partner accounts | 30 minutes | P0 |
| Deploy to production | 15 minutes | P0 |
| Monitor for 24 hours | Ongoing | P0 |
| Remove debug logging | 10 minutes | P1 |
| Data migration script | 2 hours | P1 |
| Admin UI for assignments | 4 hours | P2 |

---

**Total Estimated Time for Critical Fixes:** ~1.5 hours
**Total Estimated Time for Complete Solution:** ~8 hours

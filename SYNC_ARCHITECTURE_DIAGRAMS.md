# User-to-Profiles Sync Architecture Diagrams

## 1. Overall Sync Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER CREATION/UPDATE                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐      ┌──────────┐      ┌────────────┐
   │ Firebase│      │    App   │      │  Firestore │
   │  Auth   │      │   Code   │      │  Trigger   │
   └────┬────┘      └────┬─────┘      └─────┬──────┘
        │                │                   │
        └────────────────┼───────────────────┘
                         │
              [Primary Write Flow]
                         │
        ┌────────────────┴───────────────────┐
        │                                    │
        ▼                                    ▼
   ┌─────────────┐                  ┌──────────────┐
   │    USERS    │                  │   PROFILES   │
   │ COLLECTION  │                  │  COLLECTION  │
   └─────────────┘                  └──────────────┘
        ▲                                   ▲
        │                                   │
        └──────────────┬────────────────────┘
                       │
              [Function Sync - Real-time]
                       │
            ┌──────────────────┐
            │ syncUserToProfile │
            │  Cloud Function   │
            └──────────────────┘


    EVERY 24 HOURS (2 AM UTC)
    ┌──────────────────────────┐
    │  Verify Data Consistency │
    │  syncProfilesNightly()   │
    │  Cloud Function          │
    └───────────┬──────────────┘
                │
      ┌─────────┴──────────┐
      │                    │
      ▼                    ▼
   [Compare]         [Update Missing]
   Timestamps        [Report Results]
```

## 2. Signup Flow (Email + Password)

```
User clicks "Sign Up"
        │
        ▼
┌──────────────────────┐
│ Enter credentials    │
│ (email, password)    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ CREATE USER          │
│ Firebase Auth        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────┐
│ syncAuthUserToProfile() triggers  │
│ (Auth Function)                  │
│                                  │
│ 1. Get auth user info            │
│ 2. Create minimal profile        │
│ 3. Write to users collection     │
│ 4. Write to profiles collection  │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────┐
│ App Code Runs        │
│ (AuthContext.signUp) │
│                      │
│ 1. Creates full      │
│    user profile      │
│ 2. Write users       │
│ 3. Write profiles    │
│    (Promise.all)     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────┐
│ syncUserToProfile() triggers      │
│ (Firestore Write Trigger)         │
│                                  │
│ Confirms sync completed          │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────┐
│ USER CREATED         │
│                      │
│ In both:             │
│ • users collection   │
│ • profiles coll.     │
└──────────────────────┘
```

## 3. Update Flow

```
User Updates Profile
        │
        ▼
┌──────────────────────┐
│ App Code             │
│ updateDoc(users/...) │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────┐
│ syncUserToProfile() Triggers      │
│ (Firestore Write Trigger)         │
│                                  │
│ 1. Read updated user data        │
│ 2. Compare timestamps            │
│ 3. Sync to profiles collection   │
│ 4. Log operation                 │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ (Optional) App Code Also Writes  │
│ to profiles (Backup)             │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────┐
│ BOTH COLLECTIONS     │
│ UPDATED              │
│ (Merge Strategy)     │
└──────────────────────┘
```

## 4. Nightly Consistency Check

```
┌─────────────────────────────────────────┐
│  Cloud Scheduler Triggers at 2 AM UTC    │
└───────────────┬───────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────┐
│  syncProfilesNightly() Cloud Function    │
│                                          │
│  1. Fetch all users (batches of 500)     │
└───────────┬──────────────────────────────┘
            │
            ▼
     ┌──────────────┐
     │  For each    │
     │  user batch  │
     │  (500 docs)  │
     └────┬─────────┘
          │
    ┌─────┴──────────────┐
    │                    │
    ▼                    ▼
┌─────────┐        ┌───────────┐
│ Does    │        │ Is user   │
│ profile │        │ data      │
│ exist?  │        │ newer?    │
└────┬────┘        └─────┬─────┘
     │                   │
  NO │ YES            YES│ NO
     │  │               │ │
     ▼  └─────┬─────┘   ▼ ▼
     │        │    SKIP  │
     ├────────┼──────────┤
     │        │          │
     ▼        ▼          ▼
   [SYNC] [UPDATE] [SKIP]
     │        │        │
     └────────┼────────┘
              │
              ▼
    ┌──────────────────┐
    │ Commit Batch     │
    │ (max 500 docs)   │
    └────────┬─────────┘
             │
    ┌────────▼────────┐
    │ More batches?   │
    └────────┬────────┘
             │
          YES│ NO
             │  │
         ┌───┘  └───┐
         │          │
         ▼          ▼
    [CONTINUE]   ┌──────────────────────┐
                 │ Report Results:      │
                 │ • Synced count       │
                 │ • Skipped count      │
                 │ • Error count        │
                 │ • Total time         │
                 └──────────────────────┘
```

## 5. Collection Structure

```
┌─────────────────────────────────────┐
│        FIRESTORE DATABASE           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────┐           │
│  │   USERS            │           │
│  │   COLLECTION       │           │
│  ├─────────────────────┤           │
│  │ Document: {uid}     │           │
│  ├─────────────────────┤           │
│  │ • id                │           │
│  │ • email             │           │
│  │ • firstName         │           │
│  │ • lastName          │           │
│  │ • role              │           │
│  │ • companyId         │           │
│  │ • createdAt         │           │
│  │ • updatedAt         │           │
│  │ • ... (all fields)  │           │
│  │                     │           │
│  │ Synced to ──────────┼──────┐   │
│  │ Profiles via ────────┼──────┼──┐│
│  │ Cloud Function       │      │ ││
│  └─────────────────────┘      │ ││
│                               │ ││
│  ┌─────────────────────┐      │ ││
│  │   PROFILES          │◄─────┘ ││
│  │   COLLECTION        │◄────────┘│
│  ├─────────────────────┤          │
│  │ Document: {uid}     │          │
│  ├─────────────────────┤          │
│  │ • id                │          │
│  │ • email             │          │
│  │ • firstName         │          │
│  │ • lastName          │          │
│  │ • role              │          │
│  │ • companyId         │          │
│  │ • createdAt         │          │
│  │ • updatedAt         │          │
│  │ • ... (all fields)  │          │
│  │                     │          │
│  │ Uses:               │          │
│  │ • Admin dashboards  │          │
│  │ • Reporting         │          │
│  └─────────────────────┘          │
│                                   │
└─────────────────────────────────────┘
```

## 6. Error Handling Flow

```
Any Sync Operation
        │
        ▼
┌──────────────────┐
│  Try Sync        │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
   YES        NO
    │         │
    ▼         ▼
 [SUCCESS] [ERROR]
    │         │
    │         ▼
    │    ┌─────────────────┐
    │    │ Log Error       │
    │    │ (Firebase Logs) │
    │    └────────┬────────┘
    │             │
    │    ┌────────▼────────┐
    │    │ For Write ops:  │
    │    │ Don't block     │
    │    │ user action     │
    │    │ (async error)   │
    │    └────────┬────────┘
    │             │
    └─────┬───────┘
          │
          ▼
    ┌──────────────────┐
    │ Continue normal  │
    │ operation        │
    │                  │
    │ Nightly job will │
    │ fix discrepancies│
    └──────────────────┘
```

## 7. Deployment Timeline

```
Development
     │
     ▼
┌──────────────────────────┐
│ npm install              │
│ npm run build            │
│ npm run deploy           │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Firebase deploys functions   │
│                              │
│ 1. syncUserToProfile         │
│ 2. syncAuthUserToProfile     │
│ 3. syncProfilesNightly       │
└────────┬─────────────────────┘
         │
    ┌────▼────┐
    │          │
   30s        TIME
    │          │
    ▼          ▼
[FUNCTIONS] [READY]
   ACTIVE   TO SYNC
         
         ▼
┌──────────────────────────────┐
│ Monitor Logs                 │
│ firebase functions:log       │
│                              │
│ First 24 hours: Watch for    │
│ • Sync operations            │
│ • Error patterns             │
│ • Performance metrics        │
└──────────────────────────────┘
```

## 8. Data Flow Between Collections

```
APP INITIALIZATION
        │
        ▼
┌─────────────────────────────────────────┐
│ Check: Are users in profiles?           │
│ (done by migration script once)          │
└──────────┬────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ YES: Run Cloud Functions                │
│ • Monitor real-time syncs               │
│ • Run nightly verification              │
│ • All new users auto-sync               │
└─────────────────────────────────────────┘
```

## Quick Reference

```
TRIGGERS:
├─ syncUserToProfile
│  └─ Trigger: users/{userId} write
│     Action: Sync to profiles
│
├─ syncAuthUserToProfile
│  └─ Trigger: Auth user creation
│     Action: Create + sync both
│
└─ syncProfilesNightly
   └─ Trigger: Daily 2 AM UTC
      Action: Batch verify + sync

COLLECTIONS:
├─ users (primary)
│  └─ Source of truth
│     Synced via functions
│
└─ profiles (mirror)
   └─ Admin dashboards
      Synced via functions

SYNC STRATEGY:
├─ Real-time: Function triggers
├─ Batch: Nightly verification
└─ Merge: Never overwrite newer data
```

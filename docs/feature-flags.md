# Feature Flags

This document tracks the feature flags used in the T4L Platform.

## VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING

- **Status**: Development/Rollout
- **Description**: Enables parallel tracking of user progress in 2-week windows alongside the existing weekly progress tracking.
- **Affected Services**: `PointsService.ts`, `windowProgressService.ts`
- **Goal**: Transition from 4-week windows to 2-week windows as the primary unit of progress tracking.
- **Rollout Plan**:
    1. Set to `true` in development and staging environments.
    2. Verify data consistency in the `windowProgress` collection.
    3. Enable in production after verification.
- **Rollback**: Set to `false` to stop updating the `windowProgress` collection. Existing data will remain but will not be updated.

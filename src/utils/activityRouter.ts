import { awardChecklistPoints } from '@/services/pointsService';
import { ActivityDef, JourneyType } from '@/config/pointsConfig';
import { isLeadershipAssignedActivity } from '@/utils/leadershipAssignedActivities';

interface CompletionParams<TActivity extends ActivityDef> {
  uid: string;
  journeyType: JourneyType;
  weekNumber: number;
  activity: TActivity;
  /** Distinguishes repeat claims in the same week (e.g. occ-2). */
  claimRef?: string;
  onProofRequired: (activity: TActivity) => void;
  onSuccess: (status: 'completed' | 'pending' | 'not_started') => Promise<void>;
  onError: (error: unknown) => void;
}

async function awardOrExplain<TActivity extends ActivityDef>(
  params: Omit<CompletionParams<TActivity>, 'onProofRequired'> & { source: string },
) {
  const { uid, journeyType, weekNumber, activity, claimRef, source, onSuccess, onError } = params;
  const result = await awardChecklistPoints({
    uid,
    journeyType,
    weekNumber,
    activity,
    source,
    claimRef,
  });

  if (!result.awarded) {
    if (result.reason === 'already_awarded') {
      // Idempotent - treat as success so the checklist locks the week claim.
      await onSuccess('completed');
      return;
    }
    onError(new Error(result.message ?? 'Could not award points. Please try again.'));
    return;
  }

  await onSuccess('completed');
}

export async function handleActivityCompletion<TActivity extends ActivityDef>(
  params: CompletionParams<TActivity>,
) {
  const { uid, journeyType, weekNumber, activity, claimRef, onProofRequired, onSuccess, onError } =
    params;

  try {
    switch (activity.approvalType) {
      case 'auto':
        await awardOrExplain({
          uid,
          journeyType,
          weekNumber,
          activity,
          claimRef,
          source: 'instant:auto',
          onSuccess,
          onError,
        });
        break;

      case 'self':
        await awardOrExplain({
          uid,
          journeyType,
          weekNumber,
          activity,
          claimRef,
          source: 'instant:self',
          onSuccess,
          onError,
        });
        break;

      case 'partner_approved':
        // Attendance activities (webinar / weekly session) are partner-marked —
        // never open the proof upload path from the checklist.
        if (isLeadershipAssignedActivity(activity)) {
          break
        }
        onProofRequired(activity);
        break;

      case 'partner_issued':
        // Partner must issue/award. Issued items can be claimed; attendance
        // items waiting on the partner stay info-only (no proof upload).
        if ((activity as TActivity & { issuedByPartner?: boolean }).issuedByPartner) {
          await awardOrExplain({
            uid,
            journeyType,
            weekNumber,
            activity,
            claimRef,
            source: 'instant:partner-issued-claim',
            onSuccess,
            onError,
          });
        } else if (!isLeadershipAssignedActivity(activity)) {
          onProofRequired(activity);
        }
        break;

      case 'mentor_issued':
      case 'ambassador_issued':
        // Marks come from mentor/coach attendance confirmation — no learner claim.
        break;

      default:
        // Fallback for legacy activities
        if (activity.requiresApproval) {
          onProofRequired(activity);
        } else {
          await awardOrExplain({
            uid,
            journeyType,
            weekNumber,
            activity,
            claimRef,
            source: 'weekly_checklist',
            onSuccess,
            onError,
          });
        }
        break;
    }
  } catch (error) {
    console.error('[ActivityRouter] Failed to handle activity completion', error);
    onError(error);
  }
}

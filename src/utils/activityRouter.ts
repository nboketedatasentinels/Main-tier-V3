import { awardChecklistPoints } from '@/services/pointsService';
import { ActivityDef, JourneyType } from '@/config/pointsConfig';

interface CompletionParams<TActivity extends ActivityDef> {
  uid: string;
  journeyType: JourneyType;
  weekNumber: number;
  activity: TActivity;
  onProofRequired: (activity: TActivity) => void;
  onSuccess: (status: 'completed' | 'pending' | 'not_started') => Promise<void>;
  onError: (error: unknown) => void;
}

async function awardOrExplain<TActivity extends ActivityDef>(
  params: Omit<CompletionParams<TActivity>, 'onProofRequired'> & { source: string },
) {
  const { uid, journeyType, weekNumber, activity, source, onSuccess, onError } = params;
  const result = await awardChecklistPoints({
    uid,
    journeyType,
    weekNumber,
    activity,
    source,
  });

  if (!result.awarded) {
    if (result.reason === 'already_awarded') {
      // Idempotent — treat as success so the checklist locks the week claim.
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
  const { uid, journeyType, weekNumber, activity, onProofRequired, onSuccess, onError } = params;

  try {
    switch (activity.approvalType) {
      case 'auto':
        await awardOrExplain({
          uid,
          journeyType,
          weekNumber,
          activity,
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
          source: 'instant:self',
          onSuccess,
          onError,
        });
        break;

      case 'partner_approved':
        // This type requires proof submission via UI modal
        onProofRequired(activity);
        break;

      case 'partner_issued':
        if ((activity as TActivity & { issuedByPartner?: boolean }).issuedByPartner) {
          await awardOrExplain({
            uid,
            journeyType,
            weekNumber,
            activity,
            source: 'instant:partner-issued-claim',
            onSuccess,
            onError,
          });
        }
        break;

      case 'mentor_issued':
      case 'ambassador_issued':
        // These remain locked until assignment logic is implemented.
        // No action from learner side here.
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

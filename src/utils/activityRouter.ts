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

export async function handleActivityCompletion<TActivity extends ActivityDef>(
  params: CompletionParams<TActivity>,
) {
  const { uid, journeyType, weekNumber, activity, onProofRequired, onSuccess, onError } = params;

  try {
    switch (activity.approvalType) {
      case 'auto':
        await awardChecklistPoints({
          uid,
          journeyType,
          weekNumber,
          activity,
          source: 'instant:auto',
        });
        await onSuccess('completed');
        break;

      case 'self':
        await awardChecklistPoints({
          uid,
          journeyType,
          weekNumber,
          activity,
          source: 'instant:self',
        });
        await onSuccess('completed');
        break;

      case 'partner_approved':
        // This type requires proof submission via UI modal
        onProofRequired(activity);
        break;

      case 'partner_issued':
        // These are locked until a partner assigns them.
        // No action from learner side here.
        break;

      default:
        // Fallback for legacy activities
        if (activity.requiresApproval) {
          onProofRequired(activity);
        } else {
          await awardChecklistPoints({
            uid,
            journeyType,
            weekNumber,
            activity,
          });
          await onSuccess('completed');
        }
        break;
    }
  } catch (error) {
    console.error('[ActivityRouter] Failed to handle activity completion', error);
    onError(error);
  }
}

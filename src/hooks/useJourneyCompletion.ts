import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { evaluateJourneyCompletion, CompletionResult } from '@/utils/completion';

export const useJourneyCompletion = () => {
  const { user, profile } = useAuth();
  const [completion, setCompletion] = useState<CompletionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.uid && profile?.journeyType) {
      evaluateJourneyCompletion(user.uid, profile.journeyType as any)
        .then(setCompletion)
        .catch(err => console.error('Error fetching journey completion:', err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user?.uid, profile?.journeyType, profile?.totalPoints]);

  return { completion, loading };
};

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { Badge } from '@/types/badge';
import { badges as allBadges } from '@/config/badges';
import { useAuth } from './useAuth';

export const useUserBadges = () => {
  const { user } = useAuth();
  const [userBadges, setUserBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchUserBadges = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const q = query(collection(db, 'userBadges'), where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const earnedBadgesMap = new Map(
          querySnapshot.docs.map((doc) => [doc.data().badgeId as string, doc.data().createdAt.toDate()])
        );

        const earnedBadges = allBadges
          .filter((badge) => earnedBadgesMap.has(badge.id))
          .map((badge) => ({
            ...badge,
            earnedAt: earnedBadgesMap.get(badge.id),
          }));
        setUserBadges(earnedBadges);
      } catch (err) {
        console.error('Error fetching user badges:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      } finally {
        setLoading(false);
      }
    };

    fetchUserBadges();
  }, [user]);

  return { userBadges, loading, error };
};

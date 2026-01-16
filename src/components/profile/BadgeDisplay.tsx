import { useUserBadges } from '@/hooks/useUserBadges';

const BadgeDisplay = () => {
  const { userBadges, loading, error } = useUserBadges();

  if (loading) {
    return <div>Loading badges...</div>;
  }

  if (error) {
    return <div>Error loading badges. Please try again later.</div>;
  }

  if (userBadges.length === 0) {
    return <div>No badges earned yet.</div>;
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {userBadges.map((badge) => (
        <div key={badge.id} className="text-center">
          <img src={badge.image} alt={badge.name} className="w-24 h-24 mx-auto" />
          <p className="font-bold">{badge.name}</p>
          <p className="text-sm text-gray-500">{badge.description}</p>
          {badge.earnedAt && (
            <p className="text-xs text-gray-400">
              Earned on {badge.earnedAt.toLocaleDateString()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default BadgeDisplay;

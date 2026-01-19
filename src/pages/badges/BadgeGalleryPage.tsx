import { useUserBadges } from '@/hooks/useUserBadges';
import { badges as allBadges } from '@/config/badges';

const BadgeGalleryPage = () => {
  const { userBadges, loading, error } = useUserBadges();

  if (loading) {
    return <div>Loading badge gallery...</div>;
  }

  if (error) {
    return <div>Error loading badge gallery. Please try again later.</div>;
  }

  const earnedBadgeIds = new Set(userBadges.map(b => b.id));

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Badge Gallery</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {allBadges.map((badge) => {
          const isEarned = earnedBadgeIds.has(badge.id);
          return (
            <div
              key={badge.id}
              className={`text-center p-4 border rounded-lg ${
                isEarned ? 'border-green-500' : 'border-gray-300'
              }`}
            >
              <img
                src={badge.image}
                alt={badge.name}
                className={`w-32 h-32 mx-auto ${isEarned ? '' : 'filter grayscale'}`}
              />
              <p className="font-bold mt-2">{badge.name}</p>
              <p className="text-sm text-gray-500">{badge.description}</p>
              {isEarned && <p className="text-green-500 font-bold mt-2">Earned!</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BadgeGalleryPage;

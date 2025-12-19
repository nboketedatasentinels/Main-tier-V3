// src/config/personality-data.ts

export type PersonalityType =
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ'
  | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';

export const PERSONALITY_TYPES: { type: PersonalityType; name: string; group: string }[] = [
  // Analysts
  { type: 'INTJ', name: 'The Architect', group: 'Analysts' },
  { type: 'INTP', name: 'The Logician', group: 'Analysts' },
  { type: 'ENTJ', name: 'The Commander', group: 'Analysts' },
  { type: 'ENTP', name: 'The Debater', group: 'Analysts' },
  // Diplomats
  { type: 'INFJ', name: 'The Advocate', group: 'Diplomats' },
  { type: 'INFP', name: 'The Mediator', group: 'Diplomats' },
  { type: 'ENFJ', name: 'The Protagonist', group: 'Diplomats' },
  { type: 'ENFP', name: 'The Campaigner', group: 'Diplomats' },
  // Sentinels
  { type: 'ISTJ', name: 'The Logistician', group: 'Sentinels' },
  { type: 'ISFJ', name: 'The Defender', group: 'Sentinels' },
  { type: 'ESTJ', name: 'The Executive', group: 'Sentinels' },
  { type: 'ESFJ', name: 'The Consul', group: 'Sentinels' },
  // Explorers
  { type: 'ISTP', name: 'The Virtuoso', group: 'Explorers' },
  { type: 'ISFP', name: 'The Adventurer', group: 'Explorers' },
  { type: 'ESTP', name: 'The Entrepreneur', group: 'Explorers' },
  { type: 'ESFP', name: 'The Entertainer', group: 'Explorers' },
];

export const CORE_VALUES: string[] = [
    // Security & Stability
    "Accountability", "Certainty", "Control", "Discipline", "Financial stability",
    "Health", "Job security", "Peace", "Pleasure", "Privacy", "Security",
    "Tradition", "Trust", "Wealth",
    // Adventure & Growth
    "Adventure", "Challenge", "Courage", "Creativity", "Curiosity", "Excitement",
    "Growth", "Passion", "Variety",
    // Achievement & Success
    "Ambition", "Competence", "Determination", "Excellence", "Independence",
    "Intelligence", "Success", "Wisdom",
    // Relationships & Connection
    "Acceptance", "Compassion", "Family", "Forgiveness", "Friendship", "Honesty",
    "Love", "Loyalty", "Tolerance",
    // Recognition & Influence
    "Appreciation", "Authority", "Fame", "Influence", "Popularity", "Reputation",
    "Respect", "Uniqueness",
    // Values & Meaning
    "Authenticity", "Beauty", "Commitment", "Contribution", "Equality", "Ethics",
    "Inner harmony", "Justice", "Meaningful work", "Religion", "Spirituality",
    "Teamwork",
    // Personal Qualities
    "Freedom", "Helpfulness"
];


export const COUNTRY_TIMEZONE_SUGGESTIONS: Record<string, string> = {
  'South Africa': 'Africa/Johannesburg',
  'United States': 'America/New_York',
  'United Kingdom': 'Europe/London',
  'India': 'Asia/Kolkata',
};

export const COMMUNITY_REDIRECT_LINK = 'https://www.16personalities.com/personality-types';

export const getPersonalityDescription = (type: PersonalityType): string => {
  const descriptions: Record<PersonalityType, string> = {
    INTJ: "Strategic thinkers with a talent for planning and implementing complex solutions. You excel at seeing the big picture and creating systems.",
    INTP: "Innovative problem solvers with a thirst for knowledge. You're analytical, objective, and enjoy theoretical concepts.",
    ENTJ: "Natural leaders who are decisive, strategic, and efficient. You excel at organizing people and resources to achieve goals.",
    ENTP: "Visionary innovators who love intellectual challenges. You're quick-thinking, adaptable, and enjoy exploring possibilities.",
    INFJ: "Insightful visionaries with strong values. You're empathetic, principled, and focused on helping others reach their potential.",
    INFP: "Idealistic mediators with deep empathy. You're creative, compassionate, and driven by your personal values.",
    ENFJ: "Charismatic mentors who inspire others. You're people-focused, empathetic, and skilled at bringing out the best in teams.",
    ENFP: "Enthusiastic innovators who connect with people. You're creative, energetic, and excel at generating new ideas.",
    ISTJ: "Reliable executors who value tradition and order. You're practical, detail-oriented, and dependable.",
    ISFJ: "Dedicated protectors who serve others. You're loyal, considerate, and excel at creating harmony.",
    ESTJ: "Efficient organizers who implement practical solutions. You're logical, structured, and value clear processes.",
    ESFJ: "Supportive harmonizers who build community. You're people-oriented, organized, and excel at creating positive environments.",
    ISTP: "Practical problem-solvers who value efficiency. You're analytical, adaptable, and skilled with technical systems.",
    ISFP: "Versatile creators with strong aesthetics. You're sensitive, practical, and value authenticity.",
    ESTP: "Energetic problem-solvers who thrive on challenges. You're pragmatic, observant, and excel in crisis management.",
    ESFP: "Enthusiastic engagers who bring people together. You're spontaneous, practical, and excel at motivating teams.",
  };
  return descriptions[type];
};

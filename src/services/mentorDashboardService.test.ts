import { describe, it, expect } from 'vitest';
import {
  deriveFallbackRisk,
  type EngagementSignals,
  type RiskLevel,
} from './mentorDashboardService';

describe('MentorDashboardService', () => {
  describe('deriveFallbackRisk', () => {
    describe('Engaged Risk Level', () => {
      it('should return engaged risk for recent activity with high weekly activity', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 3,
          weeklyActivity: 5,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.level).toBe('engaged');
        expect(result.summary).toContain('Active this week');
        expect(result.daysSinceLastActive).toBe(3);
        expect(result.weeklyActivity).toBe(5);
      });

      it('should return engaged risk for 7 days with activity', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 7,
          weeklyActivity: 1,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.level).toBe('engaged');
        expect(result.summary).toContain('Active this week');
      });

      it('should return engaged risk for 1 day since last active', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 1,
          weeklyActivity: 3,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.level).toBe('engaged');
      });

      it('should NOT be engaged if no weekly activity even with recent login', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 5,
          weeklyActivity: 0,
        };

        const result = deriveFallbackRisk(signals);

        // Should not be engaged because weeklyActivity is 0
        expect(result.level).not.toBe('engaged');
      });
    });

    describe('Watch Risk Level', () => {
      it('should return watch risk for 8-14 days inactive', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 10,
          weeklyActivity: 1,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.level).toBe('watch');
        expect(result.summary).toContain('Slight slowdown');
        expect(result.daysSinceLastActive).toBe(10);
      });

      it('should return watch risk for exactly 8 days inactive', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 8,
          weeklyActivity: 0,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.level).toBe('watch');
      });

      it('should return watch risk for 14 days inactive', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 14,
          weeklyActivity: 2,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.level).toBe('watch');
      });

      it('should return watch for 7 days with zero weekly activity', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 7,
          weeklyActivity: 0,
        };

        const result = deriveFallbackRisk(signals);

        // Not engaged because weeklyActivity is 0, falls into watch
        expect(result.level).toBe('watch');
      });
    });

    describe('Concern Risk Level', () => {
      it('should return concern risk for 15-28 days inactive', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 20,
          weeklyActivity: 0,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.level).toBe('concern');
        expect(result.summary).toContain('Engagement is declining');
        expect(result.daysSinceLastActive).toBe(20);
      });

      it('should return concern risk for exactly 15 days inactive', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 15,
          weeklyActivity: 1,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.level).toBe('concern');
      });

      it('should return concern risk for 28 days inactive', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 28,
          weeklyActivity: 0,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.level).toBe('concern');
      });
    });

    describe('Critical Risk Level', () => {
      it('should return critical risk for over 28 days inactive', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 45,
          weeklyActivity: 0,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.level).toBe('critical');
        expect(result.summary).toContain('No activity in over 4 weeks');
        expect(result.daysSinceLastActive).toBe(45);
      });

      it('should return critical risk for exactly 29 days inactive', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 29,
          weeklyActivity: 0,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.level).toBe('critical');
      });

      it('should return critical risk for 60 days inactive', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 60,
          weeklyActivity: 0,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.level).toBe('critical');
        expect(result.summary).toContain('Act immediately');
      });

      it('should return critical risk for 90 days inactive', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 90,
          weeklyActivity: 0,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.level).toBe('critical');
      });
    });

    describe('Edge Cases', () => {
      it('should handle zero days since last active', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 0,
          weeklyActivity: 5,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.level).toBe('engaged');
        expect(result.daysSinceLastActive).toBe(0);
      });

      it('should handle very high weekly activity', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 2,
          weeklyActivity: 100,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.level).toBe('engaged');
        expect(result.weeklyActivity).toBe(100);
      });

      it('should handle boundary between engaged and watch (7 vs 8 days)', () => {
        const engaged = deriveFallbackRisk({
          daysSinceLastActive: 7,
          weeklyActivity: 1,
        });

        const watch = deriveFallbackRisk({
          daysSinceLastActive: 8,
          weeklyActivity: 1,
        });

        expect(engaged.level).toBe('engaged');
        expect(watch.level).toBe('watch');
      });

      it('should handle boundary between watch and concern (14 vs 15 days)', () => {
        const watch = deriveFallbackRisk({
          daysSinceLastActive: 14,
          weeklyActivity: 0,
        });

        const concern = deriveFallbackRisk({
          daysSinceLastActive: 15,
          weeklyActivity: 0,
        });

        expect(watch.level).toBe('watch');
        expect(concern.level).toBe('concern');
      });

      it('should handle boundary between concern and critical (28 vs 29 days)', () => {
        const concern = deriveFallbackRisk({
          daysSinceLastActive: 28,
          weeklyActivity: 0,
        });

        const critical = deriveFallbackRisk({
          daysSinceLastActive: 29,
          weeklyActivity: 0,
        });

        expect(concern.level).toBe('concern');
        expect(critical.level).toBe('critical');
      });
    });

    describe('Risk Level Progression', () => {
      it('should progress through all risk levels as days increase', () => {
        const levels: Array<{ days: number; expected: RiskLevel }> = [
          { days: 3, expected: 'engaged' },
          { days: 10, expected: 'watch' },
          { days: 20, expected: 'concern' },
          { days: 35, expected: 'critical' },
        ];

        levels.forEach(({ days, expected }) => {
          const result = deriveFallbackRisk({
            daysSinceLastActive: days,
            weeklyActivity: days <= 7 ? 1 : 0, // Only engaged needs activity
          });

          expect(result.level).toBe(expected);
        });
      });
    });

    describe('Summary Messages', () => {
      it('should provide appropriate summary for engaged mentees', () => {
        const result = deriveFallbackRisk({
          daysSinceLastActive: 3,
          weeklyActivity: 5,
        });

        expect(result.summary).toBeTruthy();
        expect(result.summary.toLowerCase()).toContain('active');
      });

      it('should provide appropriate summary for watch mentees', () => {
        const result = deriveFallbackRisk({
          daysSinceLastActive: 10,
          weeklyActivity: 1,
        });

        expect(result.summary).toBeTruthy();
        expect(result.summary.toLowerCase()).toContain('slowdown');
      });

      it('should provide appropriate summary for concern mentees', () => {
        const result = deriveFallbackRisk({
          daysSinceLastActive: 20,
          weeklyActivity: 0,
        });

        expect(result.summary).toBeTruthy();
        expect(result.summary.toLowerCase()).toContain('declining');
      });

      it('should provide appropriate summary for critical mentees', () => {
        const result = deriveFallbackRisk({
          daysSinceLastActive: 45,
          weeklyActivity: 0,
        });

        expect(result.summary).toBeTruthy();
        expect(result.summary.toLowerCase()).toContain('4 weeks');
      });
    });

    describe('Return Value Structure', () => {
      it('should return all required fields', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 5,
          weeklyActivity: 3,
        };

        const result = deriveFallbackRisk(signals);

        expect(result).toHaveProperty('level');
        expect(result).toHaveProperty('summary');
        expect(result).toHaveProperty('daysSinceLastActive');
        expect(result).toHaveProperty('weeklyActivity');
      });

      it('should preserve input values in return', () => {
        const signals: EngagementSignals = {
          daysSinceLastActive: 12,
          weeklyActivity: 7,
        };

        const result = deriveFallbackRisk(signals);

        expect(result.daysSinceLastActive).toBe(signals.daysSinceLastActive);
        expect(result.weeklyActivity).toBe(signals.weeklyActivity);
      });

      it('should return a valid RiskLevel', () => {
        const validLevels: RiskLevel[] = ['engaged', 'watch', 'concern', 'critical'];
        const testCases = [
          { daysSinceLastActive: 5, weeklyActivity: 2 },
          { daysSinceLastActive: 12, weeklyActivity: 1 },
          { daysSinceLastActive: 25, weeklyActivity: 0 },
          { daysSinceLastActive: 50, weeklyActivity: 0 },
        ];

        testCases.forEach((signals) => {
          const result = deriveFallbackRisk(signals);
          expect(validLevels).toContain(result.level);
        });
      });
    });
  });
});

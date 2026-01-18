/**
 * Partner Daily Digest Service
 * Generates and sends daily digest emails to mentors/partners with team status updates
 */

import {
  collection,
  doc,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  Timestamp,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from './firebase'
import { sendEmailNotification } from './notificationService'
import type {
  LearnerStatusRecord,
  PartnerDailyDigest,
  DigestSchedule,
} from '@/types/monitoring'

/**
 * Generate daily digest for a partner/mentor
 */
export async function generatePartnerDigest(
  partnerId: string,
  partnerEmail: string,
  orgId: string,
  digestDate: string = new Date().toISOString().split('T')[0],
): Promise<PartnerDailyDigest | null> {
  try {
    // Get all learners assigned to this partner
    const learnersQuery = query(
      collection(db, 'learner_status'),
      where('orgId', '==', orgId),
    )

    const learnersSnapshot = await getDocs(learnersQuery)
    const learners = learnersSnapshot.docs.map((doc) => doc.data() as LearnerStatusRecord)

    // Calculate team statistics
    const totalTeamMembers = learners.length
    const activeMembers = learners.filter((l) => l.currentStatus === 'active').length
    const atRiskCount = learners.filter((l) => l.currentStatus === 'at_risk').length
    const inactiveCount = learners.filter((l) => l.currentStatus === 'inactive').length
    const recoveredCount = learners.filter((l) => l.currentStatus === 'in_recovery').length

    // Get at-risk learners with details
    const atRiskLearners = learners
      .filter((l) => l.currentStatus === 'at_risk' || l.currentStatus === 'inactive')
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 10) // Top 10 most at-risk
      .map((learner) => ({
        userId: learner.userId,
        name: learner.userId, // Will be enriched with profile data
        engagementScore: learner.engagementScore,
        daysSinceActivity: learner.daysSinceLastActivity,
        suggestedActions: generateSuggestedActionsForPartner(learner),
        recoveryTips: generateRecoveryTips(learner),
        statusChangedAt: learner.statusChangedAt,
      }))

    // Enrich with profile data
    for (const learner of atRiskLearners) {
      try {
        const profileRef = doc(db, 'profiles', learner.userId)
        const profileSnapshot = await (async () => {
          try {
            return await (await import('firebase/firestore')).getDoc(profileRef)
          } catch {
            return null
          }
        })()

        if (profileSnapshot?.exists()) {
          const profile = profileSnapshot.data() as Record<string, unknown>
          learner.name = (profile.fullName as string) || learner.userId
        }
      } catch (error) {
        console.error(`Error enriching learner ${learner.userId}:`, error)
      }
    }

    // Calculate team averages
    const teamAverageEngagementScore =
      learners.length > 0 ? Math.round(learners.reduce((sum, l) => sum + l.engagementScore, 0) / learners.length) : 0
    const teamCompletionRate =
      learners.length > 0 ? Math.round(learners.reduce((sum, l) => sum + l.completionRate, 0) / learners.length) : 0
    const weeklyPointsAverage =
      learners.length > 0 ? Math.round(learners.reduce((sum, l) => sum + l.pointsInCurrentWindow, 0) / learners.length) : 0

    // Determine changes since yesterday
    const yesterdayDigestQuery = query(
      collection(db, 'partner_daily_digest_queue'),
      where('partnerId', '==', partnerId),
      where('orgId', '==', orgId),
      orderBy('digestDate', 'desc'),
      limit(1),
    )

    const yesterdayDigestSnapshot = await getDocs(yesterdayDigestQuery)
    let newAtRiskCount = atRiskCount
    let recoveredCountDelta = 0

    if (!yesterdayDigestSnapshot.empty) {
      const yesterdayDigest = yesterdayDigestSnapshot.docs[0].data() as PartnerDailyDigest
      newAtRiskCount = Math.max(0, atRiskCount - (yesterdayDigest.atRiskCount || 0))
      recoveredCountDelta = recoveredCount - (yesterdayDigest.recoveredCount || 0)
    }

    // Build summary text
    const summaryText = buildDigestSummary(
      totalTeamMembers,
      activeMembers,
      atRiskCount,
      inactiveCount,
      teamAverageEngagementScore,
    )

    // Identify critical items
    const criticalItems: string[] = []
    if (inactiveCount > 0) {
      criticalItems.push(`⚠️ ${inactiveCount} learner(s) inactive for 14+ days`)
    }
    if (newAtRiskCount > 0) {
      criticalItems.push(`📊 ${newAtRiskCount} new at-risk transition(s) since yesterday`)
    }
    if (recoveredCountDelta > 0) {
      criticalItems.push(`🎉 ${recoveredCountDelta} learner(s) recovered`)
    }

    // Get partner name
    const partnerRef = doc(db, 'profiles', partnerId)
    const partnerSnapshot = await (async () => {
      try {
        return await (await import('firebase/firestore')).getDoc(partnerRef)
      } catch {
        return null
      }
    })()

    const partner = partnerSnapshot?.data() as Record<string, unknown> | undefined
    const partnerName = (partner?.fullName as string) || partnerId

    // Create digest record
    const digest: PartnerDailyDigest = {
      id: '', // Firestore will generate
      partnerId,
      partnerName,
      orgId,
      digestDate,
      status: 'pending',
      totalTeamMembers,
      activeMembers,
      atRiskCount,
      inactiveCount,
      recoveredCount: recoveredCountDelta,
      newAtRiskCount,
      completedMilestones: 0,
      atRiskLearners,
      teamAverageEngagementScore,
      teamCompletionRate,
      weeklyPointsAverage,
      summaryText,
      criticalItems,
      createdAt: Timestamp.now(),
    }

    // Save to queue
    const digestRef = await addDoc(collection(db, 'partner_daily_digest_queue'), digest)

    return { ...digest, id: digestRef.id }
  } catch (error) {
    console.error('Error generating partner digest:', error)
    return null
  }
}

/**
 * Send partner digest email
 */
export async function sendPartnerDigestEmail(digest: PartnerDailyDigest): Promise<boolean> {
  try {
    // Get partner email
    const partnerRef = doc(db, 'profiles', digest.partnerId)
    const partnerSnapshot = await (async () => {
      try {
        return await (await import('firebase/firestore')).getDoc(partnerRef)
      } catch {
        return null
      }
    })()

    const partner = partnerSnapshot?.data() as Record<string, unknown> | undefined
    const partnerEmail = partner?.email as string | undefined

    if (!partnerEmail) {
      console.warn(`No email found for partner ${digest.partnerId}`)
      return false
    }

    // Build email content
    const emailContent = {
      partnerId: digest.partnerId,
      partnerName: digest.partnerName,
      digestDate: digest.digestDate,
      teamStats: {
        total: digest.totalTeamMembers,
        active: digest.activeMembers,
        atRisk: digest.atRiskCount,
        inactive: digest.inactiveCount,
        recovered: digest.recoveredCount,
      },
      averageEngagementScore: digest.teamAverageEngagementScore,
      teamCompletionRate: digest.teamCompletionRate,
      weeklyPointsAverage: digest.weeklyPointsAverage,
      criticalAlerts: digest.criticalItems,
      atRiskLearners: digest.atRiskLearners.map((l) => ({
        name: l.name,
        engagementScore: l.engagementScore,
        daysSinceActivity: l.daysSinceActivity,
        actions: l.suggestedActions.join(', '),
      })),
      summaryText: digest.summaryText,
      dashboardUrl: `${process.env.VITE_APP_URL}/mentor/dashboard?org=${digest.orgId}`,
    }

    // Send email
    await sendEmailNotification({
      to: partnerEmail,
      subject: `Daily Team Digest - ${digest.digestDate}`,
      template: 'partner-daily-digest',
      data: emailContent,
    })

    // Update digest status
    await updateDoc(doc(db, 'partner_daily_digest_queue', digest.id), {
      status: 'sent',
      sentAt: Timestamp.now(),
    })

    return true
  } catch (error) {
    console.error('Error sending partner digest email:', error)
    return false
  }
}

/**
 * Process pending digests for sending
 */
export async function processPendingDigests(): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  try {
    const pendingQuery = query(
      collection(db, 'partner_daily_digest_queue'),
      where('status', '==', 'pending'),
      limit(100),
    )

    const snapshot = await getDocs(pendingQuery)
    let succeeded = 0
    let failed = 0

    for (const digestDoc of snapshot.docs) {
      const digest = digestDoc.data() as PartnerDailyDigest

      try {
        const sent = await sendPartnerDigestEmail(digest)
        if (sent) {
          succeeded++
        } else {
          failed++
          await updateDoc(digestDoc.ref, { status: 'failed' })
        }
      } catch (error) {
        console.error(`Error processing digest ${digest.id}:`, error)
        failed++
        await updateDoc(digestDoc.ref, { status: 'failed' })
      }
    }

    return {
      processed: snapshot.docs.length,
      succeeded,
      failed,
    }
  } catch (error) {
    console.error('Error processing pending digests:', error)
    return {
      processed: 0,
      succeeded: 0,
      failed: 1,
    }
  }
}

/**
 * Schedule digest for partner
 */
export async function schedulePartnerDigest(
  partnerId: string,
  orgId: string,
  schedule: Partial<DigestSchedule>,
): Promise<DigestSchedule | null> {
  try {
    const scheduleId = `${partnerId}-${orgId}`
    const scheduleRecord: DigestSchedule = {
      id: scheduleId,
      partnerId,
      orgId,
      frequency: schedule.frequency || 'daily',
      preferredTime: schedule.preferredTime || '09:00',
      preferredDay: schedule.preferredDay || 'monday',
      timezone: schedule.timezone || 'UTC',
      enabled: true,
      nextDigestAt: calculateNextDigestTime(
        schedule.frequency || 'daily',
        schedule.preferredTime || '09:00',
        schedule.preferredDay,
        schedule.timezone,
      ),
      updatedAt: Timestamp.now(),
    }

    await updateDoc(doc(db, 'digest_schedules', scheduleId), scheduleRecord).catch(async () => {
      await addDoc(collection(db, 'digest_schedules'), scheduleRecord)
    })

    return scheduleRecord
  } catch (error) {
    console.error('Error scheduling partner digest:', error)
    return null
  }
}

/**
 * Calculate next digest send time
 */
function calculateNextDigestTime(
  frequency: string,
  preferredTime: string,
  preferredDay?: string,
  timezone: string = 'UTC',
): Timestamp {
  const now = new Date()
  const [hours, minutes] = preferredTime.split(':').map(Number)

  const nextTime = new Date()
  nextTime.setHours(hours, minutes, 0, 0)

  if (nextTime <= now) {
    nextTime.setDate(nextTime.getDate() + 1)
  }

  if (frequency === 'weekly' && preferredDay) {
    // Calculate days until preferred day
    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    }

    const targetDay = dayMap[preferredDay.toLowerCase()] || 1
    const currentDay = nextTime.getDay()
    let daysUntil = targetDay - currentDay

    if (daysUntil <= 0) {
      daysUntil += 7
    }

    nextTime.setDate(nextTime.getDate() + daysUntil)
  }

  return Timestamp.fromDate(nextTime)
}

/**
 * Generate suggested actions for partner based on learner status
 */
function generateSuggestedActionsForPartner(learner: LearnerStatusRecord): string[] {
  const actions: string[] = []

  if (learner.currentStatus === 'at_risk') {
    actions.push('Schedule a check-in to understand barriers')
    actions.push('Share recent success stories from other team members')
  }

  if (learner.currentStatus === 'inactive') {
    actions.push('Make urgent outreach call or message')
    actions.push('Offer 1:1 support or resource review')
    actions.push('Explore accommodation options if needed')
  }

  if (learner.engagementScore < 30) {
    actions.push('Refer to support services if available')
  }

  return actions.slice(0, 3)
}

/**
 * Generate recovery tips for partner
 */
function generateRecoveryTips(learner: LearnerStatusRecord): string[] {
  const tips: string[] = []

  if (learner.completionRate < 50) {
    tips.push('Focus on one activity per week first')
  }

  if (learner.daysSinceLastActivity > 14) {
    tips.push('Suggest shorter, more frequent check-ins')
  }

  if (learner.consistencyScore < 40) {
    tips.push('Help establish a weekly routine')
  }

  return tips
}

/**
 * Build digest summary text
 */
function buildDigestSummary(
  totalMembers: number,
  activeMembers: number,
  atRiskCount: number,
  inactiveCount: number,
  avgEngagement: number,
): string {
  const activePercentage = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0
  const atRiskPercentage = totalMembers > 0 ? Math.round((atRiskCount / totalMembers) * 100) : 0

  return `Your team of ${totalMembers} learners has ${activePercentage}% actively engaged (${activeMembers} learners). ${atRiskPercentage}% (${atRiskCount}) are at-risk and ${inactiveCount} are inactive. Average engagement score is ${avgEngagement}/100.`
}

/**
 * Get digest delivery statistics
 */
export async function getDigestStats(partnerId: string): Promise<{
  totalSent: number
  lastSentAt?: Date
  nextScheduledAt?: Date
  frequency: string
}> {
  try {
    // Get last digest sent
    const lastDigestQuery = query(
      collection(db, 'partner_daily_digest_queue'),
      where('partnerId', '==', partnerId),
      where('status', '==', 'sent'),
      orderBy('sentAt', 'desc'),
      limit(1),
    )

    const lastDigestSnapshot = await getDocs(lastDigestQuery)
    const lastSentAt = lastDigestSnapshot.empty
      ? undefined
      : (lastDigestSnapshot.docs[0].data().sentAt as Timestamp)?.toDate()

    // Get schedule
    const scheduleQuery = query(
      collection(db, 'digest_schedules'),
      where('partnerId', '==', partnerId),
    )

    const scheduleSnapshot = await getDocs(scheduleQuery)
    const schedule = scheduleSnapshot.empty ? null : (scheduleSnapshot.docs[0].data() as DigestSchedule)

    // Count total sent
    const allDigestsQuery = query(
      collection(db, 'partner_daily_digest_queue'),
      where('partnerId', '==', partnerId),
      where('status', '==', 'sent'),
    )

    const allDigestsSnapshot = await getDocs(allDigestsQuery)

    return {
      totalSent: allDigestsSnapshot.size,
      lastSentAt,
      nextScheduledAt: schedule?.nextDigestAt?.toDate(),
      frequency: schedule?.frequency || 'daily',
    }
  } catch (error) {
    console.error('Error getting digest stats:', error)
    return {
      totalSent: 0,
      frequency: 'daily',
    }
  }
}

import { Stack } from '@chakra-ui/react'
import { useWeeklyChecklistViewModel } from '@/hooks/useWeeklyChecklistViewModel'
import { ActivityList } from './components/ActivityList'
import { ProofModal } from './components/ProofModal'
import { JourneyHeader } from './components/JourneyHeader'
import { JourneyPointsReferencePanel } from './components/JourneyPointsReferencePanel'

type VM = ReturnType<typeof useWeeklyChecklistViewModel>

export const WeeklyChecklistLayout = ({ vm }: { vm: VM }) => {
  return (
    <Stack spacing={6}>
      <JourneyHeader
        journey={vm.journey}
        progress={vm.allWeeksProgress}
        leadershipAvailability={vm.leadershipAvailability}
      />

      {vm.journey?.journeyType ? (
        <JourneyPointsReferencePanel
          journeyType={vm.journey.journeyType}
          leadershipAvailability={vm.leadershipAvailability}
        />
      ) : null}

      <ActivityList
        activities={vm.activities}
        selectedWeek={vm.selectedWeek}
        currentWeek={vm.journey?.currentWeek ?? vm.selectedWeek}
        programDurationWeeks={vm.journey?.programDurationWeeks ?? vm.selectedWeek}
        completedWeeksByActivity={vm.completedWeeksByActivity}
        pendingWeeksByActivity={vm.pendingWeeksByActivity}
        isWeekLocked={vm.isWeekLocked}
        isAdmin={vm.isAdmin}
        pinMultiClaimsToStartWeek={vm.journey?.journeyType === '4W'}
        onOpenCurrentWeek={() => vm.setSelectedWeek(vm.journey?.currentWeek ?? vm.selectedWeek)}
        onMarkCompleted={vm.markCompleted}
        onMarkNotStarted={vm.markNotStarted}
        onOpenProof={vm.openProofModal}
        onRefreshLedger={vm.refreshLedger}
        isActivityBusy={vm.isActivityBusy}
      />

      <ProofModal
        state={vm.proofModal}
        isSubmitting={vm.isSubmittingProof}
        onClose={vm.closeProofModal}
        onChange={vm.updateProofModal}
        onSubmit={vm.submitProofForApproval}
      />
    </Stack>
  )
}

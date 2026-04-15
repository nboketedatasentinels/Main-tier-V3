import { Stack } from '@chakra-ui/react'
import { useWeeklyChecklistViewModel } from '@/hooks/useWeeklyChecklistViewModel'
import { ActivityList } from './components/ActivityList'
import { ProofModal } from './components/ProofModal'
import { WeeklySummary } from './components/WeeklySummary'
import { JourneyHeader } from './components/JourneyHeader'

type VM = ReturnType<typeof useWeeklyChecklistViewModel>

export const WeeklyChecklistLayout = ({ vm }: { vm: VM }) => {
  return (
    <Stack spacing={6}>
      <JourneyHeader
        journey={vm.journey}
        progress={vm.allWeeksProgress}
        leadershipAvailability={vm.leadershipAvailability}
      />

      <WeeklySummary
        week={vm.selectedWeek}
        completed={vm.completedCount}
        cyclePoints={vm.cyclePoints}
        cycleTarget={vm.cycleTarget}
        accumulatedPoints={vm.accumulatedPoints}
        passMarkPoints={vm.passMarkPoints}
        journeyUrgency={vm.journeyUrgency}
      />

      <ActivityList
        activities={vm.activities}
        selectedWeek={vm.selectedWeek}
        currentWeek={vm.journey?.currentWeek ?? vm.selectedWeek}
        isWeekLocked={vm.isWeekLocked}
        isAdmin={vm.isAdmin}
        onOpenCurrentWeek={() => vm.setSelectedWeek(vm.journey?.currentWeek ?? vm.selectedWeek)}
        onMarkCompleted={vm.markCompleted}
        onMarkNotStarted={vm.markNotStarted}
        onOpenProof={vm.openProofModal}
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

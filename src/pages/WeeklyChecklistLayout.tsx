import { Grid, GridItem, Stack } from '@chakra-ui/react'
import { useWeeklyChecklistViewModel } from '@/hooks/useWeeklyChecklistViewModel'
import { ActivityList } from './components/ActivityList'
import { ProofModal } from './components/ProofModal'
import { WeeklySummary } from './components/WeeklySummary'
import { JourneyHeader } from './components/JourneyHeader'
import { GamificationPanel } from './components/GamificationPanel'

type VM = ReturnType<typeof useWeeklyChecklistViewModel>

export const WeeklyChecklistLayout = ({ vm }: { vm: VM }) => {
  return (
    <Stack spacing={6}>
      <JourneyHeader journey={vm.journey} progress={vm.allWeeksProgress} />

      <WeeklySummary
        week={vm.selectedWeek}
        completed={vm.completedCount}
        earned={vm.earnedPoints}
        target={vm.weeklyTarget}
      />

      <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={6} alignItems="start">
        <GridItem>
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
          />
        </GridItem>

        <GridItem>
          <Stack spacing={4}>
            <GamificationPanel activities={vm.activities} />
          </Stack>
        </GridItem>
      </Grid>

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

export interface OnboardingStepItem {
  id: string
  title: string
  points: number
  icon?: string
  link?: string
  description?: string
  microTask?: MicroTask
}

export interface OnboardingStep {
  id: string
  title: string
  description: string
  iconName?: string
  items: OnboardingStepItem[]
  points: number
  order: number
  role?: string
}

export type MicroTaskType = 'button' | 'input' | 'confirm'

export interface BaseMicroTask {
  type: MicroTaskType
  successLabel: string
}

export interface ButtonMicroTask extends BaseMicroTask {
  type: 'button'
  actionLabel: string
}

export interface InputMicroTask extends BaseMicroTask {
  type: 'input'
  placeholder?: string
  helperText?: string
  minLength?: number
  multiline?: boolean
}

export interface ConfirmMicroTask extends BaseMicroTask {
  type: 'confirm'
  actionLabel: string
}

export type MicroTask = ButtonMicroTask | InputMicroTask | ConfirmMicroTask

export interface ProgressState {
  completedSteps: string[]
  completedItems: string[]
  totalPoints: number
  onboardingStartTime: string | null
  pointsDeducted: boolean
  pointsDeductedAmount: number | null
  updatedAt: string | null
}

export interface OnboardingSnapshot extends ProgressState {
  onboardingComplete?: boolean
  onboardingSkipped?: boolean
  lastStepId?: string | null
}

export interface OnboardingAnalyticsEvent {
  user_id: string
  status: 'not_started' | 'in_progress' | 'completed'
  progress_percentage: number
  completed_item_count: number
  total_item_count: number
  role: string | null
  label: string | null
  variant: 'start' | 'resume' | 'completed' | null
  triggered_from: string
  recorded_at: string
}

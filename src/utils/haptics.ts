type HapticPattern = 'success' | 'error' | 'warning' | 'selection'

const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  success: [20, 40, 20],
  error: [60, 30, 60],
  warning: 35,
  selection: 12,
}

export const triggerHaptic = (pattern: HapticPattern = 'selection') => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return

  try {
    navigator.vibrate(HAPTIC_PATTERNS[pattern])
  } catch {
    // Ignore haptic failures to avoid interrupting the user flow.
  }
}

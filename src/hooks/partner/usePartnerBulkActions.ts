import { useState } from 'react'
import { useToast } from '@chakra-ui/react'
import { bulkRecordEngagementActions } from '@/services/engagementService'
import { useAuth } from '@/hooks/useAuth'

export type BulkActionStatus = 'idle' | 'processing' | 'success' | 'error'

export const usePartnerBulkActions = (selection: string[], onClearSelection: () => void) => {
  const [status, setStatus] = useState<BulkActionStatus>('idle')
  const [bulkAction, setBulkAction] = useState('')
  const { profile } = useAuth()
  const toast = useToast()

  const bulkApply = async (actionLabel?: string) => {
    const actionToApply = actionLabel || bulkAction
    if (!selection.length) {
      toast({ title: 'Please select at least one user', status: 'error' })
      return
    }

    if (!actionToApply) {
      toast({ title: 'Select an action to apply', status: 'error' })
      return
    }

    setStatus('processing')
    try {
      const result = await bulkRecordEngagementActions(
        selection,
        actionToApply,
        profile?.id ?? null,
        profile?.fullName ?? null
      )

      const { success, results = [] } = result.data as { success: boolean; results?: Array<{ status?: string }> }

      if (success) {
        toast({
          title: `${actionToApply} applied`,
          description: `${selection.length} user(s) updated`,
          status: 'success',
        })
        onClearSelection()
        setBulkAction('')
        setStatus('success')
      } else {
        // Handle partial or total failure from Cloud Function
        const failedCount = results.filter(r => r.status === 'rejected').length
        if (failedCount > 0 && failedCount < selection.length) {
           toast({
            title: 'Bulk action partially completed',
            description: `${selection.length - failedCount} of ${selection.length} user(s) updated.`,
            status: 'warning',
          })
        } else {
          toast({
            title: 'Bulk action failed',
            description: 'No updates were applied. Please retry.',
            status: 'error',
          })
          setStatus('error')
        }
      }
    } catch (error) {
      console.error(error)
      toast({ title: 'Failed to apply action', status: 'error' })
      setStatus('error')
    } finally {
      if (status !== 'error') setStatus('idle')
    }
  }

  return {
    bulkAction,
    setBulkAction,
    bulkApply,
    isProcessing: status === 'processing',
    status,
  }
}

import { useState, useCallback } from 'react'

export const useUserSelection = () => {
  const [selection, setSelection] = useState<string[]>([])

  const toggleSelection = useCallback((id: string) => {
    setSelection((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }, [])

  const clearSelection = useCallback(() => {
    setSelection([])
  }, [])

  const selectAll = useCallback((ids: string[]) => {
    setSelection(ids)
  }, [])

  return {
    selection,
    setSelection,
    toggleSelection,
    clearSelection,
    selectAll,
  }
}

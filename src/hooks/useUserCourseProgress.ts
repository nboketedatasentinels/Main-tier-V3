import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase'

const normalizeKey = (value: string) => value.trim().toLowerCase()

export const useUserCourseProgress = (userId?: string | null) => {
  const [progressMap, setProgressMap] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    if (!userId) {
      setProgressMap(new Map())
      setLoading(false)
      return
    }

    setLoading(true)
    const q = query(collection(db, 'user_courses'), where('user_id', '==', userId))
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const map = new Map<string, number>()
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data()
          const progress = typeof data.progress === 'number' ? data.progress : undefined
          if (progress === undefined) return
          const courseId =
            (typeof data.courseId === 'string' && data.courseId.trim()) ||
            (typeof data.course_id === 'string' && data.course_id.trim()) ||
            (typeof data.id === 'string' && data.id.trim())
          if (courseId) {
            map.set(courseId, progress)
          }
          const title = typeof data.title === 'string' ? data.title.trim() : ''
          if (title) {
            map.set(normalizeKey(title), progress)
          }
        })
        setProgressMap(map)
        setLoading(false)
      },
      error => {
        console.error('Error loading user course progress', error)
        setProgressMap(new Map())
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [userId])

  return { progressMap, loading }
}

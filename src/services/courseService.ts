import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/services/firebase'

export const getCourseDocument = async (courseId: string) => getDoc(doc(db, 'courses', courseId))

export const getCourseDocuments = async (courseIds: string[]) =>
  Promise.all(courseIds.map(courseId => getCourseDocument(courseId)))

import { collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '../src/services/firebase'

const args = new Set(process.argv.slice(2))
const shouldFix = args.has('--fix')
const shouldDelete = args.has('--delete')

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const toEmptyString = (): string => ''

const reportMode = !shouldFix && !shouldDelete

async function auditPeerSessions() {
  console.log('Starting peer session data audit...')
  console.log(`Mode: ${reportMode ? 'report' : shouldDelete ? 'delete' : 'fix'}`)

  const sessionsSnap = await getDocs(collection(db, 'peer_sessions'))
  const requestsSnap = await getDocs(collection(db, 'peer_session_requests'))

  let malformedSessions = 0
  let malformedRequests = 0
  let fixedSessions = 0
  let fixedRequests = 0
  let deletedSessions = 0
  let deletedRequests = 0

  for (const docSnap of sessionsSnap.docs) {
    const data = docSnap.data()
    const participantsValid = Array.isArray(data.participants)
    const createdByValid = isNonEmptyString(data.createdBy)

    if (!participantsValid || !createdByValid) {
      malformedSessions += 1
      console.warn('[Audit] Malformed peer_session document', {
        id: docSnap.id,
        participantsValid,
        createdByValid,
      })

      if (shouldDelete) {
        await deleteDoc(doc(db, 'peer_sessions', docSnap.id))
        deletedSessions += 1
      } else if (shouldFix) {
        const participants = participantsValid ? data.participants : []
        const normalizedParticipants = participantsValid && participants.length > 0
          ? participants
          : createdByValid
            ? [data.createdBy]
            : []

        await updateDoc(doc(db, 'peer_sessions', docSnap.id), {
          participants: normalizedParticipants,
          createdBy: createdByValid ? data.createdBy : toEmptyString(),
        })
        fixedSessions += 1
      }
    }
  }

  for (const docSnap of requestsSnap.docs) {
    const data = docSnap.data()
    const fromValid = isNonEmptyString(data.fromUserId)
    const toValid = isNonEmptyString(data.toUserId)
    const sessionValid = isNonEmptyString(data.sessionId)

    if (!fromValid || !toValid || !sessionValid) {
      malformedRequests += 1
      console.warn('[Audit] Malformed peer_session_request document', {
        id: docSnap.id,
        fromValid,
        toValid,
        sessionValid,
      })

      if (shouldDelete) {
        await deleteDoc(doc(db, 'peer_session_requests', docSnap.id))
        deletedRequests += 1
      } else if (shouldFix) {
        await updateDoc(doc(db, 'peer_session_requests', docSnap.id), {
          fromUserId: fromValid ? data.fromUserId : toEmptyString(),
          toUserId: toValid ? data.toUserId : toEmptyString(),
          sessionId: sessionValid ? data.sessionId : toEmptyString(),
        })
        fixedRequests += 1
      }
    }
  }

  console.log('Audit complete.')
  console.log(`Malformed peer_sessions: ${malformedSessions}`)
  console.log(`Malformed peer_session_requests: ${malformedRequests}`)
  if (shouldFix) {
    console.log(`Fixed peer_sessions: ${fixedSessions}`)
    console.log(`Fixed peer_session_requests: ${fixedRequests}`)
  }
  if (shouldDelete) {
    console.log(`Deleted peer_sessions: ${deletedSessions}`)
    console.log(`Deleted peer_session_requests: ${deletedRequests}`)
  }
}

auditPeerSessions()
  .then(() => {
    console.log('Peer session audit finished.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Peer session audit failed:', error)
    process.exit(1)
  })

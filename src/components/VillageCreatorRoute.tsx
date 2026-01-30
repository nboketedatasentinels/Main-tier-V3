import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AppLoader } from '@/components/ui/AppLoader'
import { fetchVillageById } from '@/services/villageService'

type Props = {
  children: ReactNode
}

export const VillageCreatorRoute = ({ children }: Props) => {
  const { villageId } = useParams()
  const { profile, loading, profileLoading } = useAuth()
  const location = useLocation()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAccess = async () => {
      if (!villageId || !profile) {
        setAllowed(false)
        return
      }
      if (profile.villageId && profile.villageId !== villageId) {
        setAllowed(false)
        return
      }
      const village = await fetchVillageById(villageId)
      if (!village) {
        setAllowed(false)
        return
      }
      setAllowed(village.creatorId === profile.id)
    }

    void checkAccess()
  }, [profile, villageId])

  if (loading || profileLoading || allowed === null) {
    return <AppLoader />
  }

  if (!allowed) {
    return <Navigate to="/unauthorized" replace state={{ from: location }} />
  }

  return <>{children}</>
}

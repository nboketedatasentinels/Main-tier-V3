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

      const normalizedVillageId = villageId.trim()
      const profileVillageId = profile.villageId?.trim()

      if (!normalizedVillageId || !profileVillageId || profileVillageId !== normalizedVillageId) {
        setAllowed(false)
        return
      }

      const village = await fetchVillageById(normalizedVillageId)
      if (!village) {
        setAllowed(false)
        return
      }

      setAllowed(true)
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

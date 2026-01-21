import { PageTransitionLoader } from '@/components/PageTransitionLoader'

interface LoadingAnimationProps {
  fullScreen?: boolean
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ fullScreen = false }) => {
  return <PageTransitionLoader fullScreen={fullScreen} size="large" />
}

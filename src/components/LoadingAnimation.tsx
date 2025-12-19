import { Box, Center } from '@chakra-ui/react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'

interface LoadingAnimationProps {
  fullScreen?: boolean
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ fullScreen = false }) => {
  const player = (
    <Box
      width={{ base: '220px', md: '320px' }}
      height={{ base: '220px', md: '320px' }}
      aria-label="Loading content"
    >
      <DotLottieReact
        src="https://lottie.host/d9b4b8ae-2d44-4bc6-b80a-4d709d78bee5/MxsdsRgn1I.lottie"
        loop
        autoplay
        style={{ width: '100%', height: '100%' }}
      />
    </Box>
  )

  if (fullScreen) {
    return (
      <Center h="100vh" bg="brand.deepPlum">
        {player}
      </Center>
    )
  }

  return <Center py={6}>{player}</Center>
}

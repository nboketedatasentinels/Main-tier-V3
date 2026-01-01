import { ChakraProvider } from '@chakra-ui/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { AuthProvider } from '@/contexts/AuthContext'
import { AppRoutes } from '@/routes'
import theme from '@/theme'
import '@/index.css'

function App() {
  return (
    <ChakraProvider theme={theme}>
      <AuthProvider>
        <AppRoutes />
        <SpeedInsights />
      </AuthProvider>
    </ChakraProvider>
  )
}

export default App

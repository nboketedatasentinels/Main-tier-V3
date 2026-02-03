import { useToast as useChakraToast, type ToastPosition } from '@chakra-ui/react'

type ToastStatus = 'success' | 'error' | 'warning' | 'info'

interface ToastOptions {
  title: string
  description?: string
  status?: ToastStatus
  position?: ToastPosition
}

export const useToast = () => {
  const toast = useChakraToast()

  const notify = ({
    title,
    description,
    status = 'info',
    position = 'top-right',
  }: ToastOptions) => {
    toast({
      title,
      description,
      status,
      duration: 5000,
      isClosable: true,
      position,
    })
  }

  return notify
}

import { useToast as useChakraToast } from '@chakra-ui/react'

type ToastStatus = 'success' | 'error' | 'warning' | 'info'

interface ToastOptions {
  title: string
  description?: string
  status?: ToastStatus
}

export const useToast = () => {
  const toast = useChakraToast()

  const notify = ({ title, description, status = 'info' }: ToastOptions) => {
    toast({
      title,
      description,
      status,
      duration: 5000,
      isClosable: true,
      position: 'top-right',
    })
  }

  return notify
}

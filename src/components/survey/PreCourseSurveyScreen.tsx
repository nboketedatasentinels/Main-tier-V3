import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Play } from 'lucide-react'
import type { PreCourseSurveyAnswers } from '@/services/preCourseSurveyService'

interface PreCourseSurveyScreenProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (answers: PreCourseSurveyAnswers) => Promise<void> | void
  isSubmitting?: boolean
  initialValues?: Partial<PreCourseSurveyAnswers>
}

type FieldKey = keyof PreCourseSurveyAnswers

const FIELDS: ReadonlyArray<{
  key: FieldKey
  label: string
  type: string
  autoComplete: string
}> = [
  { key: 'email', label: 'Email Address', type: 'email', autoComplete: 'email' },
  { key: 'firstName', label: 'First Name', type: 'text', autoComplete: 'given-name' },
  { key: 'lastName', label: 'Last Name', type: 'text', autoComplete: 'family-name' },
  { key: 'organization', label: 'Organization', type: 'text', autoComplete: 'organization' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const EMPTY: PreCourseSurveyAnswers = {
  email: '',
  firstName: '',
  lastName: '',
  organization: '',
}

export function PreCourseSurveyScreen({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  initialValues,
}: PreCourseSurveyScreenProps) {
  const [values, setValues] = useState<PreCourseSurveyAnswers>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})

  const initEmail = initialValues?.email ?? ''
  const initFirstName = initialValues?.firstName ?? ''
  const initLastName = initialValues?.lastName ?? ''
  const initOrganization = initialValues?.organization ?? ''

  // Reset to the latest prefill each time the survey opens.
  useEffect(() => {
    if (!isOpen) return
    setValues({
      email: initEmail,
      firstName: initFirstName,
      lastName: initLastName,
      organization: initOrganization,
    })
    setErrors({})
  }, [isOpen, initEmail, initFirstName, initLastName, initOrganization])

  const setField = (key: FieldKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  const handleNext = () => {
    const next: Partial<Record<FieldKey, string>> = {}
    if (!values.email.trim()) next.email = 'This question requires an answer.'
    else if (!EMAIL_RE.test(values.email.trim()))
      next.email = 'Please enter a valid email address.'
    if (!values.firstName.trim()) next.firstName = 'This question requires an answer.'
    if (!values.lastName.trim()) next.lastName = 'This question requires an answer.'
    if (!values.organization.trim()) next.organization = 'This question requires an answer.'

    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }
    void onSubmit({
      email: values.email.trim(),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      organization: values.organization.trim(),
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      scrollBehavior="inside"
      closeOnOverlayClick={false}
    >
      <ModalOverlay />
      <ModalContent bg="white" borderRadius={0} m={0}>
        <ModalCloseButton color="#350e6f" size="lg" top={4} right={4} zIndex={2} />
        <ModalBody p={0} overflowY="auto">
          <Box maxW="760px" mx="auto" px={{ base: 6, md: 8 }} py={{ base: 10, md: 16 }}>
            <VStack spacing={0} align="stretch">
              <Flex justify="center" mb={10}>
                <Flex
                  w="84px"
                  h="84px"
                  borderRadius="full"
                  bgGradient="linear(to-br, #f9db59, #eab130)"
                  align="center"
                  justify="center"
                  boxShadow="0 6px 16px rgba(234,177,48,0.35)"
                >
                  <Icon as={Play} boxSize={9} color="white" fill="white" ml="3px" />
                </Flex>
              </Flex>

              <Heading
                as="h1"
                color="#eab130"
                fontWeight="bold"
                fontSize={{ base: '2xl', md: '3xl' }}
                lineHeight="1.2"
                mb={5}
              >
                Think Like an Owner - Pre-Course Assessment
              </Heading>

              <Text color="#350e6f" fontSize={{ base: 'md', md: 'lg' }} lineHeight="1.7" mb={10}>
                Before diving into Think Like an Owner, take 2 minutes to rate yourself on these
                behaviors. Be honest, there are no right answers. This helps us measure your growth.
              </Text>

              <Stack spacing={9}>
                {FIELDS.map((field, index) => (
                  <FormControl key={field.key} isRequired isInvalid={Boolean(errors[field.key])}>
                    <FormLabel
                      htmlFor={`pcs-${field.key}`}
                      color="#350e6f"
                      fontSize={{ base: 'md', md: 'lg' }}
                      fontWeight="semibold"
                      mb={3}
                      requiredIndicator={null}
                    >
                      <Box as="span" mr={1}>
                        *
                      </Box>
                      {index + 1}. {field.label}
                    </FormLabel>
                    <Input
                      id={`pcs-${field.key}`}
                      type={field.type}
                      autoComplete={field.autoComplete}
                      value={values[field.key]}
                      onChange={(event) => setField(field.key, event.target.value)}
                      size="lg"
                      h="52px"
                      bg="white"
                      color="#27062e"
                      borderColor="#b9a9d1"
                      borderRadius="md"
                      _hover={{ borderColor: '#350e6f' }}
                      _focusVisible={{ borderColor: '#350e6f', boxShadow: '0 0 0 1px #350e6f' }}
                    />
                    <FormErrorMessage color="#e53e3e">{errors[field.key]}</FormErrorMessage>
                  </FormControl>
                ))}
              </Stack>

              <Box mt={10}>
                <Button
                  bg="#eab130"
                  color="#27062e"
                  fontWeight="bold"
                  px={12}
                  h="48px"
                  borderRadius="md"
                  _hover={{ bg: '#d99e1f' }}
                  _active={{ bg: '#c98f15' }}
                  isLoading={isSubmitting}
                  loadingText="Saving"
                  onClick={handleNext}
                >
                  Next
                </Button>
              </Box>

              <Text mt={14} fontSize="xs" color="text.muted" textAlign="center">
                This is a one-time assessment. Your responses are kept private and shared only with
                your programme partner.
              </Text>
            </VStack>
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default PreCourseSurveyScreen

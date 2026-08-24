import React from 'react'
import {
  Box,
  Button,
  Flex,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'
import { IMPACT_HELP, type ImpactHelpKey } from '@/config/impactHelp'

type Props = {
  helpKey: ImpactHelpKey | null
  onClose: () => void
}

export const ImpactHelpModal: React.FC<Props> = ({ helpKey, onClose }) => {
  const h = helpKey ? IMPACT_HELP[helpKey] : null
  return (
    <Modal isOpen={Boolean(h)} onClose={onClose} size="lg" isCentered>
      <ModalOverlay bg="blackAlpha.500" />
      <ModalContent>
        <ModalHeader>
          <Text fontSize="xs" color="brand.accent" textTransform="uppercase" letterSpacing="0.12em" mb={1}>
            Help
          </Text>
          <Heading size="md">{h?.t}</Heading>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {h && (
            <>
              <Box
                position="relative"
                borderRadius="xl"
                overflow="hidden"
                bg="linear-gradient(150deg,#2A2438,#1A1726)"
                aspectRatio={16 / 9}
                mb={3}
                display="grid"
                placeItems="center"
              >
                <Box
                  w="56px"
                  h="56px"
                  borderRadius="full"
                  border="1.5px solid"
                  borderColor="whiteAlpha.500"
                  bg="whiteAlpha.200"
                />
                <Text position="absolute" top={3} right={3} fontSize="xs" color="yellow.300" fontWeight="bold">
                  WALKTHROUGH
                </Text>
                <Text position="absolute" bottom={3} left={3} fontSize="xs" color="whiteAlpha.700">
                  {h.vid} · drop Loom / YouTube here
                </Text>
              </Box>
              <Text fontSize="sm" color="text.secondary" whiteSpace="pre-wrap" mb={4}>
                {h.p}
              </Text>
              <Box
                borderLeft="3px solid"
                borderColor="brand.accent"
                bg="orange.50"
                pl={3}
                pr={3}
                py={2}
                rounded="md"
              >
                <Text fontWeight="semibold" fontSize="sm" mb={1}>
                  Worked example
                </Text>
                <Text fontSize="sm" color="text.secondary">
                  {h.eg}
                </Text>
              </Box>
              <Flex justify="flex-end" mt={4}>
                <Button size="sm" onClick={onClose}>
                  Close
                </Button>
              </Flex>
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

/** Small ? help trigger used inline next to labels. */
export const ImpactHelpButton: React.FC<{
  k: ImpactHelpKey
  onOpen: (k: ImpactHelpKey) => void
}> = ({ k, onOpen }) => (
  <Button
    aria-label="What is this"
    size="xs"
    variant="outline"
    minW="18px"
    h="18px"
    p={0}
    borderRadius="full"
    fontSize="10px"
    color="brand.primary"
    borderColor="border.subtle"
    ml={1}
    onClick={() => onOpen(k)}
  >
    ?
  </Button>
)

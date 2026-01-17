import { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  Flex,
  Grid,
  GridItem,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  SimpleGrid,
  Text,
  Textarea,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { formatDistanceToNow } from 'date-fns'
import { Edit, Plus, Search, Trash2, UserSquare2, Users as UsersIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  ManagedUserRecord,
  OrganizationOption,
  assignRoleToUser,
  updateUser,
} from '@/services/userManagementService'

/* ------------------------------------------------------------------ */
/* TYPES */
/* ------------------------------------------------------------------ */

type LeadershipRole = 'mentor' | 'ambassador'

interface LeadershipCouncilProps {
  users: ManagedUserRecord[]
  organizations: OrganizationOption[]
  loadingUsers: boolean
}

/* ------------------------------------------------------------------ */
/* CONSTANTS */
/* ------------------------------------------------------------------ */

const roleLabels: Record<LeadershipRole, string> = {
  mentor: 'Mentor',
  ambassador: 'Ambassador',
}

const statusBadge = (status?: string) => {
  if (status === 'active') return { bg: 'green.100', color: 'green.600', label: 'Active' }
  if (status === 'suspended' || status === 'inactive')
    return { bg: 'red.100', color: 'red.600', label: status === 'suspended' ? 'Suspended' : 'Inactive' }
  return { bg: 'gray.100', color: 'gray.600', label: 'Unknown' }
}

/* ------------------------------------------------------------------ */
/* COMPONENT */
/* ------------------------------------------------------------------ */

export const LeadershipCouncil = ({
  users,
  organizations,

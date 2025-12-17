import React, { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react'
import { AlertCircle, Download, Lock, Search, Shield, ShieldCheck, UserCheck } from 'lucide-react'

type AuditEntry = {
  id: string
  actor: string
  action: string
  organization: string
  severity: 'info' | 'warning' | 'critical'
  timestamp: string
}

const auditRows: AuditEntry[] = [
  { id: '1', actor: 'Alex', action: 'Updated security rules', organization: 'Org A', severity: 'warning', timestamp: 'Today' },
  { id: '2', actor: 'Bri', action: 'Reset password', organization: 'Org B', severity: 'info', timestamp: '1h ago' },
  { id: '3', actor: 'Chris', action: 'Suspended user', organization: 'Org A', severity: 'critical', timestamp: '1d ago' },
]

export const SecurityAuditPage: React.FC = () => {
  const toast = useToast()
  const [filters, setFilters] = useState({ severity: 'all', organization: 'all', search: '' })

  const filteredRows = useMemo(() => {
    return auditRows.filter((row) => {
      const matchesSeverity = filters.severity === 'all' || row.severity === filters.severity
      const matchesOrg = filters.organization === 'all' || row.organization === filters.organization
      const matchesSearch = `${row.actor} ${row.action}`.toLowerCase().includes(filters.search.toLowerCase())
      return matchesSeverity && matchesOrg && matchesSearch
    })
  }, [filters])

  const exportCsv = () => toast({ title: 'Export queued', status: 'success' })

  return (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={6}>
            <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3} direction={{ base: 'column', md: 'row' }}>
              <Stack spacing={1}>
                <Text fontWeight="bold" color="brand.text">
                  Security & audit
                </Text>
                <Text fontSize="sm" color="brand.subtleText">
                  Monitor admin activity, enforce access rules, and export audit history.
                </Text>
              </Stack>
              <HStack>
                <Button leftIcon={<Download size={16} />} variant="outline" onClick={exportCsv}>
                  Export logs
                </Button>
                <Button leftIcon={<ShieldCheck size={16} />} colorScheme="purple">
                  Security rules
                </Button>
              </HStack>
            </Flex>

            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <Search size={16} />
                </InputLeftElement>
                <Input
                  placeholder="Search audit trail"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                />
              </InputGroup>
              <Select value={filters.severity} onChange={(e) => setFilters((prev) => ({ ...prev, severity: e.target.value }))}>
                <option value="all">All severity</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </Select>
              <Select
                value={filters.organization}
                onChange={(e) => setFilters((prev) => ({ ...prev, organization: e.target.value }))}
              >
                <option value="all">All organizations</option>
                <option value="Org A">Org A</option>
                <option value="Org B">Org B</option>
              </Select>
            </SimpleGrid>

            <Box border="1px solid" borderColor="brand.border" borderRadius="md" overflowX="auto">
              <Table size="sm">
                <Thead bg="gray.50">
                  <Tr>
                    <Th>Actor</Th>
                    <Th>Action</Th>
                    <Th>Organization</Th>
                    <Th>Severity</Th>
                    <Th>Timestamp</Th>
                    <Th>Controls</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredRows.map((row) => (
                    <Tr key={row.id} _hover={{ bg: 'gray.50' }}>
                      <Td>{row.actor}</Td>
                      <Td>{row.action}</Td>
                      <Td>{row.organization}</Td>
                      <Td>
                        <Badge colorScheme={row.severity === 'critical' ? 'red' : row.severity === 'warning' ? 'orange' : 'gray'}>
                          {row.severity}
                        </Badge>
                      </Td>
                      <Td>{row.timestamp}</Td>
                      <Td>
                        <HStack spacing={2}>
                          <Button size="xs" leftIcon={<Lock size={14} />} variant="ghost">
                            Access
                          </Button>
                          <Button size="xs" leftIcon={<UserCheck size={14} />} variant="ghost">
                            Actor
                          </Button>
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>

            <Card bg="gray.50" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={3}>
                  <HStack justify="space-between">
                    <HStack spacing={2}>
                      <Shield size={18} />
                      <Text fontWeight="bold">Security posture</Text>
                    </HStack>
                    <Badge colorScheme="green">Healthy</Badge>
                  </HStack>
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                    <PostureStat label="SSO enforced" value="Enabled" color="green" />
                    <PostureStat label="MFA coverage" value="92%" color="green" />
                    <PostureStat label="Open alerts" value="3" color="orange" />
                  </SimpleGrid>
                  <Button leftIcon={<AlertCircle size={16} />} variant="outline" alignSelf="flex-start">
                    Review security alerts
                  </Button>
                </Stack>
              </CardBody>
            </Card>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )
}

type PostureStatProps = {
  label: string
  value: string
  color: 'green' | 'orange' | 'red'
}

const PostureStat: React.FC<PostureStatProps> = ({ label, value, color }) => (
  <Box p={3} border="1px solid" borderColor="brand.border" borderRadius="md" bg="white">
    <Text fontSize="sm" color="brand.subtleText">
      {label}
    </Text>
    <Text fontWeight="bold" color={`${color}.600`}>
      {value}
    </Text>
  </Box>
)

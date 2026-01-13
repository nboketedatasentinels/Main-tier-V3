import React, { useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { ActivitySquare, Cpu, Database, KeyRound, Power, Wrench } from 'lucide-react'

export const PlatformConfigurationPage: React.FC = () => {
  const toast = useToast()
  const [maintenance, setMaintenance] = useState(false)
  const [apiKey, setApiKey] = useState('sk_live_********')
  const [webhookUrl, setWebhookUrl] = useState('https://api.example.com/hooks')

  const save = () => toast({ title: 'Platform configuration saved', status: 'success' })

  return (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={6}>
            <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3} direction={{ base: 'column', md: 'row' }}>
              <Stack spacing={1}>
                <Heading size="md">Platform configuration</Heading>
                <Text color="brand.subtleText">Advanced controls for system administrators.</Text>
              </Stack>
              <Button leftIcon={<Wrench size={16} />} colorScheme="purple" onClick={save}>
                Save updates
              </Button>
            </Flex>

            <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={6}>
              <GridItem>
                <Card bg="gray.50" border="1px solid" borderColor="brand.border">
                  <CardBody>
                    <Stack spacing={4}>
                      <HStack justify="space-between">
                        <Heading size="sm">Firebase</Heading>
                        <Badge colorScheme="green">Firestore</Badge>
                      </HStack>
                      <FormControl>
                        <FormLabel>Project ID</FormLabel>
                        <Input value="man-tier-v2" isReadOnly />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Database</FormLabel>
                        <Input value="Cloud Firestore (Native mode)" isReadOnly />
                      </FormControl>
                    </Stack>
                  </CardBody>
                </Card>
              </GridItem>

              <GridItem>
                <Card bg="gray.50" border="1px solid" borderColor="brand.border">
                  <CardBody>
                    <Stack spacing={4}>
                      <HStack justify="space-between">
                        <Heading size="sm">API & integrations</Heading>
                        <Badge colorScheme="purple">Keys</Badge>
                      </HStack>
                      <FormControl>
                        <FormLabel>Public API key</FormLabel>
                        <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Webhook endpoint</FormLabel>
                        <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
                      </FormControl>
                      <Textarea placeholder="Integration notes" />
                    </Stack>
                  </CardBody>
                </Card>
              </GridItem>
            </Grid>

            <Card bg="gray.50" border="1px solid" borderColor="brand.border">
              <CardBody>
                <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
                  <InfoTile icon={<ActivitySquare size={16} />} label="Version" value="v2.4.1" />
                  <InfoTile icon={<Cpu size={16} />} label="Health" value="Operational" />
                  <InfoTile icon={<Database size={16} />} label="Storage" value="68%" />
                  <InfoTile icon={<KeyRound size={16} />} label="API usage" value="1.2M calls" />
                </SimpleGrid>
              </CardBody>
            </Card>

            <Card bg="gray.50" border="1px solid" borderColor="brand.border">
              <CardBody>
                <HStack justify="space-between" align="center">
                  <Stack spacing={1}>
                    <Heading size="sm">Maintenance mode</Heading>
                    <Text color="brand.subtleText">Temporarily disable user-facing experiences.</Text>
                  </Stack>
                  <HStack spacing={3}>
                    <Switch isChecked={maintenance} onChange={(e) => setMaintenance(e.target.checked)} />
                    <Button leftIcon={<Power size={16} />} variant="outline" onClick={() => setMaintenance((prev) => !prev)}>
                      {maintenance ? 'Disable' : 'Enable'}
                    </Button>
                  </HStack>
                </HStack>
              </CardBody>
            </Card>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )
}

type InfoTileProps = {
  icon: React.ReactNode
  label: string
  value: string
}

const InfoTile: React.FC<InfoTileProps> = ({ icon, label, value }) => (
  <Box p={4} border="1px solid" borderColor="brand.border" borderRadius="md" bg="white">
    <HStack spacing={3}>
      {icon}
      <Stack spacing={0}>
        <Text fontSize="sm" color="brand.subtleText">
          {label}
        </Text>
        <Text fontWeight="bold" color="brand.text">
          {value}
        </Text>
      </Stack>
    </HStack>
  </Box>
)

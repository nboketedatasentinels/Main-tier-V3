import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Container,
  Divider,
  Heading,
  HStack,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  VStack,
  Badge,
  Input,
  Select,
  Textarea,
  Checkbox,
  Radio,
  RadioGroup,
} from '@chakra-ui/react'

/**
 * Theme Showcase Page
 * 
 * This page demonstrates all the theme components and styles
 * for visual verification and documentation purposes.
 */
export function ThemeShowcase() {
  return (
    <Box bg="brand.accent" minH="100vh" py={8}>
      <Container maxW="container.xl">
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <Card>
            <CardBody>
              <Heading as="h1" mb={2}>
                Theme & Design System Showcase
              </Heading>
              <Text color="brand.subtleText">
                Comprehensive theme system with brand-indigo primary and accent-gold secondary colors
              </Text>
            </CardBody>
          </Card>

          {/* Typography */}
          <Card>
            <CardHeader>
              <Heading as="h2" size="lg">
                Typography
              </Heading>
            </CardHeader>
            <CardBody>
              <Stack spacing={4}>
                <Box>
                  <h1>Heading 1 - Poppins Bold</h1>
                  <h2>Heading 2 - Poppins Semibold</h2>
                  <h3>Heading 3 - Poppins Semibold</h3>
                  <h4>Heading 4 - Poppins Semibold</h4>
                  <h5>Heading 5 - Poppins Semibold</h5>
                  <h6>Heading 6 - Poppins Semibold</h6>
                </Box>
                <Divider />
                <Box>
                  <Text fontSize="xl">Large body text - Inter Regular</Text>
                  <Text>Regular body text - Inter Regular</Text>
                  <Text fontSize="sm">Small body text - Inter Regular</Text>
                </Box>
              </Stack>
            </CardBody>
          </Card>

          {/* Color Palette */}
          <Card>
            <CardHeader>
              <Heading as="h2" size="lg">
                Color Palette
              </Heading>
            </CardHeader>
            <CardBody>
              <Stack spacing={6}>
                {/* Primary Colors */}
                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Primary (Brand Indigo)
                  </Text>
                  <HStack spacing={2}>
                    <Box bg="primary.50" p={4} rounded="md" minW="60px">
                      <Text fontSize="xs">50</Text>
                    </Box>
                    <Box bg="primary.100" p={4} rounded="md" minW="60px">
                      <Text fontSize="xs">100</Text>
                    </Box>
                    <Box bg="primary.200" p={4} rounded="md" minW="60px">
                      <Text fontSize="xs">200</Text>
                    </Box>
                    <Box bg="primary.300" p={4} rounded="md" minW="60px">
                      <Text fontSize="xs">300</Text>
                    </Box>
                    <Box bg="primary.400" p={4} rounded="md" minW="60px">
                      <Text fontSize="xs">400</Text>
                    </Box>
                    <Box bg="primary.500" p={4} rounded="md" minW="60px" color="white">
                      <Text fontSize="xs" fontWeight="bold">
                        500
                      </Text>
                    </Box>
                    <Box bg="primary.600" p={4} rounded="md" minW="60px" color="white">
                      <Text fontSize="xs">600</Text>
                    </Box>
                    <Box bg="primary.700" p={4} rounded="md" minW="60px" color="white">
                      <Text fontSize="xs">700</Text>
                    </Box>
                  </HStack>
                </Box>

                {/* Accent Colors */}
                <Box>
                  <Text fontWeight="semibold" mb={2}>
                    Accent (Gold)
                  </Text>
                  <HStack spacing={2}>
                    <Box bg="accent.50" p={4} rounded="md" minW="60px">
                      <Text fontSize="xs">50</Text>
                    </Box>
                    <Box bg="accent.100" p={4} rounded="md" minW="60px">
                      <Text fontSize="xs">100</Text>
                    </Box>
                    <Box bg="accent.200" p={4} rounded="md" minW="60px">
                      <Text fontSize="xs">200</Text>
                    </Box>
                    <Box bg="accent.300" p={4} rounded="md" minW="60px">
                      <Text fontSize="xs">300</Text>
                    </Box>
                    <Box bg="accent.400" p={4} rounded="md" minW="60px">
                      <Text fontSize="xs">400</Text>
                    </Box>
                    <Box bg="accent.500" p={4} rounded="md" minW="60px" color="text.primary">
                      <Text fontSize="xs" fontWeight="bold">
                        500
                      </Text>
                    </Box>
                    <Box bg="accent.600" p={4} rounded="md" minW="60px" color="white">
                      <Text fontSize="xs">600</Text>
                    </Box>
                    <Box bg="accent.700" p={4} rounded="md" minW="60px" color="white">
                      <Text fontSize="xs">700</Text>
                    </Box>
                  </HStack>
                </Box>

                {/* Semantic Colors */}
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <Box>
                    <Text fontWeight="semibold" mb={2}>
                      Success
                    </Text>
                    <HStack>
                      <Box bg="success.100" p={3} rounded="md" flex={1}>
                        <Text fontSize="xs">100</Text>
                      </Box>
                      <Box bg="success.500" p={3} rounded="md" flex={1} color="white">
                        <Text fontSize="xs" fontWeight="bold">
                          500
                        </Text>
                      </Box>
                      <Box bg="success.700" p={3} rounded="md" flex={1} color="white">
                        <Text fontSize="xs">700</Text>
                      </Box>
                    </HStack>
                  </Box>
                  <Box>
                    <Text fontWeight="semibold" mb={2}>
                      Warning
                    </Text>
                    <HStack>
                      <Box bg="warning.100" p={3} rounded="md" flex={1}>
                        <Text fontSize="xs">100</Text>
                      </Box>
                      <Box bg="warning.500" p={3} rounded="md" flex={1} color="text.primary">
                        <Text fontSize="xs" fontWeight="bold">
                          500
                        </Text>
                      </Box>
                      <Box bg="warning.700" p={3} rounded="md" flex={1} color="white">
                        <Text fontSize="xs">700</Text>
                      </Box>
                    </HStack>
                  </Box>
                  <Box>
                    <Text fontWeight="semibold" mb={2}>
                      Error
                    </Text>
                    <HStack>
                      <Box bg="error.100" p={3} rounded="md" flex={1}>
                        <Text fontSize="xs">100</Text>
                      </Box>
                      <Box bg="error.500" p={3} rounded="md" flex={1} color="text.primary">
                        <Text fontSize="xs" fontWeight="bold">
                          500
                        </Text>
                      </Box>
                      <Box bg="error.700" p={3} rounded="md" flex={1} color="white">
                        <Text fontSize="xs">700</Text>
                      </Box>
                    </HStack>
                  </Box>
                </SimpleGrid>
              </Stack>
            </CardBody>
          </Card>

          {/* Buttons */}
          <Card>
            <CardHeader>
              <Heading as="h2" size="lg">
                Buttons
              </Heading>
            </CardHeader>
            <CardBody>
              <Stack spacing={4}>
                <HStack spacing={4} flexWrap="wrap">
                  <Button variant="primary">Primary Button</Button>
                  <Button variant="secondary">Secondary Button</Button>
                  <Button variant="ghost">Ghost Button</Button>
                  <Button variant="accent">Accent Button</Button>
                  <Button variant="destructive">Destructive Button</Button>
                </HStack>
                <Divider />
                <HStack spacing={4} flexWrap="wrap">
                  <Button variant="primary" size="sm">
                    Small
                  </Button>
                  <Button variant="primary" size="md">
                    Medium
                  </Button>
                  <Button variant="primary" size="lg">
                    Large
                  </Button>
                </HStack>
              </Stack>
            </CardBody>
          </Card>

          {/* Badges */}
          <Card>
            <CardHeader>
              <Heading as="h2" size="lg">
                Badges
              </Heading>
            </CardHeader>
            <CardBody>
              <HStack spacing={4} flexWrap="wrap">
                <Badge variant="primary">Primary</Badge>
                <Badge variant="subtle">Subtle</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="error">Error</Badge>
                <Badge variant="premium">Premium</Badge>
              </HStack>
            </CardBody>
          </Card>

          {/* Progress */}
          <Card>
            <CardHeader>
              <Heading as="h2" size="lg">
                Progress Bars
              </Heading>
            </CardHeader>
            <CardBody>
              <Stack spacing={4}>
                <Box>
                  <Text fontSize="sm" mb={2}>
                    Primary Progress
                  </Text>
                  <Progress value={60} size="md" />
                </Box>
                <Box>
                  <Text fontSize="sm" mb={2}>
                    Success Progress
                  </Text>
                  <Progress value={80} size="md" variant="success" />
                </Box>
                <Box>
                  <Text fontSize="sm" mb={2}>
                    Warning Progress
                  </Text>
                  <Progress value={45} size="md" variant="warning" />
                </Box>
                <Box>
                  <Text fontSize="sm" mb={2}>
                    Error Progress
                  </Text>
                  <Progress value={25} size="md" variant="error" />
                </Box>
              </Stack>
            </CardBody>
          </Card>

          {/* Card Variants */}
          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Card Variants
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <Card>
                <CardBody>
                  <Text fontWeight="semibold">Default Card</Text>
                  <Text fontSize="sm" color="brand.subtleText">
                    Standard card with default shadow
                  </Text>
                </CardBody>
              </Card>
              <Card variant="elevated">
                <CardBody>
                  <Text fontWeight="semibold">Elevated Card</Text>
                  <Text fontSize="sm" color="brand.subtleText">
                    Card with elevated shadow
                  </Text>
                </CardBody>
              </Card>
              <Card variant="interactive">
                <CardBody>
                  <Text fontWeight="semibold">Interactive Card</Text>
                  <Text fontSize="sm" color="brand.subtleText">
                    Hover me for effect!
                  </Text>
                </CardBody>
              </Card>
            </SimpleGrid>
          </Box>

          {/* Form Inputs */}
          <Card>
            <CardHeader>
              <Heading as="h2" size="lg">
                Form Inputs
              </Heading>
            </CardHeader>
            <CardBody>
              <Stack spacing={4}>
                <Box>
                  <Text fontSize="sm" mb={2} fontWeight="medium">
                    Text Input
                  </Text>
                  <Input placeholder="Enter text..." />
                </Box>
                <Box>
                  <Text fontSize="sm" mb={2} fontWeight="medium">
                    Select
                  </Text>
                  <Select placeholder="Select option">
                    <option value="1">Option 1</option>
                    <option value="2">Option 2</option>
                    <option value="3">Option 3</option>
                  </Select>
                </Box>
                <Box>
                  <Text fontSize="sm" mb={2} fontWeight="medium">
                    Textarea
                  </Text>
                  <Textarea placeholder="Enter description..." />
                </Box>
                <Box>
                  <Text fontSize="sm" mb={2} fontWeight="medium">
                    Checkbox
                  </Text>
                  <Stack spacing={2}>
                    <Checkbox defaultChecked>Checked option</Checkbox>
                    <Checkbox>Unchecked option</Checkbox>
                  </Stack>
                </Box>
                <Box>
                  <Text fontSize="sm" mb={2} fontWeight="medium">
                    Radio Buttons
                  </Text>
                  <RadioGroup defaultValue="1">
                    <Stack spacing={2}>
                      <Radio value="1">Option 1</Radio>
                      <Radio value="2">Option 2</Radio>
                      <Radio value="3">Option 3</Radio>
                    </Stack>
                  </RadioGroup>
                </Box>
              </Stack>
            </CardBody>
          </Card>

          {/* Custom Utility Classes */}
          <Card>
            <CardHeader>
              <Heading as="h2" size="lg">
                Custom Utility Classes
              </Heading>
            </CardHeader>
            <CardBody>
              <Stack spacing={4}>
                <Box className="surface-texture" p={6} rounded="xl">
                  <Text fontWeight="semibold">Surface Texture</Text>
                  <Text fontSize="sm">Subtle dot grid pattern background</Text>
                </Box>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <Box className="gradient-hero" p={6} rounded="xl" color="white">
                    <Text fontWeight="semibold">Hero Gradient</Text>
                    <Text fontSize="sm">Purple gradient for hero sections</Text>
                  </Box>
                  <Box className="gradient-gold" p={6} rounded="xl" color="text.primary">
                    <Text fontWeight="semibold">Gold Gradient</Text>
                    <Text fontSize="sm">Gold gradient for premium features</Text>
                  </Box>
                </SimpleGrid>
                <Box>
                  <HStack spacing={4} flexWrap="wrap">
                    <span className="status-indicator--success">Success Status</span>
                    <span className="status-indicator--info">Info Status</span>
                    <span className="status-indicator--warning">Warning Status</span>
                    <span className="status-indicator--danger">Danger Status</span>
                  </HStack>
                </Box>
                <Box>
                  <HStack spacing={4} flexWrap="wrap">
                    <span className="premium-badge">Premium</span>
                    <span className="premium-badge--outline">Premium Outline</span>
                    <span className="eyebrow">Eyebrow Text</span>
                  </HStack>
                </Box>
              </Stack>
            </CardBody>
          </Card>

          {/* Shadows */}
          <Card>
            <CardHeader>
              <Heading as="h2" size="lg">
                Shadow System
              </Heading>
            </CardHeader>
            <CardBody>
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                <Box bg="white" p={4} rounded="lg" shadow="xs">
                  <Text fontSize="sm" fontWeight="medium">
                    shadow-xs
                  </Text>
                </Box>
                <Box bg="white" p={4} rounded="lg" shadow="sm">
                  <Text fontSize="sm" fontWeight="medium">
                    shadow-sm
                  </Text>
                </Box>
                <Box bg="white" p={4} rounded="lg" shadow="md">
                  <Text fontSize="sm" fontWeight="medium">
                    shadow-md
                  </Text>
                </Box>
                <Box bg="white" p={4} rounded="lg" shadow="lg">
                  <Text fontSize="sm" fontWeight="medium">
                    shadow-lg
                  </Text>
                </Box>
                <Box bg="white" p={4} rounded="lg" shadow="xl">
                  <Text fontSize="sm" fontWeight="medium">
                    shadow-xl
                  </Text>
                </Box>
                <Box bg="white" p={4} rounded="lg" shadow="2xl">
                  <Text fontSize="sm" fontWeight="medium">
                    shadow-2xl
                  </Text>
                </Box>
                <Box bg="white" p={4} rounded="lg" shadow="inner">
                  <Text fontSize="sm" fontWeight="medium">
                    shadow-inner
                  </Text>
                </Box>
                <Box bg="white" p={4} rounded="lg" shadow="none">
                  <Text fontSize="sm" fontWeight="medium">
                    shadow-none
                  </Text>
                </Box>
              </SimpleGrid>
            </CardBody>
          </Card>
        </VStack>
      </Container>
    </Box>
  )
}

export default ThemeShowcase

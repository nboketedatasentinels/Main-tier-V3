import React from 'react'
import { Box, Button, Heading, Text } from '@chakra-ui/react'

interface DashboardErrorBoundaryProps {
  children: React.ReactNode
  context?: string
}

interface DashboardErrorBoundaryState {
  hasError: boolean
}

export class DashboardErrorBoundary extends React.Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  state: DashboardErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('🔴 [DashboardErrorBoundary] Caught dashboard error', {
      context: this.props.context,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <Box p={8} maxW="600px" mx="auto" textAlign="center">
        <Heading size="md" mb={3}>
          We hit a snag loading the dashboard.
        </Heading>
        <Text mb={6} color="gray.600">
          {this.props.context ? `${this.props.context} failed to load.` : 'Please refresh to try again.'}
        </Text>
        <Button colorScheme="purple" onClick={this.handleReload}>
          Reload dashboard
        </Button>
      </Box>
    )
  }
}

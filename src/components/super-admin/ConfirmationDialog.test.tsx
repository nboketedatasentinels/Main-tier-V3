import { describe, expect, it, vi } from 'vitest'
import { ChakraProvider } from '@chakra-ui/react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmationDialog } from './ConfirmationDialog'

describe('ConfirmationDialog', () => {
  it('shows an inline error and stays open when confirm action fails', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Request failed'))
    const onClose = vi.fn()

    render(
      <ChakraProvider>
        <ConfirmationDialog
          isOpen
          title="Delete organization"
          description="This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={onConfirm}
          onClose={onClose}
        />
      </ChakraProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.getByText('Request failed')).toBeInTheDocument()
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes when confirm succeeds', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <ChakraProvider>
        <ConfirmationDialog
          isOpen
          title="Remove access"
          description="Confirm change."
          confirmLabel="Confirm"
          onConfirm={onConfirm}
          onClose={onClose}
        />
      </ChakraProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })
})


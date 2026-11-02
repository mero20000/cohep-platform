import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const getPushState = vi.fn()
const enablePush = vi.fn()
const disablePush = vi.fn()
vi.mock('@/lib/push', () => ({
  getPushState: () => getPushState(),
  enablePush: () => enablePush(),
  disablePush: () => disablePush(),
}))

let ios = false
let standalone = false
vi.mock('@/lib/install-detect', () => ({
  isIOS: () => ios,
  isIPadOS: () => false,
  isStandalone: () => standalone,
}))

import { PushToggle } from '../push-toggle'

beforeEach(() => {
  vi.clearAllMocks()
  ios = false
  standalone = false
})

describe('PushToggle', () => {
  it('offers to turn notifications on and reflects the result', async () => {
    getPushState.mockResolvedValue('off')
    enablePush.mockResolvedValue('on')
    render(<PushToggle />)
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on notifications' }))
    expect(enablePush).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Turn off on this device' })).toBeInTheDocument()
    expect(screen.getByText('Notifications are on for this device.')).toBeInTheDocument()
  })

  it('turns them off again', async () => {
    getPushState.mockResolvedValue('on')
    disablePush.mockResolvedValue('off')
    render(<PushToggle />)
    await userEvent.click(await screen.findByRole('button', { name: 'Turn off on this device' }))
    expect(disablePush).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Turn on notifications' })).toBeInTheDocument()
  })

  it('explains how to unblock when the browser has them blocked, with no button to press', async () => {
    getPushState.mockResolvedValue('denied')
    render(<PushToggle />)
    expect(await screen.findByText(/blocked for this site/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('tells iPhone users to add the app to the Home Screen first', async () => {
    ios = true
    getPushState.mockResolvedValue('unsupported')
    render(<PushToggle />)
    expect(await screen.findByText(/add COHEP to your Home Screen/i)).toBeInTheDocument()
  })

  it('says plainly when the browser cannot do push', async () => {
    getPushState.mockResolvedValue('unsupported')
    render(<PushToggle />)
    expect(await screen.findByText('This browser does not support push notifications.')).toBeInTheDocument()
  })

  it('shows an error and stays usable when enabling fails', async () => {
    getPushState.mockResolvedValue('off')
    enablePush.mockRejectedValue(new Error('network'))
    render(<PushToggle />)
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on notifications' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Turn on notifications' })).toBeEnabled())
  })

  it('does not crash if the state check itself fails', async () => {
    getPushState.mockRejectedValue(new Error('no sw'))
    render(<PushToggle />)
    expect(await screen.findByText('This browser does not support push notifications.')).toBeInTheDocument()
  })
})

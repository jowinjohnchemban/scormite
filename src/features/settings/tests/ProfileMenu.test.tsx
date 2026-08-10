import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DEFAULT_RUNTIME_PROFILE_ID, RUNTIME_PROFILES } from '../profiles/runtimeProfiles'
import { useSettingsStore } from '../state/settingsStore'
import { ProfileMenu } from '../components/ProfileMenu'

afterEach(cleanup)

beforeEach(() => {
  localStorage.clear()
  useSettingsStore.setState({ activeProfileId: DEFAULT_RUNTIME_PROFILE_ID })
})

function openMenu(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Runtime profile' }))
}

describe('ProfileMenu', () => {
  it('shows the active profile label on the trigger', () => {
    render(<ProfileMenu />)

    expect(screen.getByRole('button', { name: 'Runtime profile' })).toHaveTextContent(
      'Strict ADL',
    )
  })

  it('lists every profile once opened', () => {
    render(<ProfileMenu />)
    openMenu()

    for (const profile of RUNTIME_PROFILES) {
      expect(screen.getByRole('menuitemcheckbox', { name: profile.label })).toBeInTheDocument()
    }
  })

  it('checks the active profile and leaves the rest unchecked', () => {
    useSettingsStore.getState().setProfile('moodle')
    render(<ProfileMenu />)
    openMenu()

    expect(screen.getByRole('menuitemcheckbox', { name: 'Moodle' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('menuitemcheckbox', { name: 'Strict ADL' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('switches the active profile on click', () => {
    render(<ProfileMenu />)
    openMenu()

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'SCORM Cloud' }))

    expect(useSettingsStore.getState().activeProfileId).toBe('scorm-cloud')
    // The trigger now reflects the new profile.
    expect(screen.getByRole('button', { name: 'Runtime profile' })).toHaveTextContent(
      'SCORM Cloud',
    )
  })

  it('offers the description as a tooltip on each item', () => {
    render(<ProfileMenu />)
    openMenu()

    const item = screen.getByRole('menuitemcheckbox', { name: 'Canvas' })
    expect(item).toHaveAttribute('title', RUNTIME_PROFILES.find((p) => p.id === 'canvas')?.description)
  })
})

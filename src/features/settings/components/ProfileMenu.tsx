/**
 * Toolbar menu for switching the active runtime profile.
 *
 * Lives in the settings feature because the profile catalog and the persisted
 * choice are owned here. The app layer is responsible for applying a switch
 * to a live session (see `app/hooks/usePackageSession`); this component only
 * changes the store, and the menu's checked state mirrors it.
 */

import { Check, SlidersHorizontal } from 'lucide-react'
import { Menu, MenuItem, MenuLabel } from '@/components/ui/menu'
import { cn } from '@/shared/lib/utils'
import { RUNTIME_PROFILES } from '../profiles/runtimeProfiles'
import { useActiveProfile, useSettingsStore } from '../state/settingsStore'

export function ProfileMenu() {
  const active = useActiveProfile()
  const setProfile = useSettingsStore((s) => s.setProfile)

  return (
    <Menu
      ariaLabel="Runtime profile"
      label={
        <>
          <SlidersHorizontal aria-hidden />
          <span className="max-w-32 truncate">{active.label}</span>
        </>
      }
    >
      <MenuLabel>Runtime profile</MenuLabel>
      {RUNTIME_PROFILES.map((profile) => (
        <MenuItem
          key={profile.id}
          checked={profile.id === active.id}
          onClick={() => setProfile(profile.id)}
          title={profile.description}
        >
          <Check
            className={cn('text-accent', profile.id !== active.id && 'invisible')}
            aria-hidden
          />
          <span className="truncate">{profile.label}</span>
        </MenuItem>
      ))}
    </Menu>
  )
}

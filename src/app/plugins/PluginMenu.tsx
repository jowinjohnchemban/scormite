/**
 * Toolbar menu surfacing every command contributed by active plugins,
 * mirroring how the settings feature surfaces its profile menu.
 */

import { Puzzle } from 'lucide-react'
import { Menu, MenuItem, MenuLabel } from '@/components/ui/menu'
import { usePluginHost } from '@/features/plugins'

export function PluginMenu() {
  const commands = usePluginHost((s) => s.commands)
  if (commands.length === 0) return null

  return (
    <Menu
      ariaLabel="Plugins"
      label={
        <>
          <Puzzle aria-hidden />
          Plugins
        </>
      }
    >
      <MenuLabel>Plugins</MenuLabel>
      {commands.map((command) => (
        <MenuItem key={command.id} onClick={command.run}>
          <span className="truncate">{command.title}</span>
        </MenuItem>
      ))}
    </Menu>
  )
}

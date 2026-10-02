import { useCommands } from 'helpers/commands'
import useMenuContext from 'helpers/useMenuContext'

// Registers the menu commands of a page and gives its menu context to the
// main process. The pages are class components and cannot call the hooks.
export default function PageCommands({ commands, context }) {
  useCommands(commands)
  useMenuContext(context)
  return null
}

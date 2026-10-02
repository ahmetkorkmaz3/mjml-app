import { useEffect, useRef } from 'react'

// The menu items send a command name (see src/main/menu.js). The page that
// is open registers the handlers of the commands that it supports.
const handlers = new Map()

export function registerCommand(name, handler) {
  handlers.set(name, handler)
  return () => {
    if (handlers.get(name) === handler) {
      handlers.delete(name)
    }
  }
}

export function runCommand(name) {
  const handler = handlers.get(name)
  if (!handler) {
    return false
  }
  handler()
  return true
}

// registers the handlers of `map` while the component is mounted,
// the handlers can change on each render
export function useCommands(map) {
  const ref = useRef(map)
  useEffect(() => {
    ref.current = map
  })
  const names = Object.keys(map).join(',')
  useEffect(() => {
    const unregister = names
      .split(',')
      .filter(Boolean)
      .map(name => registerCommand(name, () => ref.current[name]()))
    return () => unregister.forEach(fn => fn())
  }, [names])
}

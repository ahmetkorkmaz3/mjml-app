import api from 'helpers/api'

// shows a native menu at the mouse position, resolves with the chosen id or null
export function showContextMenu(items) {
  return api.menu.popup(items).catch(err => {
    console.error(err)
    return null
  })
}

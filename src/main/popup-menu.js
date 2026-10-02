// Converts the items that the renderer sends to an Electron menu template.
// The renderer cannot send functions, so each item has an id.
export function toPopupTemplate(items, onChoose) {
  return (Array.isArray(items) ? items : [])
    .filter(i => i && (i.type === 'separator' || (typeof i.id === 'string' && i.label)))
    .map(i => {
      if (i.type === 'separator') {
        return { type: 'separator' }
      }
      return {
        label: String(i.label),
        enabled: i.enabled !== false,
        accelerator: i.accelerator,
        ...(typeof i.checked === 'boolean' ? { type: 'checkbox', checked: i.checked } : {}),
        click: () => onChoose(i.id),
      }
    })
}

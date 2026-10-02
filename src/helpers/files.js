const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']

// [base, extension], a dot at the start is a hidden file, not an extension
export function splitName(name) {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
}

export function fileKind(name, isFolder) {
  if (isFolder) return 'folder'
  const ext = splitName(name)[1].slice(1).toLowerCase()
  if (ext === 'mjml') return 'mjml'
  if (ext === 'html' || ext === 'htm') return 'html'
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image'
  return 'other'
}

// "index.mjml" → "index copy.mjml", then "index copy 2.mjml"...
export function duplicateName(name, existingNames) {
  const [base, ext] = splitName(name)
  const taken = new Set(existingNames)
  let candidate = `${base} copy${ext}`
  for (let n = 2; taken.has(candidate); n++) {
    candidate = `${base} copy ${n}${ext}`
  }
  return candidate
}

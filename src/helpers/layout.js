// The width of the preview pane: the saved width, made smaller when the
// window is narrow, so the editor keeps `editorMin` pixels.
// `available` is the width of the editor and the preview together (0 before
// the first measure).
export function fitPreviewWidth(current, available, { min, editorMin }) {
  if (!available) {
    return current
  }
  return Math.max(min, Math.min(current, available - editorMin))
}

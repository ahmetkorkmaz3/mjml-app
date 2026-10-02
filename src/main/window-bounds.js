const MIN_VISIBLE = 100

function isNumber(n) {
  return typeof n === 'number' && Number.isFinite(n)
}

// the top bar of the window (where the user can drag it) must be on a display
function topBarIsVisible(b, { workArea: a }) {
  const visibleWidth = Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x)
  return visibleWidth >= MIN_VISIBLE && b.y >= a.y && b.y < a.y + a.height - MIN_VISIBLE / 2
}

// Gives the window bounds to use at start. Saved bounds outside all the
// displays (a disconnected monitor) give the default size, centered by Electron.
export function fitBounds(saved, displays, defaults) {
  if (!saved || ![saved.x, saved.y, saved.width, saved.height].every(isNumber)) {
    return { ...defaults }
  }
  const display = displays.find(d => topBarIsVisible(saved, d))
  if (!display) {
    return { ...defaults }
  }
  const { workArea: a } = display
  return {
    x: saved.x,
    y: saved.y,
    width: Math.min(saved.width, a.width),
    height: Math.min(saved.height, a.height),
  }
}

// The open modals, the last one on top. Only the top modal handles Enter and
// Escape, so a dialog over another dialog does not run two actions.
export function createModalStack() {
  const stack = []
  return {
    push: modal => stack.push(modal),
    remove: modal => {
      const index = stack.lastIndexOf(modal)
      if (index !== -1) {
        stack.splice(index, 1)
      }
    },
    isTop: modal => stack.length > 0 && stack[stack.length - 1] === modal,
  }
}

const TEXT_TYPES = ['text', 'email', 'password', 'search', 'number', 'url', 'tel']

// Enter runs the main action of a dialog only from a text field or from the
// dialog itself. Buttons, tabs, radios and check boxes keep their own Enter.
export function isEnterTarget({ tagName, type, role }) {
  if (tagName === 'INPUT') {
    return TEXT_TYPES.includes(type || 'text')
  }
  return role === 'dialog'
}

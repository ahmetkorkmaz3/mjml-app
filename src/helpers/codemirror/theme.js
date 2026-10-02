import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'

// common style of the editors, the colors come from the selected theme
const baseTheme = EditorView.theme({
  '&': {
    height: '100%',
  },
  '.cm-scroller': {
    fontFamily: 'monospace',
  },
  '.cm-matchingTag': {
    color: '#ef8a92',
    borderBottom: '1px solid rgba(52, 112, 223, 0.8)',
  },
  '.cm-tooltip.cm-tooltip-lint': {
    padding: '6px',
  },
})

// the "high-contrast" theme of the settings
const lightTheme = [
  EditorView.theme({
    '&': {
      backgroundColor: '#ffffff',
      color: '#2e383c',
    },
    '.cm-gutters': {
      backgroundColor: '#ffffff',
      borderRight: 'none',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(0, 0, 0, 0.04)',
    },
    '.cm-matchingTag': {
      color: '#c0392b',
    },
  }),
  syntaxHighlighting(defaultHighlightStyle),
]

export function editorTheme(isLight) {
  return [baseTheme, isLight ? lightTheme : oneDark]
}

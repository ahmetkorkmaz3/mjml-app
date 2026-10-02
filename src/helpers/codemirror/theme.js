import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

// The editor colors use the app tokens (src/styles/tokens.scss), so the
// editor changes with the app theme.
const baseTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--bg-panel)', color: 'var(--fg)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.55' },
  '.cm-content': { caretColor: 'var(--accent)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--bg-selected) !important',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-panel)',
    color: 'var(--fg-subtle)',
    border: 'none',
  },
  '.cm-activeLine': { backgroundColor: 'var(--bg-hover)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--fg)' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--bg-hover)',
    border: '1px solid var(--border)',
    color: 'var(--fg-muted)',
  },
  '.cm-matchingTag': { borderBottom: '1px solid var(--accent)' },
  '.cm-searchMatch': {
    backgroundColor: 'var(--warning-bg)',
    outline: '1px solid var(--warning)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--bg-selected)' },
  '.cm-panels': {
    backgroundColor: 'var(--bg-window)',
    color: 'var(--fg)',
    borderColor: 'var(--separator)',
  },
  '.cm-panel input, .cm-panel button': { fontSize: 'var(--text-sm)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-popover)',
    color: 'var(--fg)',
  },
  '.cm-tooltip-autocomplete > ul > li': { padding: '2px 8px' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--bg-selected)',
    color: 'var(--fg)',
  },
  '.cm-tooltip.cm-tooltip-lint': { padding: '6px' },
  '.cm-diagnostic-error': { borderLeftColor: 'var(--danger)' },
})

const darkHighlight = HighlightStyle.define([
  { tag: [t.tagName, t.angleBracket], color: '#e06c75' },
  { tag: t.attributeName, color: '#d19a66' },
  { tag: [t.attributeValue, t.string], color: '#98c379' },
  { tag: t.comment, color: '#7f848e', fontStyle: 'italic' },
  { tag: [t.processingInstruction, t.documentMeta], color: '#c678dd' },
  { tag: t.content, color: '#e6e6ea' },
])

const lightHighlight = HighlightStyle.define([
  { tag: [t.tagName, t.angleBracket], color: '#22863a' },
  { tag: t.attributeName, color: '#6f42c1' },
  { tag: [t.attributeValue, t.string], color: '#032f62' },
  { tag: t.comment, color: '#6a737d', fontStyle: 'italic' },
  { tag: [t.processingInstruction, t.documentMeta], color: '#d73a49' },
  { tag: t.content, color: '#1d1d1f' },
])

export function editorTheme(isDark, fontSize = 13) {
  return [
    baseTheme,
    EditorView.theme({ '.cm-content, .cm-gutters': { fontSize: `${fontSize}px` } }),
    EditorView.theme({}, { dark: isDark }),
    syntaxHighlighting(isDark ? darkHighlight : lightHighlight),
  ]
}

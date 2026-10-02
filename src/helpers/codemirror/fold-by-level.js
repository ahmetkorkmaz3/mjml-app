import { ensureSyntaxTree, foldEffect, unfoldAll } from '@codemirror/language'

function lineIndentation(state, pos) {
  const { text } = state.doc.lineAt(pos)
  return text.length - text.trimStart().length
}

// Fold the elements whose parent element is indented by `foldLevel` columns
// or more (the behavior of the CodeMirror 5 version of the editor).
export default function foldByLevel(view, foldLevel) {
  unfoldAll(view)

  const { state } = view
  const effects = []

  const tree = ensureSyntaxTree(state, state.doc.length, 1000)
  if (!tree) {
    return
  }

  tree.iterate({
    enter(node) {
      if (node.name !== 'Element') {
        return
      }
      const parent = node.node.parent
      if (!parent || parent.name !== 'Element') {
        return
      }
      if (lineIndentation(state, parent.from) < foldLevel) {
        return
      }
      const open = node.node.getChild('OpenTag')
      const close = node.node.getChild('CloseTag')
      if (!open || !close) {
        return
      }
      if (state.doc.lineAt(open.to).number === state.doc.lineAt(close.from).number) {
        return
      }
      effects.push(foldEffect.of({ from: open.to, to: close.from }))
      // the folded content is hidden, no need to fold its children
      return false
    },
  })

  if (effects.length) {
    view.dispatch({ effects })
  }
}

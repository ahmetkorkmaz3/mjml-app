import { indentMore } from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'

// Tab key: expand the snippet whose trigger is the word before the cursor,
// else indent.
export function expandSnippetOrIndent(view, snippets) {
  const { state } = view
  const { main } = state.selection

  if (!main.empty || state.selection.ranges.length > 1) {
    return indentMore(view)
  }

  const word = state.wordAt(main.head)
  if (word && word.to === main.head) {
    const trigger = state.sliceDoc(word.from, word.to)
    const snippet = (snippets || []).find(s => s.trigger === trigger)
    if (snippet) {
      view.dispatch({
        changes: { from: word.from, to: word.to, insert: snippet.content },
        selection: { anchor: word.from + snippet.content.length },
        userEvent: 'input.complete',
      })
      return true
    }
  }

  view.dispatch({
    ...state.replaceSelection(state.facet(indentUnit)),
    scrollIntoView: true,
    userEvent: 'input',
  })
  return true
}

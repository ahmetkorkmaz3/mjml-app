import { syntaxTree } from '@codemirror/language'
import { Decoration, ViewPlugin } from '@codemirror/view'

const matchingTagMark = Decoration.mark({ class: 'cm-matchingTag' })

function getTagName(tag) {
  const name = tag && tag.getChild('TagName')
  return name ? { from: name.from, to: name.to } : null
}

// Highlight the name of the opening and closing tags of the element at the
// cursor (the `matchTags` option of CodeMirror 5).
function buildDecorations(view) {
  const { state } = view
  const pos = state.selection.main.head
  let node = syntaxTree(state).resolveInner(pos, -1)

  while (node && node.name !== 'Element') {
    node = node.parent
  }
  if (!node) {
    return Decoration.none
  }

  const ranges = [
    getTagName(node.getChild('OpenTag')),
    getTagName(node.getChild('CloseTag')),
    getTagName(node.getChild('SelfClosingTag')),
  ].filter(Boolean)

  if (ranges.length < 2 && !node.getChild('SelfClosingTag')) {
    return Decoration.none
  }
  return Decoration.set(ranges.map(({ from, to }) => matchingTagMark.range(from, to)))
}

export const matchingTags = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildDecorations(view)
    }

    update(update) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: v => v.decorations },
)

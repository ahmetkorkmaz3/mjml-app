// the errors of a snippet, by field (an empty object means the snippet is valid)
// originalName is the name of the snippet that is edited, so it does not conflict with itself
export function getSnippetErrors({ name, trigger, content }, snippets = [], originalName = null) {
  const errors = {}
  const others = snippets.filter(s => s.name !== originalName)
  const cleanName = typeof name === 'string' ? name.trim() : ''
  const cleanTrigger = typeof trigger === 'string' ? trigger.trim() : ''

  if (!cleanName) {
    errors.name = 'The name is required'
  } else if (others.some(s => s.name === cleanName)) {
    errors.name = `${cleanName} is already taken`
  }

  if (!cleanTrigger) {
    errors.trigger = 'The trigger is required'
  } else if (/\s/.test(cleanTrigger)) {
    errors.trigger = 'Spaces are not allowed in triggers'
  } else if (others.some(s => s.trigger === cleanTrigger)) {
    errors.trigger = `${cleanTrigger} is already taken`
  }

  if (typeof content !== 'string' || !content) {
    errors.content = 'The content is required'
  }

  return errors
}

export function isSnippetValid(snippet, snippets, originalName) {
  return Object.keys(getSnippetErrors(snippet, snippets, originalName)).length === 0
}

// reads the JSON of a snippets file and keeps the snippets that can be added
// throws when the file is not a JSON array
export function parseSnippetsImport(json, existing = []) {
  const data = JSON.parse(json)
  if (!Array.isArray(data)) {
    throw new Error('The file must contain a JSON array of snippets')
  }
  const added = []
  let skipped = 0
  for (const item of data) {
    const snippet = item && typeof item === 'object' ? item : {}
    // the snippets of the file are compared with each other too
    if (isSnippetValid(snippet, [...existing, ...added])) {
      added.push({
        name: snippet.name.trim(),
        trigger: snippet.trigger.trim(),
        content: snippet.content,
      })
    } else {
      skipped++
    }
  }
  return { added, skipped }
}

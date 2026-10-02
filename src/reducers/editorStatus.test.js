import { describe, expect, it } from 'vitest'

import reducer, { resetEditorStatus, setEditorStatus } from './editorStatus'

const initial = reducer(undefined, { type: '@@INIT' })

describe('editorStatus', () => {
  it('starts at line 1, column 1, clean and not rendering', () => {
    expect(initial).toEqual({ line: 1, col: 1, isDirty: false, isRendering: false, renderMs: null })
  })

  it('merges a partial update', () => {
    const s = reducer(initial, setEditorStatus({ line: 12, col: 8 }))
    expect(s).toEqual({ ...initial, line: 12, col: 8 })
    expect(reducer(s, setEditorStatus({ isRendering: true })).line).toBe(12)
  })

  it('resets to the initial state', () => {
    const s = reducer(initial, setEditorStatus({ line: 3, isDirty: true }))
    expect(reducer(s, resetEditorStatus())).toEqual(initial)
  })
})

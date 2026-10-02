import { describe, expect, it } from 'vitest'
import { fromJS } from 'immutable'

import reducer from './projects'

const touch = path => ({ type: 'PROJECT_TOUCH', payload: path })
const state = fromJS([{ path: '/a' }, { path: '/b' }, { path: '/c' }])
const paths = s => s.map(p => p.get('path')).toArray()

describe('projects reducer', () => {
  it('moves a touched project to the start', () => {
    expect(paths(reducer(state, touch('/c')))).toEqual(['/c', '/a', '/b'])
  })

  it('keeps the list for the first project or an unknown path', () => {
    expect(reducer(state, touch('/a'))).toBe(state)
    expect(reducer(state, touch('/x'))).toBe(state)
  })

  it('keeps a list that is not loaded', () => {
    expect(reducer(null, touch('/a'))).toBe(null)
  })

  it('sets the modification time when the preview changes', () => {
    const next = reducer(state, {
      type: 'PROJECT_UPDATE_PREVIEW',
      payload: { path: '/b', html: 'x' },
    })
    expect(typeof next.getIn([1, 'mtime'])).toBe('number')
  })
})

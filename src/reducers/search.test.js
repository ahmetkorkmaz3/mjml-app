import { describe, expect, it } from 'vitest'

import reducer, { searchText } from './search'

const load = paths =>
  reducer(undefined, { type: 'PROJECTS_LOAD', payload: paths.map(path => ({ path })) })

describe('search reducer', () => {
  it('finds a project by its folder name', () => {
    const state = reducer(load(['/a/newsletter', '/a/invoice']), searchText('newsletter'))
    expect([...state.results]).toEqual(['/a/newsletter'])
  })

  it('uses the new path after a rename', () => {
    let state = reducer(load(['/a/newsletter']), searchText('promo'))
    state = reducer(state, {
      type: 'PROJECT_RENAME',
      payload: { oldPath: '/a/newsletter', newPath: '/a/promo' },
    })
    expect([...state.results]).toEqual(['/a/promo'])
    state = reducer(state, searchText('newsletter'))
    expect(state.results.size).toBe(0)
  })

  it('forgets a removed project', () => {
    let state = reducer(load(['/a/newsletter', '/b/newsletter']), searchText('newsletter'))
    state = reducer(state, { type: 'PROJECT_REMOVE', payload: '/a/newsletter' })
    expect([...state.results]).toEqual(['/b/newsletter'])
    state = reducer(state, { type: 'PROJECTS_REMOVE', payload: ['/b/newsletter'] })
    expect(state.results.size).toBe(0)
    expect(state.raw).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'

import { displayPath, formatRelativeTime, nextSelection, sortProjects } from './projects'

const NOW = Date.UTC(2026, 9, 2, 12, 0, 0)
const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('gives an empty string without a time', () => {
    expect(formatRelativeTime(null, NOW)).toBe('')
  })

  it('gives "just now" under a minute and for a time in the future', () => {
    expect(formatRelativeTime(NOW - 30 * 1000, NOW)).toBe('just now')
    expect(formatRelativeTime(NOW + HOUR, NOW)).toBe('just now')
  })

  it('gives minutes, hours, days', () => {
    expect(formatRelativeTime(NOW - MIN, NOW)).toBe('1 minute ago')
    expect(formatRelativeTime(NOW - 5 * MIN, NOW)).toBe('5 minutes ago')
    expect(formatRelativeTime(NOW - 2 * HOUR, NOW)).toBe('2 hours ago')
    expect(formatRelativeTime(NOW - DAY, NOW)).toBe('yesterday')
    expect(formatRelativeTime(NOW - 3 * DAY, NOW)).toBe('3 days ago')
  })

  it('gives a date after 30 days', () => {
    expect(formatRelativeTime(Date.UTC(2026, 0, 15), NOW)).toMatch(/2026/)
  })
})

describe('displayPath', () => {
  it('replaces the home folder with ~ and shows the parent folder', () => {
    expect(displayPath('/Users/a/projects/news', '/Users/a', '/')).toBe('~/projects')
    expect(displayPath('/Users/a/news', '/Users/a', '/')).toBe('~')
  })

  it('keeps a path outside the home folder', () => {
    expect(displayPath('/tmp/mail/news', '/Users/a', '/')).toBe('/tmp/mail')
  })

  it('does not change a folder that only starts with the same letters', () => {
    expect(displayPath('/Users/ab/x/news', '/Users/a', '/')).toBe('/Users/ab/x')
  })

  it('works with Windows paths', () => {
    expect(displayPath('C:\\Users\\a\\mail\\news', 'C:\\Users\\a', '\\')).toBe('~\\mail')
  })
})

describe('sortProjects', () => {
  const list = [
    { path: '/p/beta', mtime: 2 },
    { path: '/p/Alpha', mtime: 1 },
    { path: '/p/gamma', mtime: null },
  ]

  it('keeps the order for "recent"', () => {
    expect(sortProjects(list, 'recent').map(p => p.path)).toEqual([
      '/p/beta',
      '/p/Alpha',
      '/p/gamma',
    ])
  })

  it('sorts by name without case', () => {
    expect(sortProjects(list, 'name').map(p => p.path)).toEqual(['/p/Alpha', '/p/beta', '/p/gamma'])
  })

  it('sorts by modified time, newest first, unknown times at the end', () => {
    expect(sortProjects(list, 'modified').map(p => p.path)).toEqual([
      '/p/beta',
      '/p/Alpha',
      '/p/gamma',
    ])
  })

  it('does not change the input array', () => {
    sortProjects(list, 'name')
    expect(list[0].path).toBe('/p/beta')
  })
})

describe('nextSelection', () => {
  const ordered = ['a', 'b', 'c', 'd']

  it('selects only the clicked project on a plain click', () => {
    expect(nextSelection({ selected: ['a', 'b'], clicked: 'c', ordered, anchor: 'a' })).toEqual({
      selected: ['c'],
      anchor: 'c',
    })
  })

  it('adds or removes the clicked project with Cmd/Ctrl', () => {
    expect(
      nextSelection({ selected: ['a'], clicked: 'c', ordered, anchor: 'a', meta: true }),
    ).toEqual({ selected: ['a', 'c'], anchor: 'c' })
    expect(
      nextSelection({ selected: ['a', 'c'], clicked: 'c', ordered, anchor: 'c', meta: true }),
    ).toEqual({ selected: ['a'], anchor: 'c' })
  })

  it('selects the range from the anchor with Shift', () => {
    expect(
      nextSelection({ selected: ['b'], clicked: 'd', ordered, anchor: 'b', shift: true }),
    ).toEqual({ selected: ['b', 'c', 'd'], anchor: 'b' })
    expect(
      nextSelection({ selected: ['c'], clicked: 'a', ordered, anchor: 'c', shift: true }),
    ).toEqual({ selected: ['a', 'b', 'c'], anchor: 'c' })
  })

  it('uses the clicked project as the anchor when the anchor is gone', () => {
    expect(
      nextSelection({ selected: [], clicked: 'b', ordered, anchor: 'x', shift: true }),
    ).toEqual({ selected: ['b'], anchor: 'b' })
  })
})

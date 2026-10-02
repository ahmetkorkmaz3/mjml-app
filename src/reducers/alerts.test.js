import { afterEach, describe, expect, it, vi } from 'vitest'

import reducer, { addAlert } from './alerts'

const add = (state, id) => reducer(state, { type: 'ALERT_ADD', payload: { id, message: '' } })

describe('alerts reducer', () => {
  afterEach(() => vi.useRealTimers())

  it('keeps the three newest alerts', () => {
    let state = []
    for (let id = 1; id <= 5; id++) state = add(state, id)
    expect(state.map(a => a.id)).toEqual([5, 4, 3])
  })

  it('hides an alert after 4 seconds', () => {
    vi.useFakeTimers()
    const dispatch = vi.fn()
    addAlert('Copied!', 'success')(dispatch)
    vi.advanceTimersByTime(3900)
    expect(dispatch).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(200)
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'ALERT_REMOVE' }))
  })
})

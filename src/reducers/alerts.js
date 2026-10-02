import { handleActions } from 'redux-actions'

const state = []

export default handleActions(
  {
    ALERT_ADD: (state, { payload: alert }) => [alert, ...state].slice(0, 3),
    ALERT_REMOVE: (state, { payload: id }) => state.filter(a => a.id !== id),
  },
  state,
)

let __ID__ = 0

// an error stays until the user closes it, the other alerts hide after 4 seconds
export function addAlert(message, type = 'info', { autoHide = type !== 'error' } = {}) {
  return dispatch => {
    const alert = { id: __ID__++, message, type }
    dispatch({ type: 'ALERT_ADD', payload: alert })
    if (autoHide) setTimeout(() => dispatch(removeAlert(alert.id)), 4e3)
  }
}

export function removeAlert(id) {
  return { type: 'ALERT_REMOVE', payload: id }
}
